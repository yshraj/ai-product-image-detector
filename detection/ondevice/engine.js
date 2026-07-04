// detection/ondevice/engine.js  (service-worker context)
// Orchestrates the on-device detector:
//   • owns the offscreen detector document lifecycle
//   • drives model download (via download-manager) with live status reporting
//   • runs inference by delegating to the offscreen document
//   • degrades gracefully (runtimeMissing / modelMissing / error) so the
//     detection pipeline can fall back to Hugging Face / preview heuristic
//
// Status is mirrored to chrome.storage.session (survives SW restarts within a
// browser session) and broadcast via RMF_ONDEVICE_STATUS for the popup.
(function () {
  const CFG = self.RMF_OndeviceConfig || {};
  const Store = self.RMF_ModelStore || null;
  const Downloader = self.RMF_ModelDownloader || null;

  const OFFSCREEN_URL = CFG.OFFSCREEN_URL || 'offscreen/detector.html';
  const READY_TIMEOUT_MS = 30_000;
  const DETECT_TIMEOUT_MS = 30_000;

  let creating = null;
  let downloadAbort = null;
  // { phase:'idle'|'downloading'|'ready'|'error'|'runtimeMissing'|'modelMissing',
  //   received, total, pct, error, version }
  let status = { phase: 'idle', received: 0, total: 0, pct: 0, error: '', version: CFG.MODEL_VERSION };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function setStatus(patch) {
    status = { ...status, ...patch };
    try { await chrome.storage.session.set({ ondeviceStatus: status }); } catch { /* older Chrome */ }
    try { chrome.runtime.sendMessage({ type: 'RMF_ONDEVICE_STATUS', status }); } catch { /* no listener */ }
  }

  function msg(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'RMF_ONDEVICE', ...payload }, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve(resp);
      });
    });
  }

  async function hasOffscreen() {
    if (!chrome.offscreen?.hasDocument) return false;
    return chrome.offscreen.hasDocument();
  }

  async function waitReady(timeoutMs = READY_TIMEOUT_MS) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const resp = await Promise.race([
          msg({ action: 'ping' }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('ping timeout')), 3000)),
        ]);
        if (resp?.ok) return resp;
      } catch (err) {
        const m = String(err?.message || err);
        if (!/establish connection|Receiving end does not exist|ping timeout/i.test(m)) throw err;
      }
      await sleep(200);
    }
    return null;
  }

  async function ensureOffscreen() {
    if (!chrome.offscreen?.createDocument) {
      const e = new Error('offscreen API unavailable'); e.code = 'runtimeMissing'; throw e;
    }
    if (await hasOffscreen()) { await waitReady(5000); return; }
    if (!creating) {
      creating = chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ['WORKERS'],
        justification: 'Run the on-device AI-image detection model (ONNX Runtime) without blocking the UI.',
      }).finally(() => { creating = null; });
    }
    await creating;
    const ready = await waitReady();
    if (!ready) throw new Error('detector offscreen document not ready');
    if (ready.runtime === false) { const e = new Error('ONNX Runtime not bundled'); e.code = 'runtimeMissing'; throw e; }
  }

  // Is the on-device engine usable right now (runtime bundled + model cached)?
  async function isReady() {
    if (!Store || !chrome.offscreen?.createDocument) return false;
    try { return await Store.hasModel(); } catch { return false; }
  }

  async function refreshStatusFromCache() {
    try {
      const cached = (await chrome.storage.session.get('ondeviceStatus')).ondeviceStatus;
      if (cached) status = cached;
    } catch { /* noop */ }
    if (Store) {
      const has = await Store.hasModel().catch(() => false);
      if (has && status.phase !== 'ready') await setStatus({ phase: 'ready', pct: 100 });
      if (!has && status.phase === 'ready') await setStatus({ phase: 'idle', pct: 0 });
    }
    return status;
  }

  function isHttpsUrl(u) {
    try { return new URL(u).protocol === 'https:'; } catch { return false; }
  }

  async function startDownload() {
    if (status.phase === 'downloading') return status;
    const url = await resolveModelUrl();
    if (!url) { await setStatus({ phase: 'error', error: 'No model URL configured (Settings → On-device model URL)' }); return status; }
    // Weights must come over https from an explicit URL (defense-in-depth: never
    // let a stored setting point the worker's fetch at http/loopback/internal).
    if (!isHttpsUrl(url)) { await setStatus({ phase: 'error', error: 'Model URL must be https://' }); return status; }
    if (Store) await Store.pruneOldVersions().catch(() => {});
    downloadAbort = new AbortController();
    await setStatus({ phase: 'downloading', received: 0, total: CFG.MODEL_SIZE_HINT || 0, pct: 0, error: '' });
    try {
      await Downloader.download(url, {
        signal: downloadAbort.signal,
        onProgress: ({ received, total }) => {
          const pct = total ? Math.min(99, Math.round((received / total) * 100)) : 0;
          setStatus({ phase: 'downloading', received, total, pct });
        },
      });
      await setStatus({ phase: 'ready', pct: 100, error: '' });
    } catch (err) {
      const cancelled = /cancel/i.test(String(err?.message || ''));
      await setStatus({ phase: cancelled ? 'idle' : 'error', error: cancelled ? '' : String(err?.message || err) });
    } finally {
      downloadAbort = null;
    }
    return status;
  }

  function cancelDownload() {
    if (downloadAbort) downloadAbort.abort();
  }

  async function deleteModel() {
    cancelDownload();
    if (Store) await Store.deleteModel().catch(() => {});
    try { if (await hasOffscreen()) await msg({ action: 'dispose' }); } catch { /* noop */ }
    await setStatus({ phase: 'idle', received: 0, total: 0, pct: 0, error: '' });
  }

  async function resolveModelUrl() {
    try {
      const { ondeviceModelUrl } = await chrome.storage.sync.get({ ondeviceModelUrl: '' });
      return ondeviceModelUrl || CFG.MODEL_URL || '';
    } catch { return CFG.MODEL_URL || ''; }
  }

  // Run detection. Returns { result } on success, or { unavailable, reason } so
  // the pipeline can fall back. Never throws.
  async function detect(dataUrl) {
    try {
      if (!(await isReady())) return { unavailable: true, reason: 'modelMissing' };
      await ensureOffscreen();
      await msg({ action: 'ensureSession' });
      const resp = await Promise.race([
        msg({ action: 'detect', dataUrl }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('detect timeout')), DETECT_TIMEOUT_MS)),
      ]);
      if (resp?.ok) {
        return { result: { isAI: resp.isAI, confidence: resp.confidence, source: 'ondevice', model: CFG.MODEL_ID } };
      }
      return { unavailable: true, reason: resp?.code || resp?.error || 'ondevice-error' };
    } catch (err) {
      return { unavailable: true, reason: err?.code || String(err?.message || err) };
    }
  }

  self.RMF_OndeviceEngine = {
    isReady,
    refreshStatusFromCache,
    getStatus: () => status,
    startDownload,
    cancelDownload,
    deleteModel,
    detect,
    resolveModelUrl,
  };
})();
