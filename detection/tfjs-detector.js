// detection/tfjs-detector.js  — Layer 2 (on-device)
// Two modes:
//   (a) If a global `tf` (TensorFlow.js) + a loaded model are present, run real
//       on-device inference (Phase 2 — wire up window.RMF_LOAD_TFJS_MODEL).
//   (b) Otherwise a zero-dependency canvas heuristic. It loads pixels from the
//       data URL the service worker fetched (no CORS taint) and combines three
//       cues into a 0-100 AI-likelihood:
//         - noise residual  : real camera photos carry sensor noise even in flat
//                              regions; AI renders are unnaturally clean. (primary)
//         - smoothness      : AI images over-smooth edges/detail.
//         - background flatness: studio-flat backgrounds lean synthetic (weak).
//
// This is a HEURISTIC, not a trained detector — it varies per image and orders
// clean/synthetic vs noisy/real correctly, but it WILL misclassify. For reliable
// results wire a model (a) or use the AI-or-Not API (Layer 3).
(function () {
  let _model = null;
  let _modelTried = false;

  async function tryLoadModel() {
    if (_modelTried) return _model;
    _modelTried = true;
    if (typeof window.RMF_LOAD_TFJS_MODEL === 'function' && window.tf) {
      try { _model = await window.RMF_LOAD_TFJS_MODEL(window.tf); } catch { _model = null; }
    }
    return _model;
  }

  function loadImageEl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      // data: URLs never taint the canvas, so no crossOrigin needed.
      if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image load failed'));
      img.src = src;
    });
  }

  function toGray(img) {
    const W = 96, H = 96;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H); // throws if tainted
    const g = new Float64Array(W * H);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      g[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return { g, W, H };
  }

  function variance(arr) {
    let m = 0;
    for (const v of arr) m += v;
    m /= arr.length;
    let s = 0;
    for (const v of arr) s += (v - m) ** 2;
    return s / arr.length;
  }

  function heuristicScore(img) {
    const { g, W, H } = toGray(img);

    // --- border flatness ---
    const border = [];
    for (let x = 0; x < W; x++) { border.push(g[x], g[(H - 1) * W + x]); }
    for (let y = 0; y < H; y++) { border.push(g[y * W], g[y * W + W - 1]); }
    const bgFlat = Math.max(0, 1 - variance(border) / 350); // 1 = flat bg

    // --- global smoothness (mean gradient magnitude) ---
    let edge = 0;
    for (let y = 1; y < H; y++) {
      for (let x = 1; x < W; x++) {
        const i = y * W + x;
        edge += Math.abs(g[i] - g[i - 1]) + Math.abs(g[i] - g[i - W]);
      }
    }
    const edgeAvg = edge / ((W - 1) * (H - 1));
    const smooth = Math.max(0, 1 - edgeAvg / 22); // 1 = very smooth

    // --- noise residual in the flattest blocks (primary cue) ---
    // Real sensors leave high-frequency noise even in smooth areas; AI does not.
    const B = 8, blockVars = [];
    for (let by = 0; by + B <= H; by += B) {
      for (let bx = 0; bx + B <= W; bx += B) {
        const block = [];
        for (let y = 0; y < B; y++) {
          for (let x = 0; x < B; x++) block.push(g[(by + y) * W + (bx + x)]);
        }
        blockVars.push(variance(block));
      }
    }
    blockVars.sort((a, b) => a - b);
    // 20th-percentile block variance = residual in the flattest regions.
    const p20 = blockVars[Math.floor(blockVars.length * 0.2)] || 0;
    const noiseLack = Math.max(0, 1 - p20 / 6); // low residual => 1 (AI-like)

    const score01 = 0.45 * noiseLack + 0.35 * smooth + 0.20 * bgFlat;
    return Math.round(Math.min(1, score01) * 100);
  }

  async function RMF_TfjsDetector(imageUrl, dataUrl) {
    const src = dataUrl || imageUrl;
    try {
      const model = await tryLoadModel();
      if (model && window.tf) {
        const tf = window.tf;
        const imgEl = await loadImageEl(src);
        const input = tf.tidy(() =>
          tf.browser.fromPixels(imgEl).resizeBilinear([224, 224]).toFloat().div(127.5).sub(1).expandDims(0)
        );
        const out = model.predict(input);
        const arr = await out.data();
        tf.dispose([input, out]);
        const confidence = Math.round((arr[arr.length - 1] || 0) * 100);
        return { isAI: confidence >= 60, confidence, source: 'tfjs' };
      }

      const imgEl = await loadImageEl(src);
      const confidence = heuristicScore(imgEl);
      return { isAI: confidence >= 60, confidence, source: 'heuristic' };
    } catch (err) {
      window.RMF_Log?.debug('Layer 2 failed:', err.message);
      return { isAI: false, confidence: 50, source: 'heuristic-failed' };
    }
  }

  window.RMF_TfjsDetector = RMF_TfjsDetector;
})();
