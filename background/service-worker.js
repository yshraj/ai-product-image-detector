// background/service-worker.js
// Manifest V3 service worker. Responsibilities:
//   1. set defaults on install
//   2. fetch image bytes for content scripts (defeats CDN CORS)
//   3. run REMOTE detection (Hugging Face) — these calls need
//      Authorization headers and would be CORS-blocked from a content script,
//      so the worker (which has host_permissions) makes them.
//   4. validate provider credentials on demand (real test call, not a regex)
//   5. track engine health so the popup can surface real errors instead of
//      silently falling back to the on-device heuristic.
//   6. maintain the toolbar badge, opt-in notifications, activity history, and
//      handle the universal context-menu image checks.

// Shared user-facing strings (importScripts is a no-op under Node test require).
try {
  if (typeof importScripts === 'function') {
    importScripts(
      '../utils/defaults.js',
      '../utils/price.js',
      '../utils/storage-local.js',
      '../utils/product-query.js',
      '../utils/product-fingerprint.js',
      '../utils/product-matcher.js',
      '../compare/config.js',
      '../compare/parsers.js',
      '../compare/serp-search.js',
      '../compare/internal-apis.js',
      '../compare/score-config.js',
      '../compare/attribute-parser.js',
      '../compare/similarity.js',
      '../compare/search.js',
      '../compare/tab-search.js',
      '../compare/clip-bridge.js',
      '../utils/trust-storage.js',
    );
  }
} catch (e) {
  console.error('[RMF] compare modules failed to load:', e);
}
const STRINGS = (typeof self !== 'undefined' && self.RMF_STRINGS) || null;
const CompareSearch = (typeof self !== 'undefined' && self.RMF_CompareSearch) || null;
const TabSearch = (typeof self !== 'undefined' && self.RMF_TabSearch) || null;
const ClipBridge = (typeof self !== 'undefined' && self.RMF_ClipBridge) || null;
const ProductFingerprint = (typeof self !== 'undefined' && self.RMF_ProductFingerprint) || null;

const RMFDefaults = (typeof self !== 'undefined' && self.RMF_Defaults) || {};
const DEFAULTS = RMFDefaults.SYNC_DEFAULTS || {
  enabled: true,
  mode: 'badge',
  provider: 'heuristic',
  hfToken: '',
  hfModel: 'haywoodsloan/ai-image-detector-deploy',
  hfVerified: false,
  hfUser: '',
  minConfidence: 70,
  disabledSites: [],
  compareSites: ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa'],
  serpApiKey: '',
  notifyOnAI: false,
  compareUseTabs: false,
  compareUseClip: true,
  compareDebugLog: false,
};
const HISTORY_KEY = RMFDefaults.HISTORY_KEY || 'rmf_history';
const CACHE_PREFIX = RMFDefaults.CACHE_PREFIX || 'rmf_cache_';

// Hugging Face moved off the legacy api-inference host (now returns HTTP 410).
// The current path is the inference router with an explicit provider segment.
const HF_INFERENCE_BASE = 'https://router.huggingface.co/hf-inference/models/';
const HF_WHOAMI = 'https://huggingface.co/api/whoami-v2';

if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      await chrome.storage.sync.set(DEFAULTS);
    } else if (details.reason === 'update') {
      // Backfill any newly-added keys without clobbering user settings.
      const cur = await chrome.storage.sync.get(DEFAULTS);
      await chrome.storage.sync.set({ ...DEFAULTS, ...cur });
      // The old default model (Organika/sdxl-detector) over-flags real studio
      // photos. If the user never picked their own model, migrate them to the
      // new served default and drop stale cached verdicts.
      if (cur.hfModel === 'Organika/sdxl-detector') {
        await chrome.storage.sync.set({ hfModel: DEFAULTS.hfModel });
        await clearDetectionCache();
      }
    }
    setupContextMenu();
    await clearCompareCache();
  });
}

