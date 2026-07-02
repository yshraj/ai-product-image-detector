// popup/popup.js — TrueKart popup (Scan / Settings).
const { SYNC_DEFAULTS, CACHE_PREFIX } = window.RMF_Defaults;
const DEFAULTS = SYNC_DEFAULTS;
const { isMarketplaceProductUrl, MARKETPLACE_TAB_URLS: MARKETPLACE_TABS } = window.RMF_MarketplaceUrl;
const send = window.RMF_Runtime.sendMessage;
const PROVIDERS = ['huggingface', 'heuristic'];
const MODES = ['all', 'badge', 'hide'];
const TABS = ['scan', 'settings'];

const $ = (id) => document.getElementById(id);
const S = () => window.RMF_STRINGS;

// List cached-verdict keys without deserializing every stored value.
// chrome.storage.local.getKeys() (Chrome 130+) returns keys only; the scan
// watcher polls this ~2.5×/s, so avoiding a full get(null) of history +
// corrections + every cached verdict is a real saving on busy pages.
async function getCacheKeys() {
  try {
    if (chrome.storage.local.getKeys) {
      const keys = await chrome.storage.local.getKeys();
      return keys.filter((k) => k.startsWith(CACHE_PREFIX));
    }
  } catch { /* fall through to get(null) */ }
  const all = await chrome.storage.local.get(null);
  return Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
}

let state = { ...DEFAULTS };
let health = null;
// Whether the Recent-scans list has painted real rows at least once. Gates the
// skeleton loader so it shows on first open only — not on every 400ms poll.
let scanHistoryPainted = false;

const ACTIVE_TAB_ONLY = new Set([
  'GET_STATS', 'GET_PAGE_REPORT', 'RESCAN', 'HIGHLIGHT_FILTER',
  'SET_ENABLED', 'SET_MODE', 'SET_MIN_CONFIDENCE',
]);

function isAmazonUrl(url) {
  try { return new URL(url).hostname.includes('amazon.'); } catch { return false; }
}

function isSupportedMarketplaceUrl(url) {
  return window.RMF_MarketplaceUrl?.isSupportedMarketplaceUrl?.(url) === true;
}

async function saveSync(patch) {
  state = { ...state, ...patch };
  try {
    await chrome.storage.sync.set(patch);
    return true;
  } catch {
    toast(S()?.options?.saveFailed || 'Could not save settings — try again', true);
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    state = await chrome.storage.sync.get(DEFAULTS);
  } catch {
    state = { ...DEFAULTS };
    toast(S()?.options?.saveFailed || 'Could not load settings — using defaults', true);
  }
  if (!Array.isArray(state.disabledSites)) state.disabledSites = [];

  $('toggle-enabled').checked = state.enabled;
  $('hf-token').value = state.hfToken || '';
  $('hf-model').value = state.hfModel && state.hfModel !== DEFAULTS.hfModel ? state.hfModel : '';
  $('popup-confidence').value = state.minConfidence;
  $('popup-confidence-val').textContent = `${state.minConfidence}%`;
  if ($('scan-confidence')) {
    $('scan-confidence').value = state.minConfidence;
    $('scan-confidence-val').textContent = `${state.minConfidence}%`;
  }
  if ($('notify-on-ai')) $('notify-on-ai').checked = state.notifyOnAI === true;
  if ($('hf-ensemble')) $('hf-ensemble').checked = state.hfEnsemble === true;

  const ver = chrome.runtime.getManifest().version;
  $('version').textContent = `v${ver}`;
  const strings = S();
  if (strings?.app?.tagline) $('brand-tagline').textContent = strings.app.tagline;
  applyPopupStrings(strings);

  await refreshHealth();
  renderStatus();
  setupNav();
  setupSettings();
  setupScanPanel();
  setupSupport();
  maybeShowOnboarding();
  // Paint the Recent-scans skeleton up front so the card shows structured
  // loading during the initial stats round-trip, not an empty gap.
  const shList = $('scan-history');
  const shCard = $('scan-history-card');
  if (shList && shCard) {
    shCard.hidden = false;
    renderScanHistorySkeleton(shList);
  }
  updateScan();
});

