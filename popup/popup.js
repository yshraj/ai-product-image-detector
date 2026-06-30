// popup/popup.js — ShopShield (Scan / Compare / Tools / Settings)
const CACHE_PREFIX = 'rmf_cache_';
const ALL_COMPARE_SITES = ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa'];
const DEFAULTS = {
  enabled: true, mode: 'badge', provider: 'heuristic',
  hfToken: '', hfModel: 'haywoodsloan/ai-image-detector-deploy', hfVerified: false, hfUser: '',
  minConfidence: 70,
  compareSites: [...ALL_COMPARE_SITES],
};
const PROVIDERS = ['huggingface', 'heuristic'];
const MODES = ['all', 'badge', 'hide'];
const TABS = ['scan', 'compare', 'tools', 'settings'];
const MARKETPLACES = (window.RMF_CompareConfig && window.RMF_CompareConfig.MARKETPLACES) || {
  amazon: { name: 'Amazon', manualUrl: (q) => 'https://www.amazon.in/s?k=' + q },
  flipkart: { name: 'Flipkart', manualUrl: (q) => 'https://www.flipkart.com/search?q=' + q },
  myntra: { name: 'Myntra', manualUrl: (q) => 'https://www.myntra.com/' + q.replace(/\s+/g, '-') },
  meesho: { name: 'Meesho', manualUrl: (q) => 'https://www.meesho.com/search?q=' + q },
  nykaa: { name: 'Nykaa', manualUrl: (q) => 'https://www.nykaa.com/search/result/?q=' + q },
};

const $ = (id) => document.getElementById(id);
const S = () => window.RMF_STRINGS;
const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);

let state = { ...DEFAULTS };
let health = null;
let compareProduct = null;
let compareSearching = false;

document.addEventListener('DOMContentLoaded', async () => {
  state = await chrome.storage.sync.get(DEFAULTS);
  if (!Array.isArray(state.compareSites) || !state.compareSites.length) {
    state.compareSites = [...ALL_COMPARE_SITES];
  }

  $('toggle-enabled').checked = state.enabled;
  $('hf-token').value = state.hfToken || '';
  $('hf-model').value = state.hfModel && state.hfModel !== DEFAULTS.hfModel ? state.hfModel : '';
  $('popup-confidence').value = state.minConfidence;
  $('popup-confidence-val').textContent = `${state.minConfidence}%`;

  const ver = chrome.runtime.getManifest().version;
  $('version').textContent = `v${ver}`;
  const strings = S();
  if (strings?.app?.tagline) $('brand-tagline').textContent = strings.app.tagline;

  await refreshHealth();
  renderStatus();
  setupNav();
  setupSettings();
  setupCompareSites();
  updateScan();
});

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

function selectTab(tab) {
  TABS.forEach((t) => { $(`panel-${t}`).hidden = t !== tab; });
  document.querySelectorAll('.nav-btn').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  if (tab === 'scan') updateScan();
  if (tab === 'compare') renderCompare();
  if (tab === 'tools') renderTools();
}

