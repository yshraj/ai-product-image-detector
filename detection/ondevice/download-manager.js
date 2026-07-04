// detection/ondevice/download-manager.js  (service-worker context)
// Downloads the on-device model weights with:
//   • resumable transfers   — HTTP Range + If-Range(etag); partials in IndexedDB
//   • progress reporting     — throttled { received, total, pct } callbacks
//   • retry with backoff     — network/stall errors retried DOWNLOAD_RETRIES times
//   • stall timeout          — aborts if no bytes arrive for DOWNLOAD_TIMEOUT_MS
//   • integrity verification — optional sha-256 before the model is cached
//   • cancellation           — external AbortSignal aborts cleanly
//
// Weights are DATA, so downloading them at runtime is Chrome-MV3-compliant.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RMF_ModelDownloader = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  const CFG = (typeof self !== 'undefined' && self.RMF_OndeviceConfig) || {};
  const Store = (typeof self !== 'undefined' && self.RMF_ModelStore) || null;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function concatChunks(chunks, totalLen) {
    const out = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.byteLength; }
    return out;
  }

  async function sha256Hex(uint8) {
    if (typeof crypto === 'undefined' || !crypto.subtle) return '';
    const digest = await crypto.subtle.digest('SHA-256', uint8);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // One network attempt. Resolves with { done, chunks, received, total, etag }.
  // Throws on network / stall / HTTP error so the caller can retry.
  async function attempt(url, state, onProgress, externalSignal) {
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    // Stall watchdog: abort if no bytes arrive within the timeout window.
    let watchdog = null;
    const armWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => controller.abort(), CFG.DOWNLOAD_TIMEOUT_MS || 120_000);
    };

    const headers = {};
    if (state.received > 0 && state.etag) {
      headers.Range = `bytes=${state.received}-`;
      headers['If-Range'] = state.etag; // server restarts from 0 if the file changed
    }

    try {
      armWatchdog();
      const res = await fetch(url, { headers, signal: controller.signal, credentials: 'omit' });
      if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);

      const etag = res.headers.get('ETag') || state.etag || '';
      const isResume = res.status === 206;
      // Server ignored our Range (200 not 206) → restart from scratch.
      if (!isResume && state.received > 0) { state.chunks = []; state.received = 0; }

      const lenHeader = res.headers.get('Content-Length');
      const contentLen = lenHeader ? Number(lenHeader) : 0;
      const total = isResume
        ? state.received + contentLen
        : (contentLen || CFG.MODEL_SIZE_HINT || 0);
      state.total = total || state.total;
      state.etag = etag;

      if (!res.body || !res.body.getReader) {
        // No streaming — fall back to a single buffered read (no progress granularity).
        const buf = new Uint8Array(await res.arrayBuffer());
        state.chunks = [buf];
        state.received = buf.byteLength;
        state.total = buf.byteLength;
        return { done: true };
      }

      const reader = res.body.getReader();
      let sinceSave = 0;
      let lastEmit = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        armWatchdog();
        state.chunks.push(value);
        state.received += value.byteLength;
        sinceSave += value.byteLength;

        const now = Date.now();
        if (now - lastEmit >= (CFG.DOWNLOAD_PROGRESS_THROTTLE_MS || 250)) {
          lastEmit = now;
          onProgress && onProgress({ received: state.received, total: state.total });
        }
        // Persist a resumable checkpoint every ~16 MB so an interrupted download
        // can continue from here on the next session.
        if (Store && sinceSave >= 16 * 1024 * 1024) {
          sinceSave = 0;
          await Store.savePartial({
            chunks: state.chunks.map((c) => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength)),
            received: state.received, total: state.total, etag: state.etag,
          }).catch(() => {});
        }
      }
      onProgress && onProgress({ received: state.received, total: state.total });
      return { done: true };
    } finally {
      if (watchdog) clearTimeout(watchdog);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  /**
   * Download (or resume) the model, verify, and cache it in IndexedDB.
   * @param {string} url
   * @param {{ onProgress?: Function, signal?: AbortSignal, sha256?: string }} [opts]
   * @returns {Promise<{ size:number, sha256:string, version:number }>}
   */
  async function download(url, opts = {}) {
    if (!url) throw new Error('No model URL configured');
    const { onProgress, signal } = opts;
    const expectedSha = opts.sha256 || CFG.MODEL_SHA256 || '';

    // Resume from a saved partial if present.
    const state = { chunks: [], received: 0, total: CFG.MODEL_SIZE_HINT || 0, etag: '' };
    if (Store) {
      const partial = await Store.getPartial().catch(() => null);
      if (partial && Array.isArray(partial.chunks) && partial.received > 0) {
        state.chunks = partial.chunks.map((b) => new Uint8Array(b));
        state.received = partial.received;
        state.total = partial.total || state.total;
        state.etag = partial.etag || '';
      }
    }

    const retries = CFG.DOWNLOAD_RETRIES || 4;
    let lastErr = null;
    for (let i = 0; i <= retries; i++) {
      if (signal?.aborted) throw new Error('cancelled');
      try {
        const r = await attempt(url, state, onProgress, signal);
        if (r.done) break;
      } catch (err) {
        lastErr = err;
        if (signal?.aborted) throw new Error('cancelled');
        // Persist progress so the next attempt/session resumes.
        if (Store && state.received > 0) {
          await Store.savePartial({
            chunks: state.chunks.map((c) => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength)),
            received: state.received, total: state.total, etag: state.etag,
          }).catch(() => {});
        }
        if (i === retries) throw new Error(`Download failed after ${retries + 1} attempts: ${err.message}`);
        await sleep((CFG.DOWNLOAD_RETRY_BASE_MS || 1000) * Math.pow(2, i));
      }
    }
    if (lastErr && !state.received) throw lastErr;

    const bytes = concatChunks(state.chunks, state.received);
    const sha = await sha256Hex(bytes).catch(() => '');
    if (expectedSha && sha && sha.toLowerCase() !== expectedSha.toLowerCase()) {
      if (Store) await Store.clearPartial().catch(() => {});
      throw new Error('Model integrity check failed (sha-256 mismatch)');
    }

    const meta = { version: CFG.MODEL_VERSION, size: bytes.byteLength, sha256: sha, url };
    if (Store) await Store.putModel(bytes.buffer, meta);
    return meta;
  }

  return { download, sha256Hex };
}));
