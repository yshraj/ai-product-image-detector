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
      '../utils/ondevice-config.js',
      '../detection/ondevice/model-store.js',
      '../detection/ondevice/download-manager.js',
      '../detection/ondevice/engine.js',
    );
  }
} catch (e) {
  console.error('[RMF] worker modules failed to load:', e);
}
const Ondevice = (typeof self !== 'undefined' && self.RMF_OndeviceEngine) || null;
const STRINGS = (typeof self !== 'undefined' && self.RMF_STRINGS) || null;

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
  notifyOnAI: false,
  ondeviceModelUrl: '',
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
  });
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
    // getKeys() (Chrome 130+) avoids deserializing every stored verdict value.
    const keys = chrome.storage.local.getKeys
      ? (await chrome.storage.local.getKeys()).filter((k) => k.startsWith(CACHE_PREFIX))
      : Object.keys(await chrome.storage.local.get(null)).filter((k) => k.startsWith(CACHE_PREFIX));
    if (keys.length) await chrome.storage.local.remove(keys);
    return keys.length;
  } catch { return 0; }
}

function isPrivateIpv4Octets(a, b) {
  if (a === 0 || a === 127 || a === 10) return true;                // this-host / loopback / private
  if (a === 169 && b === 254) return true;                          // link-local (cloud metadata)
  if (a === 192 && b === 168) return true;                          // private
  if (a === 172 && b >= 16 && b <= 31) return true;                 // private
  if (a >= 224) return true;                                        // multicast / reserved
  return false;
}

// Expands a bracket-stripped IPv6 literal (as normalized by the WHATWG URL
// parser, e.g. "fe80::1") into 8 hex groups, or null if it doesn't look like one.
function expandIpv6Groups(inner) {
  if (!inner.includes(':')) return null;
  const [head, tail] = inner.includes('::') ? inner.split('::') : [inner, undefined];
  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail !== undefined ? tail.split(':').filter(Boolean) : [];
  if (tail === undefined) return headParts.length === 8 ? headParts : null;
  const missing = 8 - headParts.length - tailParts.length;
  if (missing < 0) return null;
  return [...headParts, ...Array(missing).fill('0'), ...tailParts];
}

function isPrivateIpv6(hostnameNoBrackets) {
  const groups = expandIpv6Groups(hostnameNoBrackets);
  if (!groups) return false;
  const nums = groups.map((g) => parseInt(g || '0', 16));
  if (nums.every((n) => n === 0)) return true;                        // :: (unspecified)
  if (nums.slice(0, 7).every((n) => n === 0) && nums[7] === 1) return true; // ::1 (loopback)
  if ((nums[0] & 0xffc0) === 0xfe80) return true;                     // fe80::/10 link-local
  if ((nums[0] & 0xfe00) === 0xfc00) return true;                     // fc00::/7 unique local
  if ((nums[0] & 0xff00) === 0xff00) return true;                     // ff00::/8 multicast
  // IPv4-mapped (::ffff:a.b.c.d) or deprecated IPv4-compatible (::a.b.c.d) —
  // check the embedded IPv4 address against the same private ranges.
  if (nums.slice(0, 5).every((n) => n === 0) && (nums[5] === 0 || nums[5] === 0xffff)) {
    const a = (nums[6] >> 8) & 0xff;
    const b = nums[6] & 0xff;
    if (isPrivateIpv4Octets(a, b)) return true;
  }
  return false;
}

// Defence-in-depth: the worker has broad fetch ability (host_permissions bypass
// page CORS), so only ever fetch public http(s) URLs. This blocks a compromised
// page from coaxing the worker into hitting loopback/private-network addresses
// or non-http schemes (an SSRF / CORS-bypass-proxy abuse surface).
//
// Known limitation: this is a hostname-string check, not a resolved-IP check.
// A public hostname whose DNS record points at a private address (DNS
// rebinding) is not caught here — the extension has no API to pin the
// resolved IP before `fetch()` runs. Alternate IPv4 encodings (decimal,
// octal, hex, short-form) don't need separate handling: the WHATWG URL
// parser (`new URL()`) already canonicalizes them to dotted-quad in
// `url.hostname` before this function ever sees them.
function isAllowedHttpUrl(u) {
  let url;
  try { url = new URL(u); } catch { return false; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const h = url.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return false;
  if (h.startsWith('[') && h.endsWith(']')) {
    return !isPrivateIpv6(h.slice(1, -1));
  }
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m && isPrivateIpv4Octets(+m[1], +m[2])) return false;
  return true;
}

/** Reject messages from contexts outside this extension. */
function isTrustedSender(sender) {
  return typeof chrome !== 'undefined' && sender?.id === chrome.runtime.id;
}

/** Upper bound on context-menu / inline detect payloads (~9 MiB decoded). */
const MAX_DETECT_DATA_URL_LEN = 12 * 1024 * 1024;

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

const MAX_IMAGE_REDIRECTS = 5;

