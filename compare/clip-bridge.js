// compare/clip-bridge.js — service worker ↔ offscreen CLIP document bridge.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_ClipBridge = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const OFFSCREEN_URL = 'offscreen/offscreen.html';
  let creating = null;

  async function hasOffscreenDocument() {
    if (!chrome.offscreen?.hasDocument) return false;
    return chrome.offscreen.hasDocument();
  }

  async function ensureOffscreenDocument() {
    if (await hasOffscreenDocument()) return;
    if (!creating) {
      creating = chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ['WORKERS'],
        justification: 'Run CLIP image similarity for price compare without blocking the UI.',
      }).finally(() => { creating = null; });
    }
    await creating;
  }

  async function sendClipMessage(payload) {
    await ensureOffscreenDocument();
    return chrome.runtime.sendMessage({ type: 'RMF_CLIP', ...payload });
  }

  async function warmupClip() {
    return sendClipMessage({ action: 'warmup' });
  }

  async function scoreImageBatch(sourceUrl, candidateUrls) {
    if (!sourceUrl || !candidateUrls?.length) return {};
    const resp = await sendClipMessage({
      action: 'scoreBatch',
      sourceUrl,
      candidateUrls,
    });
    return resp?.ok ? (resp.scores || {}) : {};
  }

  return {
    ensureOffscreenDocument,
    warmupClip,
    scoreImageBatch,
    sendClipMessage,
  };
}));
