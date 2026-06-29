// popup/popup.js
const CACHE_PREFIX = 'rmf_cache_';
const DEFAULTS = {
  enabled: true, mode: 'badge', provider: 'heuristic',
  hfToken: '', hfModel: 'Organika/sdxl-detector', hfVerified: false, hfUser: '',
};
const PROVIDERS = ['huggingface', 'heuristic'];
const MODES = ['all', 'badge', 'hide'];

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);

let state = { ...DEFAULTS };
let health = null;

document.addEventListener('DOMContentLoaded', async () => {
  state = await chrome.storage.sync.get(DEFAULTS);

  $('toggle-enabled').checked = state.enabled;
  $('hf-token').value = state.hfToken || '';
  $('hf-model').value = state.hfModel && state.hfModel !== DEFAULTS.hfModel ? state.hfModel : '';

  await refreshHealth();
  renderStatus();
  updateStats();

  // master enable / disable
  $('toggle-enabled').addEventListener('change', async (e) => {
    state.enabled = e.target.checked;
    await chrome.storage.sync.set({ enabled: state.enabled });
    sendToActiveTab({ type: 'SET_ENABLED', enabled: state.enabled });
    renderStatus();
  });

  // provider tabs — switching shows the panel; the engine only becomes active
  // once a key is verified (or Preview is chosen).
  setupRovingGroup('provider-seg', PROVIDERS, async (p) => {
    showPanel(p);
    if (p === 'heuristic') {
      state.provider = 'heuristic';
      await chrome.storage.sync.set({ provider: 'heuristic' });
      renderStatus();
    }
  });

  // display mode radiogroup
  setupRovingGroup('mode-seg', MODES, async (mode) => {
    state.mode = mode;
    await chrome.storage.sync.set({ mode });
    setActiveMode(mode);
    sendToActiveTab({ type: 'SET_MODE', mode });
  }, 'radio');

  // Apply the persisted selection AFTER wiring the roving groups, so the active
  // tab/radio keeps its aria-selected/aria-checked + focusable tabindex.
  setActiveProvider(state.provider);
  setActiveMode(state.mode);

  $('hf-save').addEventListener('click', connectHuggingFace);
  $('hf-token').addEventListener('keydown', (e) => { if (e.key === 'Enter') connectHuggingFace(); });

  // show / hide token
  $('hf-token-toggle').addEventListener('click', () => {
    const f = $('hf-token');
    const show = f.type === 'password';
    f.type = show ? 'text' : 'password';
    $('hf-token-toggle').textContent = show ? 'hide' : 'show';
    $('hf-token-toggle').setAttribute('aria-pressed', String(show));
  });

  // CTA from preview panel → jump to HF
  $('goto-hf').addEventListener('click', () => {
    setActiveProvider('huggingface');
    focusTab('huggingface');
    $('hf-token').focus();
  });

  // rescan the current page
  $('rescan').addEventListener('click', async () => {
    const S = window.RMF_STRINGS;
    await sendToActiveTab({ type: 'RESCAN' });
    if (S) toast(S.summary.rescanDone);
    setTimeout(updateStats, 800);
  });

  // export the current page's scan results
  $('export-json').addEventListener('click', () => exportPage('json'));
  $('export-csv').addEventListener('click', () => exportPage('csv'));

  // open full settings (options page)
  $('open-settings').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    else window.open(chrome.runtime.getURL('options/options.html'));
  });

  // clear cache
  $('clear-cache').addEventListener('click', async () => {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
    await chrome.storage.local.remove(keys);
    toast(`Cleared ${keys.length} cached`);
    updateStats();
  });
});