async function fetchImage(url) {
  let current = url;
  for (let hop = 0; hop <= MAX_IMAGE_REDIRECTS; hop++) {
    if (!isAllowedHttpUrl(current)) throw new Error('blocked URL');
    const res = await fetch(current, { credentials: 'omit', redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('Location');
      if (!loc) throw new Error('redirect without Location');
      current = new URL(loc, current).href;
      continue;
    }
    if (!res.ok) throw new Error('image HTTP ' + res.status);
    return res;
  }
  throw new Error('too many redirects');
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

// Hugging Face's inference endpoint rejects some image content types — notably
// image/avif, which AliExpress/Amazon/Temu increasingly serve ("Content type
// image/avif not supported"). Transcode anything outside a known-good set to
// JPEG in-worker (createImageBitmap + OffscreenCanvas are available in MV3
// service workers, and Chrome can decode AVIF/WebP). On any failure we return
// the original blob so behaviour is never worse than before.
const HF_SAFE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
async function toHfCompatibleBlob(blob) {
  if (blob && HF_SAFE_TYPES.has(blob.type)) return blob;
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  } catch {
    return blob;
  }
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
  return postHfBlob(await toHfCompatibleBlob(await imgRes.blob()), token, model);
}

async function detectHfEnsemble(url, token, models) {
  const imgRes = await fetchImage(url);
  return postHfEnsembleBlob(await toHfCompatibleBlob(await imgRes.blob()), token, models);
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
    if (cfg.provider === 'ondevice' && Ondevice) {
      const out = await Ondevice.detect(dataUrl);
      if (out.result) { await recordOk('ondevice'); return { result: out.result }; }
      return { error: 'On-device model not ready — download it in Settings' };
    }
    if (cfg.provider === 'huggingface' && cfg.hfToken) {
      const models = hfModelsFor(cfg);
      const blob = await toHfCompatibleBlob(await (await fetch(dataUrl)).blob());
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
    if (cfg.provider === 'ondevice' && Ondevice) {
      // On-device is the authoritative path when selected. If the model isn't
      // downloaded yet (or the runtime isn't bundled) fall back to the preview
      // heuristic — the popup surfaces download status separately.
      const dataUrl = await fetchImageAsDataUrl(url);
      const out = await Ondevice.detect(dataUrl);
      if (out.result) { await recordOk('ondevice'); return { result: out.result }; }
      return { noProvider: true };
    }
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

// Force a full-page scan of the active tab (keyboard shortcut). Mirrors the
// popup's "Scan whole page" button: fire-and-forget SCAN_PAGE to the content
// script, which walks the page and scans off-screen cards too. No-ops safely on
// unsupported tabs (no content script → sendMessage rejects, caught).
async function scanActivePage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE' }).catch(() => {});
  } catch { /* no addressable tab */ }
}
if (typeof self !== 'undefined') self.scanActivePage = scanActivePage;

if (typeof chrome !== 'undefined' && chrome.commands?.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-detection') toggleEnabled();
    else if (command === 'scan-page') scanActivePage();
  });
}

// ---- message router -------------------------------------------------------
function registerMessageRouter() {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!isTrustedSender(_sender)) return false;
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
    if (String(msg.dataUrl).length > MAX_DETECT_DATA_URL_LEN) {
      sendResponse({ ok: false, error: 'Image too large' });
      return true;
    }
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
  if (msg?.type === 'RMF_ONDEVICE_STATUS') {
    // "available" = the on-device engine can actually run in this build: the
    // engine module is loaded AND the offscreen API is present (which requires
    // the "offscreen" manifest permission + bundled ONNX Runtime). In the lean
    // default build it is false, so the UI hides the on-device controls.
    const available = !!Ondevice && !!(chrome.offscreen && chrome.offscreen.createDocument);
    (Ondevice ? Ondevice.refreshStatusFromCache() : Promise.resolve({ phase: 'runtimeMissing' }))
      .then((s) => sendResponse({ ok: true, status: s, available }))
      .catch(() => sendResponse({ ok: true, status: { phase: 'error' }, available }));
    return true;
  }
  if (msg?.type === 'RMF_ONDEVICE_START') {
    if (!Ondevice) { sendResponse({ ok: false, error: 'On-device engine unavailable in this build' }); return true; }
    // Long-running: kick it off and respond immediately; progress is broadcast
    // via RMF_ONDEVICE_STATUS messages. The pending fetch keeps the worker alive.
    Ondevice.startDownload().catch(() => {});
    sendResponse({ ok: true, status: Ondevice.getStatus() });
    return true;
  }
  if (msg?.type === 'RMF_ONDEVICE_CANCEL') {
    if (Ondevice) Ondevice.cancelDownload();
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === 'RMF_ONDEVICE_DELETE') {
    (Ondevice ? Ondevice.deleteModel() : Promise.resolve())
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
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

// Exposed for unit tests when this file is required under Node.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isAllowedHttpUrl,
    isTrustedSender,
    MAX_DETECT_DATA_URL_LEN,
    parseHfResult,
    friendlyHfError,
  };
}
