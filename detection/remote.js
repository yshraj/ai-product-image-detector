// detection/remote.js
// Thin content-script bridge to the service worker's remote detectors
// (Hugging Face / AI or Not). Returns a normalized result object, or null when
// no remote engine is configured / the call failed (caller falls back to the
// on-device heuristic).
(function () {
  function RMF_RemoteDetect(imageUrl) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      try {
        chrome.runtime.sendMessage({ type: 'RMF_REMOTE_DETECT', url: imageUrl }, (resp) => {
          if (chrome.runtime.lastError) return done(null);
          if (resp && resp.ok) return done(resp.result);
          if (resp && resp.error) window.RMF_Log?.warn('remote detect error:', resp.error);
          done(null);
        });
      } catch { done(null); }
      // Remote models (esp. a cold HF model) can be slow; allow generous time.
      setTimeout(() => done(null), 25000);
    });
  }

  window.RMF_RemoteDetect = RMF_RemoteDetect;
})();