async function clearCompareCache() {
  try {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith('rmf_compare_'));
    if (keys.length) await chrome.storage.local.remove(keys);
  } catch { /* ignore */ }
}

const DETECT_SCRIPTS = [
  'libs/exifr.min.js',
  'utils/logger.js',
  'utils/throttle.js',
  'utils/cache.js',
  'detection/exif-check.js',
  'detection/tfjs-detector.js',
  'detection/remote.js',
  'detection/pipeline.js',
];

function setupContextMenu() {
  if (!chrome.contextMenus?.create) return Promise.resolve();
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'rmf-check-image',
        title: 'Check this image with TrueKart',
        contexts: ['image'],
      }, () => resolve());
    });
  });
}

async function checkImageFromContextMenu(tabId, imageUrl) {
  if (!tabId) return;
  if (!isAllowedHttpUrl(imageUrl)) {
    await injectContextFeedback(tabId, 'This image URL cannot be checked (blocked for security).');
    return;
  }
  if (!chrome.scripting?.executeScript) {
    await injectContextFeedback(tabId, 'TrueKart could not run on this page.');
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (url) => { window.__rmf_check_image_url = url; },
      args: [imageUrl],
    });
    await chrome.scripting.executeScript({ target: { tabId }, files: DETECT_SCRIPTS });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content/check-image.js'] });
  } catch (e) {
    await injectContextFeedback(tabId, 'Image check failed — reload the page and try again.');
  }
}

async function injectContextFeedback(tabId, message) {
  if (!chrome.scripting?.executeScript) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg) => {
        const existing = document.querySelector('.rmf-ctx-badge');
        if (existing) existing.remove();
        const wrap = document.createElement('div');
        wrap.className = 'rmf-ctx-badge';
        wrap.setAttribute('role', 'alert');
        wrap.textContent = msg;
        wrap.style.cssText = [
          'position:fixed', 'z-index:2147483647', 'padding:10px 14px', 'border-radius:10px',
          'font:600 13px -apple-system,sans-serif', 'box-shadow:0 4px 20px rgba(0,0,0,.25)',
          'background:#374151;color:#fff', 'top:16px', 'right:16px', 'max-width:280px',
        ].join(';');
        document.body.appendChild(wrap);
        setTimeout(() => wrap.remove(), 6000);
      },
      args: [message],
    });
  } catch { /* page may not allow injection */ }
}

if (typeof chrome !== 'undefined' && chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'rmf-check-image' || !info.srcUrl || !tab?.id) return;
    checkImageFromContextMenu(tab.id, info.srcUrl).catch(() => {});
  });
}

// Ensure menu exists when the worker starts (E2E loads unpacked without an install event).
try { setupContextMenu(); } catch { /* contextMenus unavailable in some contexts */ }

if (typeof self !== 'undefined') {
  self.RMF_runImageCheck = checkImageFromContextMenu;
  self.RMF_setupContextMenu = setupContextMenu;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Drop all cached detection verdicts (used when the model changes so old
// verdicts from a different model don't linger).
async function clearDetectionCache() {
  try {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
    if (keys.length) await chrome.storage.local.remove(keys);
    return keys.length;
  } catch { return 0; }
}

// Defence-in-depth: the worker has broad fetch ability (host_permissions bypass
// page CORS), so only ever fetch public http(s) URLs. This blocks a compromised
// page from coaxing the worker into hitting loopback/private-network addresses
// or non-http schemes (an SSRF / CORS-bypass-proxy abuse surface).
function isAllowedHttpUrl(u) {
  let url;
  try { url = new URL(u); } catch { return false; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const h = url.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h === '[::1]' || h === '::1') return false;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 0 || a === 127 || a === 10) return false;             // this-host / loopback / private
    if (a === 169 && b === 254) return false;                       // link-local (cloud metadata)
    if (a === 192 && b === 168) return false;                       // private
    if (a === 172 && b >= 16 && b <= 31) return false;              // private
    if (a >= 224) return false;                                     // multicast / reserved
  }
  return true;
}

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
  if (!isAllowedHttpUrl(url)) throw new Error('blocked URL');
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error('image HTTP ' + res.status);
  return res;
}