// ---- active tab / product -------------------------------------------------
const MARKETPLACE_TABS = [
  'https://www.myntra.com/*',
  'https://www.flipkart.com/*',
  'https://www.meesho.com/*',
  'https://www.nykaa.com/*',
];

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // When popup.html is opened as a tab (common in dev/E2E), fall back to the best
  // marketplace tab in this window instead of the extension page itself.
  if (tab?.url?.startsWith('chrome-extension:')) {
    const candidates = await chrome.tabs.query({ currentWindow: true, url: MARKETPLACE_TABS });
    if (!candidates.length) return tab;
    const productish = candidates.filter((t) => /\/buy$|\/\d{5,}/.test(t.url));
    const pool = productish.length ? productish : candidates;
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

  const primary = await tryTab(await getActiveTab());
  if (primary && (message.type !== 'GET_PRODUCT' || primary.title)) return primary;

  const candidates = await chrome.tabs.query({ currentWindow: true, url: MARKETPLACE_TABS });
  const productish = candidates.filter((t) => /\/buy$|\/\d{5,}/.test(t.url));
  const pool = [...(productish.length ? productish : candidates)].reverse();
  for (const tab of pool) {
    const r = await tryTab(tab);
    if (r && (message.type !== 'GET_PRODUCT' || r.title)) return r;
  }
  return primary;
}
async function getActiveProduct() {
  for (let i = 0; i < 6; i++) {
    const p = await sendToActiveTab({ type: 'GET_PRODUCT' });
    if (p?.title) return p;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

// ---- SCAN -----------------------------------------------------------------
async function updateScan() {
  const s = S();
  const all = await chrome.storage.local.get(null);
  $('cache-count').textContent = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX)).length;

  let live = { scanned: 0, ai: 0, aiHigh: 0, aiLikely: 0 };
  let onSupported = false;
  const stats = await sendToActiveTab({ type: 'GET_STATS' });
  if (stats) { live = stats; onSupported = true; }

  const normal = Math.max(0, (live.scanned || 0) - (live.ai || 0));
  $('bd-high').textContent = live.aiHigh || 0;
  $('bd-med').textContent = live.aiLikely || 0;
  $('bd-ok').textContent = normal;

  const hint = $('scan-hint');
  const tip = $('scan-tip');
  const confHint = $('conf-hint');
  const bd = $('breakdown');

  if (!onSupported) {
    $('scan-title').textContent = s?.app?.shortName || 'ShopShield';
    $('scan-count').textContent = '';
    bd.style.display = 'none';
    $('export-row').hidden = true;
    $('rescan').hidden = true;
    confHint.hidden = true;
    tip.hidden = true;
    hint.hidden = false;
    hint.textContent = s ? s.scan.unsupported : '';
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
}

// ---- COMPARE --------------------------------------------------------------
async function renderCompare() {
  const s = S();
  const p = await getActiveProduct();
  compareProduct = p;
  const titleEl = $('compare-title');
  const list = $('compare-list');
  const note = $('compare-note');
  const searchBtn = $('compare-search');
  const statusEl = $('compare-status');
  const resultsEl = $('compare-results');
  const manualEl = $('compare-manual');
  list.textContent = '';
  resultsEl.hidden = true;
  resultsEl.textContent = '';
  statusEl.hidden = true;
  manualEl.hidden = true;
  searchBtn.hidden = true;

  if (!p || !p.title) {
    titleEl.textContent = s ? s.compare.noProduct : 'Open a product page.';
    titleEl.classList.add('muted');
    note.textContent = '';
    return;
  }
  titleEl.textContent = p.title;
  titleEl.classList.remove('muted');
  searchBtn.hidden = false;
  $('compare-search-label').textContent = s ? s.compare.findSimilar : 'Find similar products';
  note.textContent = s ? s.compare.note : '';

  renderManualLinks(p, list, s);
  manualEl.hidden = false;

  if (!compareSearching) {
    searchBtn.disabled = false;
    searchBtn.setAttribute('aria-busy', 'false');
  }

  searchBtn.onclick = () => runCompareSearch(p);
}

function renderManualLinks(p, list, s) {
  const q = encodeURIComponent(p.title);
  const enabled = new Set(state.compareSites || ALL_COMPARE_SITES);
  ALL_COMPARE_SITES
    .filter((site) => enabled.has(site) && site !== p.site)
    .forEach((site) => {
      const mp = MARKETPLACES[site];
      const urlFn = mp.manualUrl || mp.url;
      list.appendChild(actionLink(s ? s.compare.on(mp.name) : mp.name, urlFn(q)));
    });
}

async function runCompareSearch(product) {
  if (compareSearching) return;
  const s = S();
  const searchBtn = $('compare-search');
  const statusEl = $('compare-status');
  const resultsEl = $('compare-results');

  compareSearching = true;
  searchBtn.setAttribute('aria-busy', 'true');
  searchBtn.disabled = true;
  statusEl.hidden = false;
  statusEl.textContent = s ? s.compare.searching : 'Searching marketplaces…';
  resultsEl.hidden = true;
  resultsEl.textContent = '';

  const sites = (state.compareSites || ALL_COMPARE_SITES).filter((site) => site !== product.site);
  const r = await send({ type: 'RMF_COMPARE_SEARCH', product, sites });

  compareSearching = false;
  searchBtn.setAttribute('aria-busy', 'false');
  searchBtn.disabled = false;

  if (!r || !r.ok) {
    statusEl.textContent = s ? s.compare.searchFailed : 'Search failed';
    return;
  }

  statusEl.textContent = r.cached && s ? s.compare.cached : '';
  if (!r.matches || !r.matches.length) {
    statusEl.textContent = (statusEl.textContent ? statusEl.textContent + ' · ' : '')
      + (s ? s.compare.noMatches : 'No close matches found');
    resultsEl.hidden = true;
    return;
  }

  renderCompareResults(r, s);
  statusEl.hidden = !r.cached;
  resultsEl.hidden = false;
}

function renderCompareResults(data, s) {
  const resultsEl = $('compare-results');
  resultsEl.textContent = '';

  for (const entry of data.matches) {
    const mp = MARKETPLACES[entry.site];
    const best = entry.best;
    if (!best) continue;

    const card = document.createElement('a');
    card.className = 'match-card';
    card.href = best.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    const score = best.match.score;
    const label = best.match.label;
    let badgeText = s ? s.compare.possibleMatch : 'Possible match';
    let badgeClass = 'match-badge possible';
    if (label === 'same') {
      badgeText = s ? s.compare.sameProduct : 'Same product';
      badgeClass = 'match-badge same';
    } else if (label === 'similar') {
      badgeText = s ? s.compare.similarProduct : 'Similar product';
      badgeClass = 'match-badge similar';
    }

    const head = document.createElement('div');
    head.className = 'match-head';
    const site = document.createElement('span');
    site.className = 'match-site';
    site.textContent = mp?.name || entry.site;
    const badge = document.createElement('span');
    badge.className = badgeClass;
    badge.textContent = s ? s.compare.matchScore(score) : `${score}% match`;
    badge.title = badgeText;
    head.append(site, badge);

    const title = document.createElement('div');
    title.className = 'match-title';
    title.textContent = best.title;

    const meta = document.createElement('div');
    meta.className = 'match-meta';
    const price = document.createElement('span');
    price.className = 'match-price';
    price.textContent = s ? s.compare.price(best.price) : (best.price || 'Price unavailable');
    const hint = document.createElement('span');
    hint.className = 'match-hint';
    hint.textContent = badgeText;
    meta.append(price, hint);

    card.append(head, title, meta);
    resultsEl.appendChild(card);
  }
}

// ---- TOOLS ----------------------------------------------------------------
async function renderTools() {
  const s = S();
  const p = await getActiveProduct();
  const rev = $('reverse-list');
  const list = $('tools-list');
  const note = $('tools-note');
  rev.textContent = '';
  list.textContent = '';

  if (!p) {
    note.textContent = s ? s.tools.noProduct : 'Open a product page.';
    return;
  }
  note.textContent = '';

  if (p.image) {
    rev.appendChild(actionLink(s ? s.tools.lens : 'Google Lens', 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(p.image)));
    rev.appendChild(actionLink(s ? s.tools.bing : 'Bing Visual Search', 'https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:' + encodeURIComponent(p.image)));
  } else {
    const n = document.createElement('p');
    n.className = 'note';
    n.textContent = s ? s.tools.noImage : '';
    rev.appendChild(n);
  }

  list.appendChild(actionButton(s ? s.tools.copyUrl : 'Copy product URL', () => copyText(p.url)));
  list.appendChild(actionButton(s ? s.tools.copyTitle : 'Copy title', () => copyText(p.title)));
  list.appendChild(actionButton(s ? s.tools.copyDetails : 'Copy product details', () => copyText(detailsText(p))));
  if (p.image) list.appendChild(actionButton(s ? s.tools.copyImageUrl : 'Copy image URL', () => copyText(p.image)));
  if (p.image) list.appendChild(actionButton(s ? s.tools.downloadImage : 'Download image', () => downloadImage(p)));
  list.appendChild(actionButton(s ? s.tools.share : 'Share product', () => shareProduct(p)));
}

function detailsText(p) {
  return [
    p.title && `Title: ${p.title}`,
    p.brand && `Brand: ${p.brand}`,
    p.price && `Price: ${p.price}`,
    p.rating && `Rating: ${p.rating}`,
    p.seller && `Seller: ${p.seller}`,
    p.url && `URL: ${p.url}`,
  ].filter(Boolean).join('\n');
}

async function copyText(text) {
  if (!text) return;
  try { await navigator.clipboard.writeText(text); toast(S() ? S().tools.copied : 'Copied'); }
  catch { toast('Could not copy', true); }
}

function downloadImage(p) {
  if (!p.image) return;
  try {
    if (chrome.downloads?.download) chrome.downloads.download({ url: p.image });
    else window.open(p.image, '_blank', 'noopener');
    toast(S() ? S().tools.downloaded : 'Downloading…');
  } catch { window.open(p.image, '_blank', 'noopener'); }
}

async function shareProduct(p) {
  const data = { title: p.title || 'Product', url: p.url };
  try {
    if (navigator.share) { await navigator.share(data); toast(S() ? S().tools.shared : 'Shared'); return; }
  } catch { return; }
  copyText(`${p.title}\n${p.url}`);
}

// ---- builders -------------------------------------------------------------
function actionLink(text, href) {
  const a = document.createElement('a');
  a.className = 'action-btn';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = text;
  return a;
}
function actionButton(text, onClick) {
  const b = document.createElement('button');
  b.className = 'action-btn';
  b.type = 'button';
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

// ---- compare marketplace toggles ------------------------------------------
function setupCompareSites() {
  const box = $('compare-sites');
  const enabled = new Set(state.compareSites || ALL_COMPARE_SITES);
  box.querySelectorAll('input[data-site]').forEach((input) => {
    input.checked = enabled.has(input.dataset.site);
    input.addEventListener('change', async () => {
      const sites = Array.from(box.querySelectorAll('input[data-site]:checked')).map((el) => el.dataset.site);
      state.compareSites = sites.length ? sites : [...ALL_COMPARE_SITES];
      await chrome.storage.sync.set({ compareSites: state.compareSites });
      if (!$('panel-compare').hidden) renderCompare();
    });
  });
  const s = S();
  if (s?.settings?.compareSitesHint) $('compare-sites-hint').textContent = s.settings.compareSitesHint;
}

// ---- SETTINGS (engine connect, modes, confidence, links) ------------------
function setupSettings() {
  setActiveProvider(state.provider);
  setActiveMode(state.mode);

  $('toggle-enabled').addEventListener('change', async (e) => {
    state.enabled = e.target.checked;
    await chrome.storage.sync.set({ enabled: state.enabled });
    sendToActiveTab({ type: 'SET_ENABLED', enabled: state.enabled });
    renderStatus();
    updateScan();
  });

  setupRovingGroup('provider-seg', PROVIDERS, async (p) => {
    showPanel(p);
    if (p === 'heuristic') {
      state.provider = 'heuristic';
      await chrome.storage.sync.set({ provider: 'heuristic' });
      renderStatus();
    }
  });
  setupRovingGroup('mode-seg', MODES, async (mode) => {
    state.mode = mode;
    await chrome.storage.sync.set({ mode });
    setActiveMode(mode);
    sendToActiveTab({ type: 'SET_MODE', mode });
  }, 'radio');
  setActiveProvider(state.provider);
  setActiveMode(state.mode);

  $('hf-save').addEventListener('click', connectHuggingFace);
  $('hf-token').addEventListener('keydown', (e) => { if (e.key === 'Enter') connectHuggingFace(); });
  $('hf-token-toggle').addEventListener('click', () => {
    const f = $('hf-token');
    const show = f.type === 'password';
    f.type = show ? 'text' : 'password';
    $('hf-token-toggle').textContent = show ? 'hide' : 'show';
    $('hf-token-toggle').setAttribute('aria-pressed', String(show));
  });
  $('goto-hf').addEventListener('click', () => { setActiveProvider('huggingface'); $('hf-token').focus(); });

  const slider = $('popup-confidence');
  slider.addEventListener('input', () => { $('popup-confidence-val').textContent = `${slider.value}%`; });
  slider.addEventListener('change', async () => {
    state.minConfidence = Number(slider.value);
    await chrome.storage.sync.set({ minConfidence: state.minConfidence });
    updateScan();
  });

  $('export-json').addEventListener('click', () => exportPage('json'));
  $('export-csv').addEventListener('click', () => exportPage('csv'));
  $('rescan').addEventListener('click', async () => {
    await sendToActiveTab({ type: 'RESCAN' });
    setTimeout(updateScan, 800);
  });

  $('open-settings').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    else chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
  });
  $('shortcuts-link').addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }); });
  $('privacy-link').addEventListener('click', (e) => { e.preventDefault(); if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage(); });
  $('clear-cache').addEventListener('click', async () => {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
    await chrome.storage.local.remove(keys);
    toast(`Cleared ${keys.length} cached`);
    updateScan();
  });
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
  state = { ...state, provider: 'huggingface', hfToken: token, hfModel: model, hfVerified: true, hfUser: r.user || '' };
  await chrome.storage.sync.set({ provider: 'huggingface', hfToken: token, hfModel: model, hfVerified: true, hfUser: r.user || '' });
  health = null;
  if (modelChanged) {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
    if (keys.length) await chrome.storage.local.remove(keys);
    updateScan();
  }
  feedback('ok', r.user ? `Connected as ${r.user}` : 'Token verified — you’re connected');
  renderStatus();
  toast(modelChanged ? 'Connected · cache cleared — reload the page' : 'Hugging Face connected');
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
  const group = $(groupId);
  const btns = Array.from(group.querySelectorAll('.seg'));
  const valueOf = (b) => b.dataset.provider || b.dataset.mode;
  btns.forEach((btn) => {
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
  a.download = `shopsmart-${report.site}-${stamp}.${isCsv ? 'csv' : 'json'}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast((s && s.exportUI.done(report.products.length)) || `Exported ${report.products.length}`);
}

// ---- ui helpers -----------------------------------------------------------
function setBusy(btnId, busy) { const b = $(btnId); b.setAttribute('aria-busy', String(busy)); b.disabled = busy; }
function feedback(kind, msg) { const el = $('hf-feedback'); el.className = 'feedback ' + kind; el.textContent = msg; el.hidden = false; }
function clearFeedback() { const el = $('hf-feedback'); el.hidden = true; el.textContent = ''; }
function toast(msg, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.textContent = msg;
  $('toast-host').appendChild(t);
  setTimeout(() => t.remove(), 2400);
}
