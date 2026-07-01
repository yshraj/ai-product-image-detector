// offscreen/offscreen.js — lazy CLIP image embeddings for price compare (transformers.js).
import { pipeline, env } from '../libs/transformers.min.js';

const { CLIP_MODEL } = globalThis.RMF_ScoreConfig || { CLIP_MODEL: 'Xenova/clip-vit-base-patch32' };

env.allowLocalModels = false;
env.useBrowserCache = true;

// Chrome extension CSP blocks blob: workers and CDN wasm fetches — bundle locally.
if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('libs/onnx/');
}
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.numThreads = 1;
}

let clipExtractor = null;
let loadPromise = null;

async function ensureClip() {
  if (clipExtractor) return clipExtractor;
  if (!loadPromise) {
    loadPromise = pipeline('image-feature-extraction', CLIP_MODEL, { quantized: true })
      .then((model) => { clipExtractor = model; return model; })
      .catch((err) => {
        loadPromise = null;
        console.error('[RMF CLIP] model load failed:', err);
        throw err;
      });
  }
  return loadPromise;
}

function tensorToArray(output) {
  const data = output?.data || output?.tolist?.()?.flat?.() || output;
  if (Array.isArray(data)) return data.map(Number);
  if (data && typeof data.length === 'number') return Array.from(data, Number);
  return [];
}

async function embedImage(input) {
  const model = await ensureClip();
  const output = await model(input, { pooling: 'mean', normalize: true });
  return tensorToArray(output);
}

function cosineFromEmbeddings(a, b) {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, (dot + 1) / 2));
}

async function scoreImagePair(sourceInput, candidateInput) {
  const [a, b] = await Promise.all([embedImage(sourceInput), embedImage(candidateInput)]);
  return cosineFromEmbeddings(a, b);
}

async function scoreImages(sourceInput, candidates) {
  const sourceEmb = await embedImage(sourceInput);
  const model = await ensureClip();
  const scores = {};
  for (const item of candidates) {
    const url = item?.url || item;
    const input = item?.dataUrl || item?.url || item;
    if (!url || !input) { scores[url] = 0; continue; }
    try {
      const out = await model(input, { pooling: 'mean', normalize: true });
      scores[url] = cosineFromEmbeddings(sourceEmb, tensorToArray(out));
    } catch (err) {
      console.warn('[RMF CLIP] candidate embed failed:', url, err?.message || err);
      scores[url] = 0;
    }
  }
  return scores;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'RMF_CLIP') return false;

  (async () => {
    try {
      if (msg.action === 'ping') {
        sendResponse({ ok: true, ready: true, wasmPaths: env.backends?.onnx?.wasm?.wasmPaths || '' });
        return;
      }
      if (msg.action === 'warmup') {
        await ensureClip();
        sendResponse({ ok: true, loaded: true });
        return;
      }
      if (msg.action === 'embed') {
        const embedding = await embedImage(msg.dataUrl || msg.url);
        sendResponse({ ok: true, embedding });
        return;
      }
      if (msg.action === 'scorePair') {
        const score = await scoreImagePair(
          msg.sourceDataUrl || msg.sourceUrl,
          msg.candidateDataUrl || msg.candidateUrl,
        );
        sendResponse({ ok: true, score });
        return;
      }
      if (msg.action === 'scoreBatch') {
        const sourceInput = msg.sourceDataUrl || msg.sourceUrl;
        const list = Array.isArray(msg.candidates)
          ? msg.candidates
          : (msg.candidateUrls || []).map((url) => ({ url, dataUrl: url }));
        const scores = await scoreImages(sourceInput, list);
        sendResponse({ ok: true, scores });
        return;
      }
      sendResponse({ ok: false, error: 'unknown action' });
    } catch (err) {
      console.error('[RMF CLIP] message handler error:', err);
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
  })();

  return true;
});
