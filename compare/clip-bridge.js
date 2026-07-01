// compare/clip-bridge.js — service worker ↔ offscreen CLIP document bridge.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_ClipBridge = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const OFFSCREEN_URL = 'offscreen/offscreen.html';
  const CLIP_TIMEOUT_MS = 60_000;
  const OFFSCREEN_READY_MS = 30_000;
  let creating = null;
  let warmedUp = false;

  function sleep(ms) {
    return new Promise((r) => { setTimeout(r, ms); });
  }

  function clipMessage(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'RMF_CLIP', ...payload }, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve(resp);
      });
    });
  }

  async function hasOffscreenDocument() {
    if (!chrome.offscreen?.hasDocument) return false;
    return chrome.offscreen.hasDocument();
  }

  async function waitForOffscreenReady(timeoutMs = OFFSCREEN_READY_MS) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const resp = await Promise.race([
          clipMessage({ action: 'ping' }),
          new Promise((_, reject) => { setTimeout(() => reject(new Error('ping timeout')), 3000); }),
        ]);
        if (resp?.ok) return true;
      } catch (err) {
        const msg = String(err?.message || err);
        if (!/establish connection|Receiving end does not exist|ping timeout/i.test(msg)) {
          throw err;
        }
      }
      await sleep(250);
    }
    return false;
  }

  async function ensureOffscreenDocument() {
    if (await hasOffscreenDocument()) {
      await waitForOffscreenReady(5000);
      return;
    }
    if (!creating) {
      creating = chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ['WORKERS'],
        justification: 'Run CLIP image similarity for price compare without blocking the UI.',
      }).finally(() => { creating = null; });
    }
    await creating;
    const ready = await waitForOffscreenReady();
    if (!ready) throw new Error('CLIP offscreen document not ready');
  }

  async function sendClipMessage(payload) {
    await ensureOffscreenDocument();
    return Promise.race([
      clipMessage(payload),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('CLIP timeout')), CLIP_TIMEOUT_MS);
      }),
    ]);
  }

  async function toDataUrl(url) {
    const fetcher = (typeof self !== 'undefined' && self.RMF_FetchImage) || null;
    if (!url || !fetcher?.fetchImageAsDataUrl) return null;
    if (fetcher.isAllowedHttpUrl && !fetcher.isAllowedHttpUrl(url)) return null;
    if (String(url).startsWith('data:image/')) return url;
    try {
      return await fetcher.fetchImageAsDataUrl(url);
    } catch {
      return null;
    }
  }

  async function warmupClip() {
    if (warmedUp) return { ok: true, loaded: true };
    const resp = await sendClipMessage({ action: 'warmup' });
    if (resp?.ok) warmedUp = true;
    return resp;
  }

  async function scoreImageBatch(sourceUrl, candidateUrls, options = {}) {
    if (!sourceUrl || !candidateUrls?.length) return {};
    const debug = options.debug === true;
    const started = Date.now();

    try {
      if (!warmedUp) {
        await warmupClip().catch((err) => {
          if (typeof console !== 'undefined') {
            console.log('[RMF Compare]', 'clip-warmup-failed', { error: String(err?.message || err) });
          }
        });
      }

      const sourceDataUrl = await toDataUrl(sourceUrl);
      if (!sourceDataUrl) {
        if (typeof console !== 'undefined') {
          console.log('[RMF Compare]', 'clip-source-fetch-failed', { sourceUrl });
        }
        return {};
      }

      const candidateInputs = [];
      for (const url of candidateUrls) {
        if (!url) continue;
        const dataUrl = await toDataUrl(url);
        if (dataUrl) candidateInputs.push({ url, dataUrl });
        else if (debug) {
          console.log('[RMF Compare]', 'clip-candidate-fetch-failed', { url });
        }
      }

      if (!candidateInputs.length) {
        if (typeof console !== 'undefined') {
          console.log('[RMF Compare]', 'clip-no-fetchable-images', {
            sourceUrl,
            requested: candidateUrls.length,
          });
        }
        return {};
      }

      const resp = await sendClipMessage({
        action: 'scoreBatch',
        sourceDataUrl,
        candidates: candidateInputs,
      });

      const scores = resp?.ok ? (resp.scores || {}) : {};
      if (typeof console !== 'undefined') {
        const scored = Object.values(scores).filter((s) => s > 0).length;
        console.log('[RMF Compare]', 'clip-batch-done', {
          sourceUrl,
          candidates: candidateInputs.length,
          scored,
          elapsed: Date.now() - started,
          error: resp?.ok ? null : (resp?.error || 'unknown'),
        });
      }
      if (debug) {
        for (const { url } of candidateInputs) {
          console.log('[RMF Compare]', 'clip-score', {
            sourceImage: sourceUrl,
            candidateImage: url,
            clipScore: scores[url] ?? null,
            elapsed: Date.now() - started,
          });
        }
      }
      return scores;
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.log('[RMF Compare]', 'clip-batch-error', {
          sourceImage: sourceUrl,
          error: String(err?.message || err),
          elapsed: Date.now() - started,
        });
      }
      return {};
    }
  }

  return {
    ensureOffscreenDocument,
    waitForOffscreenReady,
    warmupClip,
    scoreImageBatch,
    sendClipMessage,
    toDataUrl,
    CLIP_TIMEOUT_MS,
  };
}));
