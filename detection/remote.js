// detection/remote.js
// Thin content-script bridge to the service worker's remote detectors
// (Hugging Face). Returns a STRUCTURED outcome so the pipeline can
// tell these three cases apart — which matters because they need different
// handling and caching:
//   { result }      → a real verdict (cache it, authoritative)
//   { noProvider }  → no engine configured (fall back to the on-device heuristic)
//   { error }       → an engine IS configured but the call failed (cold start,
//                     rate limit, network). Do NOT fall back to a misleading
//                     preview verdict; back off and retry later.
(function () {
  function RMF_RemoteDetect(imageUrl) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      try {
        chrome.runtime.sendMessage({ type: 'RMF_REMOTE_DETECT', url: imageUrl }, (resp) => {
          if (chrome.runtime.lastError) return done({ error: chrome.runtime.lastError.message || 'worker unavailable' });
          if (resp && resp.ok) return done({ result: resp.result });
          if (resp && resp.reason === 'no-provider') return done({ noProvider: true });
          if (resp && resp.error) {
            window.RMF_Log?.warn('remote detect error:', resp.error);
            return done({ error: resp.error });
          }
          done({ error: 'unknown remote error' });
        });
      } catch (err) { done({ error: String(err && err.message || err) }); }
      // Remote models (esp. a cold HF model) can be slow; allow generous time.
      // A timeout means the engine is configured but unresponsive → back off.
      setTimeout(() => done({ error: 'remote timeout' }), 25000);
    });
  }

  window.RMF_RemoteDetect = RMF_RemoteDetect;
})();