// Persistent "support the developer" footer. Provider-agnostic: the target
// comes from RMF_Defaults.SUPPORT so switching to GitHub Sponsors / Ko-fi /
// Stripe etc. needs no popup changes. Opened via chrome.tabs.create for
// deterministic behaviour from an extension popup (and a future click hook).
function setupSupport() {
  const link = $('support-link');
  if (!link) return;
  const support = window.RMF_Defaults?.SUPPORT || {};
  const url = support.url || '';
  const s = S();
  if (s?.support) {
    $('support-title').textContent = s.support.title;
    $('support-sub').textContent = s.support.subtitle;
    link.setAttribute('aria-label', s.support.aria);
  }
  if (url) link.href = url;
  link.addEventListener('click', (e) => {
    if (!url) { e.preventDefault(); return; }
    e.preventDefault();
    try { chrome.tabs.create({ url }); } catch { window.open(url, '_blank', 'noopener'); }
  });
}

function setupScanPanel() {
  const scanSlider = $('scan-confidence');
  if (scanSlider) {
    let debounce;
    scanSlider.addEventListener('input', () => {
      $('scan-confidence-val').textContent = `${scanSlider.value}%`;
    });
    scanSlider.addEventListener('change', () => {
      clearTimeout(debounce);
      debounce = setTimeout(async () => {
        const val = Number(scanSlider.value);
        state.minConfidence = val;
        $('popup-confidence').value = val;
        $('popup-confidence-val').textContent = `${val}%`;
        if (await saveSync({ minConfidence: val })) {
          sendToActiveTab({ type: 'SET_MIN_CONFIDENCE', minConfidence: val });
          updateScan();
        }
      }, 200);
    });
  }

  const scanPageBtn = $('scan-page');
  if (scanPageBtn) {
    scanPageBtn.addEventListener('click', async () => {
      const s = S();
      scanPageBtn.setAttribute('aria-busy', 'true');
      $('scan-page-label').textContent = s?.scan?.scanningAll || 'Scanning page…';
      await sendToActiveTab({ type: 'SCAN_PAGE' });
      // Poll until the page has settled (nothing pending and every card scanned),
      // mirroring the Rescan flow. scanEntirePage scrolls the page, so give it room.
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 350));
        const stats = await sendToActiveTab({ type: 'GET_STATS' });
        await updateScan();
        if (stats && !stats.pending && (Number(stats.unscanned) || 0) === 0) break;
      }
      scanPageBtn.setAttribute('aria-busy', 'false');
      await updateScan();
    });
  }

  document.querySelectorAll('.bd[data-filter]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const filter = btn.dataset.filter;
      const active = btn.classList.contains('active');
      document.querySelectorAll('.bd[data-filter]').forEach((b) => b.classList.remove('active'));
      if (!active) {
        btn.classList.add('active');
        await sendToActiveTab({ type: 'HIGHLIGHT_FILTER', filter });
      } else {
        await sendToActiveTab({ type: 'HIGHLIGHT_FILTER', filter: 'all' });
      }
    });
  });
}

