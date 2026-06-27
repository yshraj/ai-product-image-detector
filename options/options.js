// options/options.js — full settings surface. All preferences autosave to
// chrome.storage.sync; content scripts react live via storage.onChanged.
const CACHE_PREFIX = 'rmf_cache_';
const ALL_SITES = ['myntra', 'flipkart', 'meesho', 'nykaa'];
const DEFAULTS = {
  enabled: true, mode: 'badge', provider: 'heuristic',
  hfToken: '', hfModel: 'haywoodsloan/ai-image-detector-deploy', hfVerified: false, hfUser: '',
  minConfidence: 70, disabledSites: [],
};
// Keys that are safe to export/import (never the token).
const PORTABLE_KEYS = ['enabled', 'mode', 'minConfidence', 'disabledSites', 'hfModel'];

const $ = (id) => document.getElementById(id);
let state = { ...DEFAULTS };

document.addEventListener('DOMContentLoaded', async () => {
  state = await chrome.storage.sync.get(DEFAULTS);
  renderEngine();
  renderPrefs();
  updateStats();
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
  state = { ...state, ...patch };
  await chrome.storage.sync.set(patch);
  flashSaved();
}

function flashSaved() {
  const el = $('saved-flag');
  el.hidden = false; el.classList.add('show');
  clearTimeout(flashSaved._t);
  flashSaved._t = setTimeout(() => el.classList.remove('show'), 1200);
}

function wireEvents() {
  $('opt-enabled').addEventListener('change', (e) => save({ enabled: e.target.checked }));

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
  const blob = new Blob([JSON.stringify({ app: 'RealModel Filter', version: '1.3.0', settings: out }, null, 2)],
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'realmodel-filter-settings.json';
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
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const incoming = (parsed && typeof parsed === 'object' && parsed.settings) || parsed;
      if (!incoming || typeof incoming !== 'object') throw new Error('not an object');
      const patch = sanitizeImport(incoming);
      if (!Object.keys(patch).length) throw new Error('no valid settings');
      await save(patch);
      renderPrefs();
      toast('Settings imported');
    } catch {
      toast('That file isn’t a valid settings export', true);
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
function toast(msg, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.textContent = msg;
  $('toast-host').appendChild(t);
  setTimeout(() => t.remove(), 2400);
}