// ---- connection flows -----------------------------------------------------
async function connectHuggingFace() {
  const token = $('hf-token').value.trim();
  const model = $('hf-model').value.trim() || DEFAULTS.hfModel;
  clearFeedback('hf');
  $('hf-token').removeAttribute('aria-invalid');

  if (!token) {
    $('hf-token').setAttribute('aria-invalid', 'true');
    feedback('hf', 'err', 'Enter your hf_ token first');
    return toast('Enter your hf_ token first', true);
  }
  if (!/^hf_/.test(token)) {
    $('hf-token').setAttribute('aria-invalid', 'true');
    feedback('hf', 'err', 'Token should start with “hf_”');
    return toast('Token should start with “hf_”', true);
  }

  setBusy('hf-save', true);
  const r = await send({ type: 'RMF_VALIDATE', provider: 'huggingface', token });
  setBusy('hf-save', false);

  if (!r || !r.ok) {
    $('hf-token').setAttribute('aria-invalid', 'true');
    feedback('hf', 'err', (r && r.error) || 'Could not verify token');
    return toast((r && r.error) || 'Connection failed', true);
  }

  const modelChanged = model !== (state.hfModel || '');
  state = { ...state, provider: 'huggingface', hfToken: token, hfModel: model, hfVerified: true, hfUser: r.user || '' };
  await chrome.storage.sync.set({
    provider: 'huggingface', hfToken: token, hfModel: model, hfVerified: true, hfUser: r.user || '',
  });
  health = null; // a fresh, verified token clears any stale error

  // A different model produces different verdicts — drop cached results so the
  // switch takes effect immediately instead of replaying the old model's badges.
  if (modelChanged) {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
    if (keys.length) await chrome.storage.local.remove(keys);
    updateStats();
  }

  feedback('hf', 'ok', r.user ? `Connected as ${r.user}` : 'Token verified — you’re connected');
  renderStatus();
  toast(modelChanged ? 'Connected · cache cleared — reload the page' : 'Hugging Face connected');
}

// ---- panels / tabs --------------------------------------------------------
function showPanel(provider) {
  PROVIDERS.forEach((p) => { $(`panel-${p}`).hidden = p !== provider; });
}