// ---- activity history (local, capped, deduped) ----------------------------
// A transparent local log of what was flagged — something no competitor offers.
// The worker is the single writer so concurrent cards can't race the storage.
const HISTORY_MAX = 200;
let historyChain = Promise.resolve();

function addHistory(entry) {
  if (!entry || typeof entry.imageUrl !== 'string') return historyChain;
  historyChain = historyChain.then(async () => {
    try {
      const { [HISTORY_KEY]: list = [] } = await chrome.storage.local.get(HISTORY_KEY);
      if (list.some((e) => e.imageUrl === entry.imageUrl)) return; // dedupe by image
      list.unshift({
        ts: Date.now(),
        site: String(entry.site || ''),
        score: Math.max(0, Math.min(100, Number(entry.score) || 0)),
        high: !!entry.high,
        source: String(entry.source || ''),
        preview: !!entry.preview,
        imageUrl: entry.imageUrl,
        pageUrl: String(entry.pageUrl || ''),
      });
      if (list.length > HISTORY_MAX) list.length = HISTORY_MAX;
      await chrome.storage.local.set({ [HISTORY_KEY]: list });
    } catch { /* best-effort */ }
  });
  return historyChain;
}

// ---- opt-in notifications --------------------------------------------------
// Non-intrusive, off by default. Honey's notifications are disliked for blocking
// the page; Rakuten's quiet nudge is loved — we do a single OS-level summary.
let lastNotifyAt = 0;
async function notifyAI(ai) {
  const count = Number(ai) || 0;
  if (count <= 0 || typeof chrome === 'undefined') return;
  const now = Date.now();
  // The throttle must survive service-worker restarts: MV3 unloads the worker on
  // idle, which would reset an in-memory-only timestamp and let notifications
  // re-fire inside the 30s window. Persist and read it back from session storage.
  let last = lastNotifyAt;
  try {
    const { rmf_lastNotify } = await chrome.storage.session.get('rmf_lastNotify');
    if (rmf_lastNotify?.at) last = Math.max(last, rmf_lastNotify.at);
  } catch { /* session unavailable — fall back to in-memory */ }
  if (now - last < 30_000) return; // global throttle: at most 1 / 30s
  lastNotifyAt = now;
  // Observable record (also handy for the popup / tests) — always written when notified.
  try { chrome.storage.session.set({ rmf_lastNotify: { ai: count, at: now } }); } catch { /* noop */ }
  if (!chrome.notifications) return;
  const title = STRINGS?.notify?.title
    ? (typeof STRINGS.notify.title === 'function' ? STRINGS.notify.title() : STRINGS.notify.title)
    : 'TrueKart';
  const message = STRINGS?.notify?.body ? STRINGS.notify.body(count) : `${count} AI image(s) on this page`;
  try {
    chrome.notifications.create('', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title,
      message,
      priority: 0,
    });
  } catch { /* notifications unavailable */ }
}

// ---- toolbar badge (per-tab AI count) -------------------------------------
// Gives a glanceable, persistent indicator of what was found on the current
// tab — the thing Capital One Shopping users say is missing.
function updateBadge(tabId, info) {
  if (tabId == null) return;
  const ai = Number(info?.ai) || 0;
  const aiHigh = Number(info?.aiHigh) || 0;
  const aiLikely = Number(info?.aiLikely) || 0;
  const scanned = Number(info?.scanned) || 0;
  const active = info?.active !== false;
  const text = active && ai > 0 ? String(ai) : '';
  const title = STRINGS
    ? (active ? STRINGS.badge.title(ai, scanned) : STRINGS.badge.titleOff())
    : 'TrueKart';
  let color = '#e24b4a';
  if (active && ai > 0) {
    color = aiHigh > 0 ? '#e24b4a' : '#EF9F27';
  }
  try { chrome.action.setBadgeText({ tabId, text }); } catch { /* tab gone */ }
  try { chrome.action.setBadgeBackgroundColor({ tabId, color }); } catch { /* noop */ }
  try { chrome.action.setTitle({ tabId, title }); } catch { /* noop */ }
}

