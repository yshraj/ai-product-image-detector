// offscreen/detector.js
// Hosts the ONNX Runtime Web session for on-device AI-image detection. Reads the
// cached model weights straight from IndexedDB (so multi-hundred-MB buffers are
// never marshalled over chrome messaging), builds one warm InferenceSession, and
// runs inference per image. Preprocessing reproduces research/accuracy-test/
// parity.py exactly so verdicts match the Hugging Face reference.
//
// Protocol (chrome.runtime messages, type 'RMF_ONDEVICE'):
//   { action:'ping' }          -> { ok, ready, runtime }
//   { action:'ensureSession' } -> { ok } | { ok:false, error, code }
//   { action:'detect', dataUrl }-> { ok, confidence, isAI } | { ok:false, error }
//   { action:'dispose' }       -> { ok }   (frees the session + WASM arena)
(function () {
  const CFG = self.RMF_OndeviceConfig || {};
  const Store = self.RMF_ModelStore || null;
  const hasRuntime = typeof self.ort !== 'undefined';

  if (hasRuntime && self.ort.env?.wasm && chrome.runtime?.getURL) {
    // Bundled WASM (CSP forbids CDN fetches). Single-threaded keeps it robust in
    // the offscreen document; SIMD is auto-selected when available.
    self.ort.env.wasm.wasmPaths = chrome.runtime.getURL(CFG.ORT_WASM_DIR || 'libs/onnx/');
    self.ort.env.wasm.numThreads = 1;
    self.ort.env.wasm.proxy = false;
  }

  let session = null;
  let loading = null;

  async function buildSession() {
    if (!hasRuntime) { const e = new Error('ONNX Runtime not bundled'); e.code = 'runtimeMissing'; throw e; }
    if (!Store) throw new Error('model store unavailable');
    const buf = await Store.getModelBuffer();
    if (!buf) { const e = new Error('model not downloaded'); e.code = 'modelMissing'; throw e; }
    return self.ort.InferenceSession.create(buf, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  }

  async function ensureSession() {
    if (session) return session;
    if (!loading) {
      loading = buildSession()
        .then((s) => { session = s; return s; })
        .catch((err) => { loading = null; throw err; });
    }
    return loading;
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = dataUrl;
    });
  }

  // resize -> /255 -> (x-mean)/std -> CHW float32, matching parity.py.
  function preprocess(img) {
    const N = CFG.INPUT_SIZE || 256;
    const canvas = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(N, N)
      : Object.assign(document.createElement('canvas'), { width: N, height: N });
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high'; // closest in-browser approximation to bicubic
    ctx.drawImage(img, 0, 0, N, N);
    const { data } = ctx.getImageData(0, 0, N, N); // RGBA, row-major
    const mean = CFG.MEAN || [0.485, 0.456, 0.406];
    const std = CFG.STD || [0.229, 0.224, 0.225];
    const out = new Float32Array(3 * N * N);
    const plane = N * N;
    for (let p = 0, i = 0; p < plane; p++, i += 4) {
      out[p] = ((data[i] / 255) - mean[0]) / std[0];               // R plane
      out[plane + p] = ((data[i + 1] / 255) - mean[1]) / std[1];   // G plane
      out[2 * plane + p] = ((data[i + 2] / 255) - mean[2]) / std[2]; // B plane
    }
    return { data: out, dims: [1, 3, N, N] };
  }

  function softmax(arr) {
    let max = -Infinity;
    for (const v of arr) if (v > max) max = v;
    let sum = 0;
    const e = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) { e[i] = Math.exp(arr[i] - max); sum += e[i]; }
    for (let i = 0; i < arr.length; i++) e[i] /= sum;
    return e;
  }

  async function detect(dataUrl) {
    const sess = await ensureSession();
    const img = await loadImage(dataUrl);
    const { data, dims } = preprocess(img);
    if (typeof img.close === 'function') { try { img.close(); } catch { /* noop */ } }
    const tensor = new self.ort.Tensor('float32', data, dims);
    const feeds = { [sess.inputNames[0]]: tensor };
    let results;
    try {
      results = await sess.run(feeds);
    } finally {
      if (typeof tensor.dispose === 'function') { try { tensor.dispose(); } catch { /* noop */ } }
    }
    const logits = Array.from(results[sess.outputNames[0]].data, Number);
    const probs = logits.length > 1 ? softmax(logits) : [logits[0]];
    const idx = CFG.AI_CLASS_INDEX || 0;
    const pAI = Math.max(0, Math.min(1, probs[idx] ?? 0));
    const confidence = Math.round(pAI * 100);
    return { confidence, isAI: confidence >= (CFG.FLAG_AT || 50) };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'RMF_ONDEVICE') return false;
    (async () => {
      try {
        if (msg.action === 'ping') { sendResponse({ ok: true, ready: !!session, runtime: hasRuntime }); return; }
        if (msg.action === 'ensureSession') { await ensureSession(); sendResponse({ ok: true }); return; }
        if (msg.action === 'detect') {
          const r = await detect(msg.dataUrl);
          sendResponse({ ok: true, ...r });
          return;
        }
        if (msg.action === 'dispose') {
          if (session && typeof session.release === 'function') { try { await session.release(); } catch { /* noop */ } }
          session = null; loading = null;
          sendResponse({ ok: true });
          return;
        }
        sendResponse({ ok: false, error: 'unknown action' });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err), code: err?.code || '' });
      }
    })();
    return true;
  });
})();
