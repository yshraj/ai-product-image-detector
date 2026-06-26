// background/service-worker.js
// Manifest V3 service worker. Responsibilities:
//   1. set defaults on install
//   2. fetch image bytes for content scripts (defeats CDN CORS)
//   3. run REMOTE detection (Hugging Face / AI or Not) — these calls need
//      Authorization headers and would be CORS-blocked from a content script,
//      so the worker (which has host_permissions) makes them.

const DEFAULTS = {
  enabled: true,
  mode: 'badge',
  provider: 'heuristic',                 // 'heuristic' | 'huggingface' | 'aiornot'
  hfToken: '',
  hfModel: 'Organika/sdxl-detector',     // image AI-vs-human classifier
  apiKey: '',                            // AI or Not
};

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.sync.set(DEFAULTS);
    console.log('[RMF] Installed with defaults');
  } else if (details.reason === 'update') {
    // Backfill any newly-added keys without clobbering user settings.
    const cur = await chrome.storage.sync.get(DEFAULTS);
    await chrome.storage.sync.set({ ...DEFAULTS, ...cur });
    console.log('[RMF] Updated to', chrome.runtime.getManifest().version);
  }
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function fetchImage(url) {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error('image HTTP ' + res.status);
  return res;
}

// ---- image bytes for the content script (EXIF + heuristic) ----------------
async function fetchImageAsDataUrl(url) {
  const res = await fetchImage(url);
  const buf = await res.arrayBuffer();
  const mime = res.headers.get('content-type') || 'image/jpeg';
  return `data:${mime};base64,${bufferToBase64(buf)}`;
}

// ---- Hugging Face Inference API -------------------------------------------
function parseHfResult(data) {
  // Response is [{label,score}, ...] or [[...]]. Labels vary by model:
  // ai/artificial/fake/synthetic => AI; human/real/authentic => real.
  const arr = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : data;
  if (!Array.isArray(arr)) throw new Error('unexpected HF response');
  const AI = /(^|[^a-z])(ai|artificial|fake|deepfake|gan|generated|synthetic|midjourney|stable|dalle)/i;
  const REAL = /(real|human|authentic|photo|nature|genuine)/i;
  let aiScore = null;
  for (const it of arr) {
    const l = String(it.label || '').toLowerCase();
    if (AI.test(l)) aiScore = Math.max(aiScore ?? 0, it.score);
  }
  if (aiScore === null) {
    for (const it of arr) {
      const l = String(it.label || '').toLowerCase();
      if (REAL.test(l)) aiScore = 1 - it.score;
    }
  }
  if (aiScore === null) throw new Error('no AI/real label found');
  const confidence = Math.round(aiScore * 100);
  return { isAI: confidence >= 50, confidence, source: 'huggingface' };
}

async function detectHuggingFace(url, token, model) {
  const imgRes = await fetchImage(url);
  const blob = await imgRes.blob();
  const endpoint = `https://api-inference.huggingface.co/models/${model}`;
  // The model may be cold — HF answers 503 with an ETA while it loads.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: blob,
    });
    if (res.status === 503) {
      const j = await res.json().catch(() => ({}));
      await wait(Math.min(((j.estimated_time || 6) * 1000), 9000));
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new Error('HF auth failed (check token)');
    if (!res.ok) throw new Error('HF ' + res.status);
    return parseHfResult(await res.json());
  }
  throw new Error('HF model still loading — try again shortly');
}

// ---- AI or Not ------------------------------------------------------------
async function detectAiOrNot(url, apiKey) {
  const res = await fetch('https://api.aiornot.com/v1/reports/image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ object: url }),
  });
  if (!res.ok) throw new Error('AIorNot ' + res.status);
  const data = await res.json();
  const raw = data?.report?.ai?.confidence;
  const confidence = Math.round((typeof raw === 'number' ? raw : 0.5) * 100);
  return { isAI: data?.report?.verdict === 'ai', confidence, source: 'aiornot' };
}

// ---- remote dispatch ------------------------------------------------------
async function remoteDetect(url) {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  if (cfg.provider === 'huggingface' && cfg.hfToken) {
    return detectHuggingFace(url, cfg.hfToken, cfg.hfModel || DEFAULTS.hfModel);
  }
  if (cfg.provider === 'aiornot' && cfg.apiKey) {
    return detectAiOrNot(url, cfg.apiKey);
  }
  return null; // no remote engine configured → caller falls back to heuristic
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'RMF_FETCH_IMAGE' && msg.url) {
    fetchImageAsDataUrl(msg.url)
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true;
  }
  if (msg?.type === 'RMF_REMOTE_DETECT' && msg.url) {
    remoteDetect(msg.url)
      .then((result) => sendResponse(result ? { ok: true, result } : { ok: false, reason: 'no-provider' }))
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true;
  }
  return false;
});