function clearBadge(tabId) {
  if (tabId == null) return;
  try { chrome.action.setBadgeText({ tabId, text: '' }); } catch { /* noop */ }
}

if (typeof chrome !== 'undefined' && chrome.tabs) {
  chrome.tabs.onActivated.addListener(({ tabId }) => clearBadge(tabId));
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'loading') clearBadge(tabId);
  });
}

// ---- engine health (surfaced to the popup) --------------------------------
// Persisted in storage.session so it survives a service-worker restart within
// the same browser session but never leaks to disk.
async function setHealth(patch) {
  try {
    const cur = (await chrome.storage.session.get('engineHealth')).engineHealth || {};
    await chrome.storage.session.set({ engineHealth: { ...cur, ...patch, at: Date.now() } });
  } catch { /* storage.session unavailable (older Chrome) — non-fatal */ }
}

async function recordOk(provider) {
  await setHealth({ provider, status: 'ok', error: '' });
}

async function recordError(provider, error) {
  await setHealth({ provider, status: 'error', error: String(error || 'Unknown error') });
}

// Map raw HTTP failures to short, human messages the popup can show verbatim.
function friendlyHfError(status, body) {
  if (status === 401 || status === 403) return 'Invalid token — check it has “Inference” access';
  if (status === 404) return 'Model not found on Hugging Face';
  if (status === 410) return 'Model no longer served by HF Inference — try another model';
  if (status === 429) return 'Rate limit reached — wait a minute or upgrade to HF PRO';
  if (status === 503) return 'Model is warming up — retry in ~20s';
  if (status >= 500) return 'Hugging Face is having issues — try again shortly';
  return `Hugging Face error (${status})` + (body ? `: ${String(body).slice(0, 80)}` : '');
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
  if (!Array.isArray(arr)) throw new Error('Unexpected response from model');
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
  if (aiScore === null) throw new Error('Model returned no AI/real labels');
  const confidence = Math.round(aiScore * 100);
  return { isAI: confidence >= 50, confidence, source: 'huggingface' };
}

// POST one image blob to one model (with cold-start 503 retry). A Blob is
// immutable and reusable, so the ensemble reuses a single blob across models.
async function postHfBlob(blob, token, model) {
  const endpoint = HF_INFERENCE_BASE + model;
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
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(friendlyHfError(res.status, body));
    }
    return parseHfResult(await res.json());
  }
  throw new Error('Model is warming up — retry in ~20s');
}

// Max-score ensemble: same image, N models, highest AI confidence wins.
// Precision-preserving (both models rarely false-fire), recall-lifting.
async function postHfEnsembleBlob(blob, token, models) {
  const parts = [];
  for (const m of models) {
    const r = await postHfBlob(blob, token, m);
    parts.push({ model: m, confidence: r.confidence });
  }
  const top = parts.reduce((a, b) => (b.confidence > a.confidence ? b : a));
  return {
    isAI: top.confidence >= 50,
    confidence: top.confidence,
    source: 'huggingface',
    model: top.model,
    ensemble: parts,
  };
}

async function detectHuggingFace(url, token, model) {
  const imgRes = await fetchImage(url);
  return postHfBlob(await imgRes.blob(), token, model);
}

async function detectHfEnsemble(url, token, models) {
  const imgRes = await fetchImage(url);
  return postHfEnsembleBlob(await imgRes.blob(), token, models);
}

// Which models to run, given config. Returns [primary] or [primary, secondary].
function hfModelsFor(cfg) {
  const model = cfg.hfModel || DEFAULTS.hfModel;
  if (cfg.hfEnsemble && cfg.hfModel2 && cfg.hfModel2 !== model) {
    return [model, cfg.hfModel2];
  }
  return [model];
}