async function maybeShowOnboarding() {
  const { rmf_onboarding_done: done } = await chrome.storage.local.get('rmf_onboarding_done');
  if (done) return;

  const steps = [
    { title: 'Toggle scanning', body: 'Use the switch in the header to turn AI detection on or off for this browser.' },
    { title: 'Scan products', body: 'Open <b>Scan</b> to see how many product images on the page look AI-generated.' },
    { title: 'Read the badges', body: 'Red badges = AI generated (90%+). Amber = likely AI. Tap any badge for a breakdown.' },
  ];
  let step = 0;

  const overlay = document.createElement('div');
  overlay.className = 'onboarding';
  overlay.innerHTML = `<div class="onboarding-card" role="dialog" aria-modal="true" aria-label="Welcome to TrueKart">
    <div class="onboarding-steps" aria-hidden="true"></div>
    <h3 id="onboard-title"></h3>
    <p id="onboard-body"></p>
    <div class="onboarding-actions">
      <button class="onboarding-skip" type="button">Skip</button>
      <button class="primary" type="button" id="onboard-next">Next</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const dots = overlay.querySelector('.onboarding-steps');
  steps.forEach((_, i) => {
    const d = document.createElement('span');
    d.className = 'onboarding-dot' + (i === 0 ? ' active' : '');
    dots.appendChild(d);
  });

  const finish = async () => {
    await chrome.storage.local.set({ rmf_onboarding_done: true });
    overlay.remove();
  };

  const renderStep = () => {
    const s = steps[step];
    overlay.querySelector('#onboard-title').textContent = s.title;
    overlay.querySelector('#onboard-body').innerHTML = s.body;
    overlay.querySelector('#onboard-next').textContent = step === steps.length - 1 ? 'Got it' : 'Next';
    dots.querySelectorAll('.onboarding-dot').forEach((d, i) => d.classList.toggle('active', i === step));
  };

  overlay.querySelector('.onboarding-skip').addEventListener('click', finish);
  overlay.querySelector('#onboard-next').addEventListener('click', () => {
    if (step >= steps.length - 1) finish();
    else { step++; renderStep(); }
  });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(); });
  renderStep();
  // Move focus into the dialog so keyboard/screen-reader users land on the
  // primary action instead of somewhere behind the modal.
  overlay.querySelector('#onboard-next').focus();
}

// Fill the Recent-scans list with shimmer placeholders that mirror the real
// row layout (site line + meta line). Marked aria-hidden and aria-busy so
// screen readers announce "busy" rather than reading the fake rows.
function renderScanHistorySkeleton(list, count = 3) {
  list.textContent = '';
  list.setAttribute('aria-busy', 'true');
  for (let i = 0; i < count; i++) {
    const li = document.createElement('li');
    li.className = 'sh-skel';
    li.setAttribute('aria-hidden', 'true');
    const site = document.createElement('div');
    site.className = 'sh-skel-bar sh-skel-site';
    const meta = document.createElement('div');
    meta.className = 'sh-skel-bar sh-skel-meta';
    li.append(site, meta);
    list.appendChild(li);
  }
}

async function renderScanHistory() {
  const card = $('scan-history-card');
  const list = $('scan-history');
  const empty = $('scan-history-empty');
  if (!card || !list) return;
  // First paint: reveal the card with a skeleton while the storage read
  // resolves, so the popup shows structured loading instead of an empty gap.
  // Poll-driven refreshes keep the loaded rows in place (no skeleton flash).
  if (!scanHistoryPainted) {
    card.hidden = false;
    empty.hidden = true;
    renderScanHistorySkeleton(list);
  }
  const data = await chrome.storage.local.get({ rmf_scan_history: [] });
  const raw = data.rmf_scan_history || [];
  const hist = raw.slice(0, 5);
  if (raw.length > 5) {
    chrome.storage.local.set({ rmf_scan_history: hist }).catch(() => {});
  }
  list.textContent = '';
  list.removeAttribute('aria-busy');
  scanHistoryPainted = true;
  if (!hist.length) {
    card.hidden = false;
    empty.hidden = false;
    empty.className = 'empty-hint';
    empty.textContent = S()?.scan?.historyEmpty || '';
    return;
  }
  card.hidden = false;
  empty.hidden = true;
  hist.forEach((h) => {
    const li = document.createElement('li');
    const d = new Date(h.at);
    const site = document.createElement('div');
    site.className = 'sh-site';
    site.textContent = h.site || '';
    const meta = document.createElement('div');
    meta.className = 'sh-meta';
    meta.textContent = `${h.scanned} scanned · ${h.ai} AI · ${d.toLocaleDateString()}`;
    li.append(site, meta);
    list.appendChild(li);
  });
}

// ---- bottom-nav tabs ------------------------------------------------------
function setupNav() {
  const btns = Array.from(document.querySelectorAll('.nav-btn'));
  btns.forEach((btn) => {
    btn.addEventListener('click', () => selectTab(btn.dataset.tab));
    btn.addEventListener('keydown', (e) => {
      const i = btns.indexOf(btn);
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % btns.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + btns.length) % btns.length;
      if (j === null) return;
      e.preventDefault(); btns[j].focus(); selectTab(btns[j].dataset.tab);
    });
  });
}

let scanPollId = null;

function stopScanWatcher() {
  if (scanPollId) clearInterval(scanPollId);
  scanPollId = null;
}

function startScanWatcher() {
  if (scanPollId) return;
  scanPollId = setInterval(async () => {
    if ($('panel-scan')?.hidden) {
      stopScanWatcher();
      return;
    }
    await updateScan();
  }, 400);
}

function selectTab(tab) {
  const prev = document.querySelector('.nav-btn.active')?.dataset?.tab;
  if (prev === 'scan' && tab !== 'scan') stopScanWatcher();
  TABS.forEach((t) => {
    const panel = $(`panel-${t}`);
    panel.hidden = t !== tab;
    if (t === tab) panel.setAttribute('tabindex', '-1');
  });
  document.querySelectorAll('.nav-btn').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  const main = $('main');
  if (main) main.scrollTop = 0;
  const panel = $(`panel-${tab}`);
  panel?.focus({ preventScroll: true });
  if (tab === 'scan') updateScan();
}

function updateNavBadge(live) {
  const badge = $('nav-scan-badge');
  if (!badge) return;
  const ai = Number(live?.ai) || 0;
  const high = Number(live?.aiHigh) || 0;
  if (ai > 0) {
    badge.textContent = ai > 99 ? '99+' : String(ai);
    badge.hidden = false;
    badge.classList.toggle('warn', high === 0);
  } else {
    badge.hidden = true;
  }
}

// ---- active tab / product -------------------------------------------------
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // When popup.html is opened as a tab (common in dev/E2E), fall back to the best
  // marketplace tab in this window instead of the extension page itself.
  if (tab?.url?.startsWith('chrome-extension:')) {
    const candidates = await chrome.tabs.query({ currentWindow: true, url: MARKETPLACE_TABS });
    if (!candidates.length) return tab;
    const productPages = candidates.filter((t) => isMarketplaceProductUrl(t.url));
    const pool = productPages.length ? productPages : candidates;
    pool.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    return pool[0];
  }
  return tab;
}
async function sendToActiveTab(message) {
  const tryTab = async (tab) => {
    if (!tab?.id) return null;
    try { return await chrome.tabs.sendMessage(tab.id, message); } catch { return null; }
  };

  const active = await getActiveTab();
  const activeOnly = ACTIVE_TAB_ONLY.has(message.type);
  const popupAsTab = active?.url?.startsWith('chrome-extension:');

  if (activeOnly && !popupAsTab) {
    return tryTab(active);
  }

  const primary = await tryTab(active);
  if (primary) return primary;

  const candidates = await chrome.tabs.query({ currentWindow: true, url: MARKETPLACE_TABS });
  const productish = candidates.filter((t) => isMarketplaceProductUrl(t.url));
  const pool = [...(productish.length ? productish : candidates)].reverse();
  for (const tab of pool) {
    const r = await tryTab(tab);
    if (r) return r;
  }
  return primary;
}

// ---- SCAN -----------------------------------------------------------------
function setScanProgress(done, total, pending, show) {
  const wrap = $('scan-progress');
  const label = $('scan-progress-label');
  const pctEl = $('scan-progress-pct');
  const fill = $('scan-progress-fill');
  const track = $('scan-progress-track');
  if (!wrap) return;

  if (!show) {
    wrap.hidden = true;
    stopScanWatcher();
    return;
  }

  const denom = total || done + pending || 1;
  const pct = Math.min(100, Math.max(0, Math.round((done / denom) * 100)));
  const s = S();

  wrap.hidden = false;
  if (label) label.textContent = s ? s.scan.scanning(done, total || done + pending) : `Scanning ${done} / ${total || '…'}`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (fill) fill.style.width = `${pct}%`;
  if (track) track.setAttribute('aria-valuenow', String(pct));
  startScanWatcher();
}

async function updateScan() {
  const s = S();
  $('cache-count').textContent = (await getCacheKeys()).length;

  const active = await getActiveTab();
  let live = { scanned: 0, ai: 0, aiHigh: 0, aiLikely: 0 };
  let scanReady = false;
  const stats = await sendToActiveTab({ type: 'GET_STATS' });
  if (stats) { live = stats; scanReady = true; }

  const normal = Math.max(0, (live.scanned || 0) - (live.ai || 0));
  $('bd-high').textContent = live.aiHigh || 0;
  $('bd-med').textContent = live.aiLikely || 0;
  $('bd-ok').textContent = normal;
  updateNavBadge(live);

  const total = live.total || live.scanned || 0;
  const done = live.scanned || 0;
  const pending = live.pending || 0;
  setScanProgress(done, total, pending, scanReady && state.enabled && (pending > 0 || (total > done)));

  // "Scan whole page" surfaces only when off-screen products remain unscanned.
  // Skip while a scan-all run is in flight so its live label isn't overwritten.
  const scanPageBtn = $('scan-page');
  if (scanPageBtn && scanPageBtn.getAttribute('aria-busy') !== 'true') {
    const more = Number(live.unscanned) || 0;
    const showScanAll = scanReady && state.enabled && more > 0;
    scanPageBtn.hidden = !showScanAll;
    if (showScanAll) {
      $('scan-page-label').textContent = s ? s.scan.scanAllCount(more) : `Scan whole page · ${more} more`;
    }
  }

  const hint = $('scan-hint');
  const tip = $('scan-tip');
  const confHint = $('conf-hint');
  const bd = $('breakdown');

  if (!scanReady) {
    $('scan-title').textContent = s?.app?.shortName || 'TrueKart';
    $('scan-count').textContent = '';
    bd.style.display = 'none';
    $('export-row').hidden = true;
    $('rescan').hidden = true;
    confHint.hidden = true;
    tip.hidden = true;
    hint.hidden = false;
    hint.classList.remove('is-starting');
    if (!active?.id) hint.textContent = s ? s.scan.noActiveTab : '';
    else if (isAmazonUrl(active.url)) hint.textContent = s ? s.scan.amazonLimited : '';
    else if (isSupportedMarketplaceUrl(active.url)) {
      hint.textContent = s ? s.scan.starting : '';
      hint.classList.add('is-starting');
    } else hint.textContent = s ? s.scan.unsupported : '';
    return;
  }

  bd.style.display = 'flex';
  $('rescan').hidden = false;
  confHint.hidden = false;
  confHint.textContent = s ? s.scan.confidence(state.minConfidence) : `Flagging at ${state.minConfidence}%+`;

  if (!state.enabled) {
    $('scan-title').textContent = 'Paused';
    $('scan-count').textContent = s ? s.scan.paused : '';
    hint.hidden = true;
    tip.hidden = true;
    $('export-row').hidden = true;
    return;
  }

  $('scan-title').textContent = s ? s.scan.complete : 'Scan complete';
  $('scan-count').textContent = s ? s.scan.scanned(live.scanned || 0) : `${live.scanned} scanned`;
  hint.hidden = live.scanned > 0;
  if (live.scanned === 0) hint.textContent = s ? s.scan.none : '';
  tip.hidden = !(live.ai > 0);
  if (live.ai > 0) tip.textContent = s ? s.scan.whyFlagged : 'Tap any flagged badge for Why flagged?';
  $('export-row').hidden = !(live.scanned > 0);
  await renderScanHistory();
}

function applyPopupStrings(s) {
  if (!s) return;
  const nav = s.nav || {};
  const setNavLabel = (id, text) => {
    const btn = $(id);
    const label = btn?.querySelector('span:last-child');
    if (label && text) label.textContent = text;
  };
  setNavLabel('nav-scan', nav.scan);
  setNavLabel('nav-settings', nav.settings);
}

// ---- SETTINGS (engine connect, modes, confidence, links) ------------------
function setupSettings() {
  setActiveProvider(state.provider);
  setActiveMode(state.mode);

  $('toggle-enabled').addEventListener('change', async (e) => {
    state.enabled = e.target.checked;
    if (!await saveSync({ enabled: state.enabled })) {
      e.target.checked = !state.enabled;
      state.enabled = e.target.checked;
      return;
    }
    sendToActiveTab({ type: 'SET_ENABLED', enabled: state.enabled });
    renderStatus();
    updateScan();
  });

  setupRovingGroup('provider-seg', PROVIDERS, async (p) => {
    showPanel(p);
    if (p === 'heuristic') {
      state.provider = 'heuristic';
      if (await saveSync({ provider: 'heuristic' })) renderStatus();
    }
  });
  setupRovingGroup('mode-seg', MODES, async (mode) => {
    state.mode = mode;
    if (await saveSync({ mode })) {
      setActiveMode(mode);
      sendToActiveTab({ type: 'SET_MODE', mode });
    }
  }, 'radio');
  setActiveProvider(state.provider);
  setActiveMode(state.mode);

  $('hf-save').addEventListener('click', connectHuggingFace);
  $('hf-token').addEventListener('keydown', (e) => { if (e.key === 'Enter') connectHuggingFace(); });
  $('hf-token-toggle').addEventListener('click', () => {
    const f = $('hf-token');
    const show = f.type === 'password';
    f.type = show ? 'text' : 'password';
    const btn = $('hf-token-toggle');
    btn.textContent = show ? 'hide' : 'show';
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? 'Hide access token' : 'Show access token');
  });
  $('goto-hf').addEventListener('click', () => { setActiveProvider('huggingface'); $('hf-token').focus(); });

  const slider = $('popup-confidence');
  slider.addEventListener('input', () => { $('popup-confidence-val').textContent = `${slider.value}%`; });
  slider.addEventListener('change', async () => {
    state.minConfidence = Number(slider.value);
    if (!await saveSync({ minConfidence: state.minConfidence })) return;
    if ($('scan-confidence')) {
      $('scan-confidence').value = state.minConfidence;
      $('scan-confidence-val').textContent = `${state.minConfidence}%`;
    }
    sendToActiveTab({ type: 'SET_MIN_CONFIDENCE', minConfidence: state.minConfidence });
    updateScan();
  });

  $('export-json').addEventListener('click', () => exportPage('json'));
  $('export-csv').addEventListener('click', () => exportPage('csv'));
  $('rescan').addEventListener('click', async () => {
    const btn = $('rescan');
    const s = S();
    btn.classList.add('is-busy');
    btn.setAttribute('aria-busy', 'true');
    if (s?.summary?.rescanning) btn.textContent = s.summary.rescanning;
    await sendToActiveTab({ type: 'RESCAN' });
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const stats = await sendToActiveTab({ type: 'GET_STATS' });
      if (!stats?.pending && (stats?.scanned || 0) > 0) break;
      if (i === 0) updateScan();
    }
    btn.classList.remove('is-busy');
    btn.setAttribute('aria-busy', 'false');
    btn.textContent = s?.summary?.rescan || 'Rescan';
    updateScan();
  });

  $('open-settings').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    else chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
  });
  $('shortcuts-link').addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }); });
  $('privacy-link').addEventListener('click', (e) => { e.preventDefault(); if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage(); });
  $('clear-cache').addEventListener('click', async () => {
    const keys = await getCacheKeys();
    await chrome.storage.local.remove(keys);
    toast(`Cleared ${keys.length} cached`);
    updateScan();
  });

  const notifyToggle = $('notify-on-ai');
  if (notifyToggle) {
    notifyToggle.addEventListener('change', async (e) => {
      state.notifyOnAI = e.target.checked;
      if (!await saveSync({ notifyOnAI: state.notifyOnAI })) {
        e.target.checked = !state.notifyOnAI;
        state.notifyOnAI = e.target.checked;
        return;
      }
      toast(state.notifyOnAI ? 'Notifications enabled' : 'Notifications off');
    });
  }

  const ensembleToggle = $('hf-ensemble');
  if (ensembleToggle) {
    ensembleToggle.addEventListener('change', async (e) => {
      state.hfEnsemble = e.target.checked;
      if (!await saveSync({ hfEnsemble: state.hfEnsemble })) {
        e.target.checked = !state.hfEnsemble;
        state.hfEnsemble = e.target.checked;
        return;
      }
      // Verdicts change with the engine set — clear cached results so the
      // next scan re-runs through the new model set.
      try {
        await chrome.storage.local.remove(await getCacheKeys());
      } catch { /* noop */ }
      toast(state.hfEnsemble ? 'Ensemble on — higher recall' : 'Ensemble off');
    });
  }
}

async function connectHuggingFace() {
  const token = $('hf-token').value.trim();
  const model = $('hf-model').value.trim() || DEFAULTS.hfModel;
  clearFeedback();
  $('hf-token').removeAttribute('aria-invalid');
  if (!token) { $('hf-token').setAttribute('aria-invalid', 'true'); feedback('err', 'Enter your hf_ token first'); return toast('Enter your hf_ token first', true); }
  if (!/^hf_/.test(token)) { $('hf-token').setAttribute('aria-invalid', 'true'); feedback('err', 'Token should start with “hf_”'); return toast('Token should start with “hf_”', true); }

  setBusy('hf-save', true);
  const r = await send({ type: 'RMF_VALIDATE', provider: 'huggingface', token });
  setBusy('hf-save', false);
  if (!r || !r.ok) {
    $('hf-token').setAttribute('aria-invalid', 'true');
    feedback('err', (r && r.error) || 'Could not verify token');
    return toast((r && r.error) || 'Connection failed', true);
  }
  const modelChanged = model !== (state.hfModel || '');
  const wasPreview = state.provider !== 'huggingface' || !state.hfToken;
  state = { ...state, provider: 'huggingface', hfToken: token, hfModel: model, hfVerified: true, hfUser: r.user || '' };
  await chrome.storage.sync.set({ provider: 'huggingface', hfToken: token, hfModel: model, hfVerified: true, hfUser: r.user || '' });
  health = null;
  // Always clear cached verdicts when connecting HF — old preview/heuristic
  // results would otherwise stick for 7 days and look like HF scores.
  const keys = await getCacheKeys();
  if (keys.length) await chrome.storage.local.remove(keys);
  if (modelChanged || wasPreview) updateScan();
  feedback('ok', r.user ? `Connected as ${r.user}` : 'Token verified — you’re connected');
  renderStatus();
  toast(keys.length ? 'Connected · cache cleared — rescan the page' : 'Hugging Face connected', false, true);
}

function showPanel(provider) { PROVIDERS.forEach((p) => { $(`panel-${p}`).hidden = p !== provider; }); }
function setActiveProvider(provider) {
  showPanel(provider);
  $('provider-seg').querySelectorAll('.seg').forEach((b) => {
    const on = b.dataset.provider === provider;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}
function setActiveMode(mode) {
  $('mode-seg').querySelectorAll('.seg').forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}
function setupRovingGroup(groupId, values, onSelect, kind = 'tab') {
  window.RMF_UI.rovingGroup($(groupId), { kind, onSelect });
}

// ---- status ---------------------------------------------------------------
function renderStatus() {
  const card = $('status-card');
  const s = S();
  let stateName;
  let title;
  let sub;
  let chip;
  const hfReady = state.provider === 'huggingface' && state.hfToken;
  const verified = state.provider === 'huggingface' && state.hfVerified;
  const healthErr = health && health.provider === state.provider && health.status === 'error';

  if (!state.enabled) {
    stateName = 'off';
    title = s ? s.scan.engine : 'AI scanner';
    sub = 'Turn on to scan product images';
    chip = 'Off';
  } else if (hfReady && verified && healthErr) {
    stateName = 'error';
    title = 'Hugging Face';
    sub = health.error || 'Last scan failed';
    chip = 'Error';
  } else if (hfReady && verified) {
    stateName = 'good';
    title = 'Hugging Face';
    sub = state.hfUser ? `${state.hfUser} · ${state.hfModel || DEFAULTS.hfModel}` : (state.hfModel || DEFAULTS.hfModel);
    chip = 'Connected';
  } else if (hfReady) {
    stateName = 'warn';
    title = 'Hugging Face';
    sub = 'Saved — reconnect to verify';
    chip = 'Unverified';
  } else {
    stateName = 'warn';
    title = 'Preview mode';
    sub = 'Low accuracy — connect a model in Settings';
    chip = 'Preview';
  }

  card.dataset.state = stateName;
  $('status-title').textContent = title;
  $('status-sub').textContent = sub;
  $('status-sub').title = sub;
  $('status-chip').textContent = chip;
}
async function refreshHealth() { const r = await send({ type: 'RMF_ENGINE_HEALTH' }); health = (r && r.ok) ? r.health : null; }

// ---- export ---------------------------------------------------------------
async function exportPage(format) {
  const s = S();
  const report = await sendToActiveTab({ type: 'GET_PAGE_REPORT' });
  if (!report || !report.products || !report.products.length) {
    return toast((s && s.exportUI.empty) || 'Nothing to export yet', true);
  }
  const R = window.RMF_Report;
  const isCsv = format === 'csv';
  const blob = new Blob([isCsv ? R.buildCsv(report) : R.buildJson(report)], { type: isCsv ? 'text/csv' : 'application/json' });
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `truekart-${report.site}-${stamp}.${isCsv ? 'csv' : 'json'}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast((s && s.exportUI.done(report.products.length)) || `Exported ${report.products.length}`, false, true);
}

// ---- ui helpers -----------------------------------------------------------
function setBusy(btnId, busy) { const b = $(btnId); b.setAttribute('aria-busy', String(busy)); b.disabled = busy; }
function feedback(kind, msg) { const el = $('hf-feedback'); el.className = 'feedback ' + kind; el.textContent = msg; el.hidden = false; }
function clearFeedback() { const el = $('hf-feedback'); el.hidden = true; el.textContent = ''; }
const toast = (msg, isErr, isOk) => window.RMF_UI.toast(msg, isErr, isOk);
window.RMF_toast = toast;
