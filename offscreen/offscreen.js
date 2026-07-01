// offscreen/offscreen.js — lazy CLIP image embeddings for price compare (transformers.js).
import { pipeline, env } from '../libs/transformers.min.js';

const { CLIP_MODEL } = globalThis.RMF_ScoreConfig || { CLIP_MODEL: 'Xenova/clip-vit-base-patch32' };

env.allowLocalModels = false;
env.useBrowserCache = true;

let clipExtractor = null;
let loadPromise = null;

async function ensureClip() {
  if (clipExtractor) return clipExtractor;
  if (!loadPromise) {
    loadPromise = pipeline('image-feature-extraction', CLIP_MODEL, { quantized: true })
      .then((model) => { clipExtractor = model; return model; })
      .catch((err) => { loadPromise = null; throw err; });
  }
  return loadPromise;
}

function tensorToArray(output) {
  const data = output?.data || output?.tolist?.()?.flat?.() || output;
  if (Array.isArray(data)) return data.map(Number);
  if (data && typeof data.length === 'number') return Array.from(data, Number);
  return [];
}

async function embedImage(url) {
  const model = await ensureClip();
  const output = await model(url, { pooling: 'mean', normalize: true });
  return tensorToArray(output);
}

async function scoreImagePair(sourceUrl, candidateUrl) {
  const [a, b] = await Promise.all([embedImage(sourceUrl), embedImage(candidateUrl)]);
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, (dot + 1) / 2));
}

async function scoreImages(sourceUrl, candidateUrls) {
  const sourceEmb = await embedImage(sourceUrl);
  const model = await ensureClip();
  const scores = {};
  for (const url of candidateUrls) {
    if (!url) { scores[url] = 0; continue; }
    try {
      const out = await model(url, { pooling: 'mean', normalize: true });
      const emb = tensorToArray(out);
      if (!emb.length || emb.length !== sourceEmb.length) {
        scores[url] = 0;
        continue;
      }
      let dot = 0;
      for (let i = 0; i < emb.length; i++) dot += sourceEmb[i] * emb[i];
      scores[url] = Math.max(0, Math.min(1, (dot + 1) / 2));
    } catch {
      scores[url] = 0;
    }
  }
  return scores;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'RMF_CLIP') return false;

  (async () => {
    try {
      if (msg.action === 'warmup') {
        await ensureClip();
        sendResponse({ ok: true, loaded: true });
        return;
      }
      if (msg.action === 'embed') {
        const embedding = await embedImage(msg.url);
        sendResponse({ ok: true, embedding });
        return;
      }
      if (msg.action === 'scorePair') {
        const score = await scoreImagePair(msg.sourceUrl, msg.candidateUrl);
        sendResponse({ ok: true, score });
        return;
      }
      if (msg.action === 'scoreBatch') {
        const scores = await scoreImages(msg.sourceUrl, msg.candidateUrls || []);
        sendResponse({ ok: true, scores });
        return;
      }
      sendResponse({ ok: false, error: 'unknown action' });
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
  })();

  return true;
});
