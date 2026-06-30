// options/options.js — full settings surface. All preferences autosave to
// chrome.storage.sync; content scripts react live via storage.onChanged.
const { SYNC_DEFAULTS, CACHE_PREFIX, HISTORY_KEY, CONTENT_SITES } = window.RMF_Defaults;
const DEFAULTS = SYNC_DEFAULTS;
const ALL_SITES = CONTENT_SITES;
// Keys that are safe to export/import (never the token).
const PORTABLE_KEYS = ['enabled', 'mode', 'minConfidence', 'disabledSites', 'hfModel'];

const $ = (id) => document.getElementById(id);
let state = { ...DEFAULTS };

document.addEventListener('DOMContentLoaded', async () => {
  const ver = chrome.runtime.getManifest().version;
  $('version').textContent = `v${ver}`;
  const aboutVer = $('about-ver');
  if (aboutVer) aboutVer.textContent = `v${ver}`;
  try {
    state = await chrome.storage.sync.get(DEFAULTS);
  } catch {
    state = { ...DEFAULTS };
    toast((window.RMF_STRINGS?.options?.saveFailed) || 'Could not load settings', true);
  }
  renderEngine();
  renderPrefs();
  updateStats();
  renderHistory();
  wireEvents();
});

// ---- engine status (read-only) -------------------------------------------
function renderEngine() {
  const chip = $('engine-chip');
  if (state.provider === 'huggingface' && state.hfToken && state.hfVerified) {
    chip.textContent = 'Connected'; chip.dataset.state = 'good';
    $('engine-sub').textContent = `Hugging Face · ${state.hfUser ? state.hfUser + ' · ' : ''}${state.hfModel || DEFAULTS.hfModel}`;
  } else if (state.provider === 'huggingface' && state.hfToken) {
    chip.textContent = 'Unverified'; chip.dataset.state = 'warn';
    $('engine-sub').textContent = 'Hugging Face — reconnect in the popup to verify';
  } else {
    chip.textContent = 'Preview'; chip.dataset.state = 'warn';
    $('engine-sub').textContent = 'On-device heuristic (low accuracy) — connect Hugging Face for real detection';
  }
}

// ---- preferences ----------------------------------------------------------
function renderPrefs() {
  $('opt-enabled').checked = state.enabled;
  $('opt-notify').checked = state.notifyOnAI === true;
  setMode(state.mode);
  $('opt-confidence').value = state.minConfidence;
  $('confidence-val').textContent = `${state.minConfidence}%`;
  const disabled = new Set(state.disabledSites || []);
  document.querySelectorAll('#site-checks input[data-site]').forEach((cb) => {
    cb.checked = !disabled.has(cb.dataset.site);
  });
}

function setMode(mode) {
  document.querySelectorAll('#mode-seg .seg').forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}

async function save(patch) {
  const prev = { ...state };
  state = { ...state, ...patch };
  try {
    await chrome.storage.sync.set(patch);
    flashSaved();
    return true;
  } catch {
    state = prev;
    toast((window.RMF_STRINGS?.options?.saveFailed) || 'Could not save settings — try again', true);
    renderPrefs();
    return false;
  }
}

function flashSaved() {
  const el = $('saved-flag');
  el.hidden = false; el.classList.add('show');
  clearTimeout(flashSaved._t);
  flashSaved._t = setTimeout(() => el.classList.remove('show'), 1200);
}

function wireEvents() {
  $('opt-enabled').addEventListener('change', (e) => save({ enabled: e.target.checked }));
  $('opt-notify').addEventListener('change', (e) => save({ notifyOnAI: e.target.checked }));

  document.querySelectorAll('#mode-seg .seg').forEach((btn) => {
    btn.addEventListener('click', () => { setMode(btn.dataset.mode); save({ mode: btn.dataset.mode }); });
    btn.addEventListener('keydown', (e) => {
      const btns = [...document.querySelectorAll('#mode-seg .seg')];
      const i = btns.indexOf(btn);
      let j = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % btns.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + btns.length) % btns.length;
      if (j === null) return;
      e.preventDefault(); btns[j].focus(); btns[j].click();
    });
  });

  const slider = $('opt-confidence');
  slider.addEventListener('input', () => { $('confidence-val').textContent = `${slider.value}%`; });
  slider.addEventListener('change', () => save({ minConfidence: Number(slider.value) }));

  document.querySelectorAll('#site-checks input[data-site]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const disabled = new Set(state.disabledSites || []);
      if (cb.checked) disabled.delete(cb.dataset.site); else disabled.add(cb.dataset.site);
      save({ disabledSites: [...disabled] });
    });
  });

  $('export-settings').addEventListener('click', exportSettings);
  $('import-settings').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', importSettings);
  $('clear-cache').addEventListener('click', clearCache);
  $('reset-all').addEventListener('click', resetAll);
  $('clear-history').addEventListener('click', clearHistory);
}