function focusTab(provider) {
  const seg = $('provider-seg');
  seg.querySelectorAll('.seg').forEach((b) => {
    const on = b.dataset.provider === provider;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}

function setActiveProvider(provider) {
  showPanel(provider);
  focusTab(provider);
}

function setActiveMode(mode) {
  $('mode-seg').querySelectorAll('.seg').forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}

// Generic roving-tabindex keyboard handler for a segmented group.
function setupRovingGroup(groupId, values, onSelect, kind = 'tab') {
  const group = $(groupId);
  const btns = Array.from(group.querySelectorAll('.seg'));
  const valueOf = (b) => b.dataset.provider || b.dataset.mode;
  btns.forEach((btn) => {
    if (kind === 'tab') btn.setAttribute('aria-selected', 'false');
    else btn.setAttribute('aria-checked', 'false');
    btn.tabIndex = -1;
    btn.addEventListener('click', () => {
      btns.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute(kind === 'tab' ? 'aria-selected' : 'aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      onSelect(valueOf(btn));
    });
    btn.addEventListener('keydown', (e) => {
      const i = btns.indexOf(btn);
      let j = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % btns.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + btns.length) % btns.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = btns.length - 1;
      if (j === null) return;
      e.preventDefault();
      btns[j].focus();
      btns[j].click();
    });
  });
}

// ---- status ---------------------------------------------------------------
function renderStatus() {
  const card = $('status-card');
  let stateName, title, sub, chip;

  const hfReady = state.provider === 'huggingface' && state.hfToken;
  const verified = state.provider === 'huggingface' && state.hfVerified;
  const healthErr = health && health.provider === state.provider && health.status === 'error';

  if (!state.enabled) {
    stateName = 'off'; title = 'Detection paused'; sub = 'Toggle on to scan images'; chip = 'Off';
  } else if (hfReady && verified && healthErr) {
    stateName = 'error'; title = 'Hugging Face';
    sub = health.error || 'Last scan failed'; chip = 'Error';
  } else if (hfReady && verified) {
    stateName = 'good'; title = 'Hugging Face';
    sub = state.hfUser ? `${state.hfUser} · ${state.hfModel || DEFAULTS.hfModel}` : (state.hfModel || DEFAULTS.hfModel);
    chip = 'Connected';
  } else if (hfReady) {
    stateName = 'warn'; title = 'Hugging Face';
    sub = 'Saved — reconnect to verify'; chip = 'Unverified';
  } else {
    stateName = 'warn'; title = 'Preview heuristic'; sub = 'Low accuracy — connect a model'; chip = 'Preview';
  }

  card.dataset.state = stateName;
  $('status-title').textContent = title;
  $('status-sub').textContent = sub;
  $('status-sub').title = sub;
  $('status-chip').textContent = chip;
}

async function refreshHealth() {
  const r = await send({ type: 'RMF_ENGINE_HEALTH' });
  health = (r && r.ok) ? r.health : null;
}

// ---- tabs / stats ---------------------------------------------------------
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToActiveTab(message) {
  const tab = await getActiveTab();
  if (tab?.id) {
    try { await chrome.tabs.sendMessage(tab.id, message); } catch { /* no content script here */ }
  }
}

async function updateStats() {
  const all = await chrome.storage.local.get(null);
  const cacheCount = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX)).length;
  $('cache-count').textContent = cacheCount;

  let live = { scanned: 0, ai: 0 };
  let onSupportedPage = false;
  const tab = await getActiveTab();
  if (tab?.id) {
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' });
      if (resp) { live = resp; onSupportedPage = true; }
    } catch { /* unsupported page */ }
  }
  $('ai-count').textContent = live.ai ?? 0;
  $('total-count').textContent = live.scanned ?? 0;

  // Page scan summary (only meaningful on a supported page).
  const S = window.RMF_STRINGS;
  const summary = $('scan-summary');
  if (onSupportedPage && S) {
    summary.hidden = false;
    $('empty-hint').hidden = true;
    $('scan-summary-text').textContent = !state.enabled
      ? S.summary.paused
      : (live.scanned > 0 ? S.summary.result(live.ai || 0, live.scanned) : S.summary.none);
    $('rescan').hidden = !state.enabled;
    $('export-row').hidden = !(state.enabled && live.scanned > 0);
  } else {
    summary.hidden = true;
    $('export-row').hidden = true;
    // Empty-state hint when nothing has been scanned anywhere yet.
    $('empty-hint').hidden = cacheCount > 0;
  }
}

// ---- ui helpers -----------------------------------------------------------
function setBusy(btnId, busy) {
  const b = $(btnId);
  b.setAttribute('aria-busy', String(busy));
  b.disabled = busy;
}

function feedback(ns, kind, msg) {
  const el = $(`${ns}-feedback`);
  el.className = 'feedback ' + kind;
  el.textContent = msg;
  el.hidden = false;
}

function clearFeedback(ns) {
  const el = $(`${ns}-feedback`);
  el.hidden = true;
  el.textContent = '';
}

async function exportPage(format) {
  const S = window.RMF_STRINGS;
  const tab = await getActiveTab();
  let report = null;
  try { report = tab?.id ? await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_REPORT' }) : null; }
  catch { /* unsupported page */ }

  if (!report || !report.products || !report.products.length) {
    return toast((S && S.exportUI.empty) || 'Nothing to export yet', true);
  }

  const R = window.RMF_Report;
  const isCsv = format === 'csv';
  const data = isCsv ? R.buildCsv(report) : R.buildJson(report);
  const blob = new Blob([data], { type: isCsv ? 'text/csv' : 'application/json' });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `shopshield-${report.site}-${stamp}.${isCsv ? 'csv' : 'json'}`);
  toast((S && S.exportUI.done(report.products.length)) || `Exported ${report.products.length}`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function toast(msg, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.textContent = msg;
  $('toast-host').appendChild(t);
  setTimeout(() => t.remove(), 2400);
}