async function detectFromDataUrl(dataUrl) {
  if (!dataUrl || !String(dataUrl).startsWith('data:image/')) {
    return { error: 'Invalid image data' };
  }
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  try {
    if (cfg.provider === 'huggingface' && cfg.hfToken) {
      const models = hfModelsFor(cfg);
      const blob = await (await fetch(dataUrl)).blob();
      const r = models.length > 1
        ? await postHfEnsembleBlob(blob, cfg.hfToken, models)
        : await postHfBlob(blob, cfg.hfToken, models[0]);
      r.model = r.model || models[0];
      await recordOk('huggingface');
      return { result: r };
    }
  } catch (err) {
    await recordError(cfg.provider, err && err.message);
    return { error: String((err && err.message) || err) };
  }
  return { error: 'Connect Hugging Face in Settings for image checks' };
}

// ---- remote dispatch ------------------------------------------------------
async function remoteDetect(url) {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  try {
    if (cfg.provider === 'huggingface' && cfg.hfToken) {
      const models = hfModelsFor(cfg);
      const r = models.length > 1
        ? await detectHfEnsemble(url, cfg.hfToken, models)
        : await detectHuggingFace(url, cfg.hfToken, models[0]);
      r.model = r.model || models[0]; // surfaced in the "why flagged?" popover
      await recordOk('huggingface');
      return { result: r };
    }
  } catch (err) {
    await recordError(cfg.provider, err && err.message);
    return { error: String((err && err.message) || err) };
  }
  return { noProvider: true }; // caller falls back to the heuristic
}

// ---- credential validation (live test call) -------------------------------
async function validateHuggingFace(token) {
  if (!/^hf_[A-Za-z0-9]+$/.test(token)) {
    return { ok: false, error: 'Token must start with “hf_”' };
  }
  try {
    const res = await fetch(HF_WHOAMI, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'Token rejected by Hugging Face' };
    }
    if (!res.ok) return { ok: false, error: `Hugging Face error (${res.status})` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, user: data?.name || data?.fullname || '' };
  } catch (err) {
    return { ok: false, error: 'Network error — could not reach Hugging Face' };
  }
}

// ---- keyboard shortcut (toggle detection) ---------------------------------
async function toggleEnabled() {
  const { enabled } = await chrome.storage.sync.get({ enabled: true });
  const next = !enabled;
  await chrome.storage.sync.set({ enabled: next });
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'SET_ENABLED', enabled: next }).catch(() => {});
    }
  } catch { /* no addressable tab */ }
  return next;
}

if (typeof chrome !== 'undefined' && chrome.commands?.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-detection') toggleEnabled();
  });
}