// ---- activity history -----------------------------------------------------
function relativeTime(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

async function renderHistory() {
  const S = window.RMF_STRINGS;
  const list = $('history-list');
  const empty = $('history-empty');
  list.textContent = '';
  let items = [];
  try { items = (await chrome.storage.local.get(HISTORY_KEY))[HISTORY_KEY] || []; } catch { items = []; }

  if (!items.length) {
    empty.hidden = false;
    empty.className = 'empty-state';
    empty.textContent = '';
    const ico = document.createElement('span');
    ico.className = 'empty-state-ico';
    ico.setAttribute('aria-hidden', 'true');
    ico.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    const p = document.createElement('p');
    p.textContent = (S && S.history.empty) || 'Nothing flagged yet.';
    empty.append(ico, p);
    return;
  }
  empty.hidden = true;

  for (const it of items) {
    const li = document.createElement('li');
    li.className = 'hist-item';

    const img = document.createElement('img');
    img.className = 'hist-thumb';
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.src = it.imageUrl;
    img.addEventListener('error', () => { img.replaceWith(brokenThumb()); }, { once: true });

    const body = document.createElement('div');
    body.className = 'hist-body';

    const line = document.createElement('div');
    line.className = 'hist-line';
    const verdict = document.createElement('span');
    verdict.className = 'hist-verdict ' + (it.high ? 'high' : 'med');
    verdict.textContent = (it.high ? 'AI Generated' : 'Likely AI') + ` · ${it.score}%`;
    line.appendChild(verdict);
    if (it.preview) {
      const tag = document.createElement('span');
      tag.className = 'hist-tag';
      tag.textContent = 'preview';
      line.appendChild(tag);
    }

    const meta = document.createElement('div');
    meta.className = 'hist-meta';
    const when = relativeTime(it.ts);
    const site = it.site ? it.site[0].toUpperCase() + it.site.slice(1) : 'page';
    if (it.pageUrl) {
      const a = document.createElement('a');
      a.href = it.pageUrl; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = `${site} · ${when}`;
      meta.appendChild(a);
    } else {
      meta.textContent = `${site} · ${when}`;
    }

    body.append(line, meta);
    li.append(img, body);
    list.appendChild(li);
  }
}

function brokenThumb() {
  const d = document.createElement('div');
  d.className = 'hist-thumb broken';
  d.textContent = '🖼';
  d.setAttribute('aria-hidden', 'true');
  return d;
}

async function clearHistory() {
  const S = window.RMF_STRINGS;
  await chrome.storage.local.remove(HISTORY_KEY);
  renderHistory();
  toast((S && S.history.cleared) || 'History cleared');
}

// ---- data & privacy -------------------------------------------------------
async function updateStats() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
  let ai = 0;
  for (const k of keys) if (all[k]?.data?.isAI) ai++;
  $('cache-total').textContent = keys.length;
  $('cache-ai').textContent = ai;
}

function exportSettings() {
  const out = {};
  for (const k of PORTABLE_KEYS) out[k] = state[k];
  const blob = new Blob([JSON.stringify({ app: 'ShopShield', version: chrome.runtime.getManifest().version, settings: out }, null, 2)],
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'shopshield-settings.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Settings exported');
}

// Validate + coerce each imported value. Never trust a file from disk: a
// malformed value (e.g. disabledSites that isn't an array) could otherwise be
// persisted and crash the content script on every page.
function sanitizeImport(incoming) {
  const patch = {};
  if (typeof incoming.enabled === 'boolean') patch.enabled = incoming.enabled;
  if (['all', 'badge', 'hide'].includes(incoming.mode)) patch.mode = incoming.mode;
  if (Number.isFinite(Number(incoming.minConfidence))) {
    patch.minConfidence = Math.min(95, Math.max(50, Math.round(Number(incoming.minConfidence))));
  }
  if (Array.isArray(incoming.disabledSites)) {
    patch.disabledSites = incoming.disabledSites.filter((s) => ALL_SITES.includes(s));
  }
  if (typeof incoming.hfModel === 'string' && incoming.hfModel.length > 0 && incoming.hfModel.length <= 120) {
    patch.hfModel = incoming.hfModel.trim();
  }
  return patch;
}

function importSettings(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => {
    toast((window.RMF_STRINGS?.options?.readFileFailed) || 'Could not read that file', true);
    e.target.value = '';
  };
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const incoming = (parsed && typeof parsed === 'object' && parsed.settings) || parsed;
      if (!incoming || typeof incoming !== 'object') throw new Error('not an object');
      const patch = sanitizeImport(incoming);
      if (!Object.keys(patch).length) throw new Error('no valid settings');
      if (!await save(patch)) return;
      renderPrefs();
      toast('Settings imported');
    } catch {
      toast((window.RMF_STRINGS?.options?.importInvalid) || 'That file isn’t a valid settings export', true);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

async function clearCache() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
  await chrome.storage.local.remove(keys);
  updateStats();
  toast(`Cleared ${keys.length} cached result${keys.length === 1 ? '' : 's'}`);
}

async function resetAll() {
  if (!confirm('Reset all settings to defaults? Your Hugging Face token will be removed too.')) return;
  await chrome.storage.sync.set(DEFAULTS);
  state = { ...DEFAULTS };
  renderEngine(); renderPrefs();
  toast('Settings reset to defaults');
}

// ---- toast ----------------------------------------------------------------
function toast(msg, isErr, isOk) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : isOk ? ' ok' : '');
  t.textContent = msg;
  t.setAttribute('role', isErr ? 'alert' : 'status');
  $('toast-host').appendChild(t);
  const dismiss = () => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 220);
  };
  setTimeout(dismiss, isErr ? 3200 : 2400);
}
