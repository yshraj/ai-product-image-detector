// detection/pipeline.js
// Orchestrates detection with caching. Confidence = P(AI) on a 0-100 scale.
//
// Priority:
//   1. REMOTE model (Hugging Face / AI or Not) when the user configured a key —
//      this is the accurate path and is authoritative.
//   2. EXIF — decisive "real" only when genuine camera metadata is present.
//   3. On-device heuristic — PREVIEW-grade. Marked preview:true and held to a
//      higher flag threshold so it produces fewer false positives.
(function () {
  const PREVIEW_FLAG = 75; // heuristic must be quite confident before flagging

  function fetchDataUrl(imageUrl) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      try {
        chrome.runtime.sendMessage({ type: 'RMF_FETCH_IMAGE', url: imageUrl }, (resp) => {
          if (chrome.runtime.lastError) return done(null);
          done(resp && resp.ok ? resp.dataUrl : null);
        });
      } catch { done(null); }
      setTimeout(() => done(null), 8000);
    });
  }

  async function RMF_Detect(imageUrl) {
    if (!imageUrl) return { isAI: false, confidence: 0, source: 'no-url' };

    const cached = await window.RMF_Cache.get(imageUrl);
    if (cached) return cached;

    // 1) Accurate remote model, if configured.
    const remote = await window.RMF_RemoteDetect(imageUrl);
    if (remote) {
      await window.RMF_Cache.set(imageUrl, remote);
      return remote;
    }

    // 2/3) On-device fallback needs the bytes.
    const dataUrl = await fetchDataUrl(imageUrl);

    const exif = await window.RMF_ExifCheck(imageUrl, dataUrl);
    if (exif.hasSignal) {
      await window.RMF_Cache.set(imageUrl, exif);
      return exif;
    }

    const tfjs = await window.RMF_TfjsDetector(imageUrl, dataUrl);
    if (tfjs.source === 'heuristic-failed') {
      const inconclusive = { isAI: false, confidence: 0, source: 'inconclusive' };
      await window.RMF_Cache.set(imageUrl, inconclusive);
      return inconclusive;
    }

    // Preview-grade: flag only when clearly above threshold, and tag it so the
    // UI can show this is a low-confidence heuristic, not a real model.
    const result = {
      isAI: tfjs.confidence >= PREVIEW_FLAG,
      confidence: tfjs.confidence,
      source: 'heuristic',
      preview: true,
    };
    await window.RMF_Cache.set(imageUrl, result);
    return result;
  }

  window.RMF_Detect = RMF_Detect;
})();