// ---- message router -------------------------------------------------------
function registerMessageRouter() {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'RMF_FETCH_IMAGE' && msg.url) {
    if (!isAllowedHttpUrl(msg.url)) { sendResponse({ ok: false, error: 'blocked URL' }); return true; }
    fetchImageAsDataUrl(msg.url)
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true;
  }
  if (msg?.type === 'RMF_REMOTE_DETECT' && msg.url) {
    if (!isAllowedHttpUrl(msg.url)) { sendResponse({ ok: false, error: 'blocked URL' }); return true; }
    remoteDetect(msg.url)
      .then((out) => {
        if (out.result) sendResponse({ ok: true, result: out.result });
        else if (out.noProvider) sendResponse({ ok: false, reason: 'no-provider' });
        else sendResponse({ ok: false, error: out.error });
      })
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true;
  }
  if (msg?.type === 'RMF_DETECT_DATA' && msg.dataUrl) {
    detectFromDataUrl(msg.dataUrl)
      .then((out) => {
        if (out.result) sendResponse({ ok: true, result: out.result });
        else sendResponse({ ok: false, error: out.error || 'Detection failed' });
      })
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true;
  }
  if (msg?.type === 'RMF_VALIDATE') {
    validateHuggingFace(msg.token)
      .then((r) => sendResponse(r))
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true;
  }
  if (msg?.type === 'RMF_TOGGLE_ENABLED') {
    toggleEnabled().then((enabled) => sendResponse({ ok: true, enabled }))
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true;
  }
  if (msg?.type === 'RMF_BADGE') {
    updateBadge(_sender?.tab?.id, msg);
    return false; // fire-and-forget
  }
  if (msg?.type === 'RMF_HISTORY_ADD') {
    addHistory(msg.entry);
    return false; // fire-and-forget
  }
  if (msg?.type === 'RMF_NOTIFY') {
    notifyAI(msg.ai);
    return false; // fire-and-forget
  }
  if (msg?.type === 'RMF_ENGINE_HEALTH') {
    chrome.storage.session.get('engineHealth')
      .then((r) => sendResponse({ ok: true, health: r.engineHealth || null }))
      .catch(() => sendResponse({ ok: true, health: null }));
    return true;
  }
  if (msg?.type === 'RMF_COMPARE_SEARCH' && msg.product) {
    handleCompareSearch(msg)
      .then((r) => sendResponse(r))
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true;
  }
  if (msg?.type === 'RMF_GET_SELLERS') {
    const Trust = (typeof self !== 'undefined' && self.RMF_TrustStorage) || null;
    (Trust ? Trust.getSellerList() : Promise.resolve([]))
      .then((list) => sendResponse({ ok: true, sellers: list }))
      .catch(() => sendResponse({ ok: true, sellers: [] }));
    return true;
  }
  if (msg?.type === 'RMF_GET_CORRECTIONS') {
    const Trust = (typeof self !== 'undefined' && self.RMF_TrustStorage) || null;
    (Trust ? Trust.getCorrections() : Promise.resolve([]))
      .then((list) => sendResponse({ ok: true, corrections: list }))
      .catch(() => sendResponse({ ok: true, corrections: [] }));
    return true;
  }
  if (msg?.type === 'RMF_RUN_IMAGE_CHECK' && msg.tabId && msg.url) {
    if (!isAllowedHttpUrl(msg.url)) { sendResponse({ ok: false, error: 'blocked URL' }); return true; }
    checkImageFromContextMenu(msg.tabId, msg.url)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true;
  }
  return false;
  });
}
registerMessageRouter();

// ---- cross-marketplace product search -------------------------------------

async function handleCompareSearch(msg) {
  if (!CompareSearch) {
    return { ok: false, error: 'Compare module failed to load — reload the extension' };
  }
  const product = msg.product;
  const fingerprint = product?.fingerprint
    || (ProductFingerprint?.productFingerprint ? ProductFingerprint.productFingerprint(product) : '');
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  const sites = Array.isArray(msg.sites) && msg.sites.length
    ? msg.sites
    : (cfg.compareSites || DEFAULTS.compareSites);
  const serpApiKey = msg.serpApiKey || cfg.serpApiKey || '';

  const tabFetchFn = (TabSearch && chrome.tabs?.create && chrome.scripting?.executeScript)
    ? TabSearch.fetchSearchPageViaTab
    : null;

  if (typeof self !== 'undefined') {
    self.RMF_FetchImage = { fetchImageAsDataUrl, isAllowedHttpUrl };
  }

  const useClip = cfg.compareUseClip !== false && !!product?.image;
  if (useClip && ClipBridge?.warmupClip) {
    ClipBridge.warmupClip().catch((err) => {
      console.warn('[RMF Compare] CLIP warmup:', err?.message || err);
    });
  }

  const data = await CompareSearch.searchAll(product, sites, {
    tabFetchFn,
    compareUseTabs: cfg.compareUseTabs === true,
    serpApiKey,
    clipBridge: ClipBridge,
    useClip,
    debug: cfg.compareDebugLog === true,
  });
  return { ok: true, productFingerprint: fingerprint, ...data };
}

// Exposed for unit tests when this file is required under Node. In the service
// worker `module` is undefined, so this is a no-op there.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isAllowedHttpUrl, parseHfResult, friendlyHfError };
}
