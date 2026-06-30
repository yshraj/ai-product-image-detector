// popup/popup.js — ShopShield (Scan / Compare / Tools / Settings)
const CACHE_PREFIX = 'rmf_cache_';
const ALL_COMPARE_SITES = ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa'];
const DEFAULTS = {
  enabled: true, mode: 'badge', provider: 'heuristic',
  hfToken: '', hfModel: 'haywoodsloan/ai-image-detector-deploy', hfVerified: false, hfUser: '',
  minConfidence: 70,
  compareSites: [...ALL_COMPARE_SITES],
  serpApiKey: '',
  notifyOnAI: false,
};
const PROVIDERS = ['huggingface', 'heuristic'];
const MODES = ['all', 'badge', 'hide'];
const TABS = ['scan', 'compare', 'tools', 'settings'];
const MARKETPLACES = (window.RMF_CompareConfig && window.RMF_CompareConfig.MARKETPLACES) || {
  amazon: { name: 'Amazon', manualUrl: (q) => 'https://www.amazon.in/s?k=' + q },
  flipkart: { name: 'Flipkart', manualUrl: (q) => 'https://www.flipkart.com/search?q=' + q },
  myntra: { name: 'Myntra', manualUrl: (q) => 'https://www.myntra.com/search?q=' + q },
  meesho: { name: 'Meesho', manualUrl: (q) => 'https://www.meesho.com/search?q=' + q },
  nykaa: { name: 'Nykaa', manualUrl: (q) => 'https://www.nykaa.com/search/result/?q=' + q },
};

const $ = (id) => document.getElementById(id);
const S = () => window.RMF_STRINGS;
const send = (msg) => new Promise((resolve) => {
  try {
    chrome.runtime.sendMessage(msg, (response) => {
      const err = chrome.runtime.lastError;
      if (err) resolve({ ok: false, error: err.message });
      else resolve(response ?? { ok: false, error: 'No response from extension' });
    });
  } catch (e) {
    resolve({ ok: false, error: String(e?.message || e) });
  }
});

let state = { ...DEFAULTS };
let health = null;

document.addEventListener('DOMContentLoaded', async () => {
  state = await chrome.storage.sync.get(DEFAULTS);
  if (!Array.isArray(state.compareSites) || !state.compareSites.length) {
    state.compareSites = [...ALL_COMPARE_SITES];
  }
  window.__compareSettingsSites = state.compareSites;

  $('toggle-enabled').checked = state.enabled;
  $('hf-token').value = state.hfToken || '';
  $('hf-model').value = state.hfModel && state.hfModel !== DEFAULTS.hfModel ? state.hfModel : '';
  $('popup-confidence').value = state.minConfidence;
  $('popup-confidence-val').textContent = `${state.minConfidence}%`;
  if ($('scan-confidence')) {
    $('scan-confidence').value = state.minConfidence;
    $('scan-confidence-val').textContent = `${state.minConfidence}%`;
  }
  if ($('serp-api-key')) $('serp-api-key').value = state.serpApiKey || '';
  if ($('notify-on-ai')) $('notify-on-ai').checked = state.notifyOnAI === true;

  const ver = chrome.runtime.getManifest().version;
  $('version').textContent = `v${ver}`;
  const strings = S();
  if (strings?.app?.tagline) $('brand-tagline').textContent = strings.app.tagline;

  await refreshHealth();
  renderStatus();
  setupNav();
  setupSettings();
  setupCompareSites();
  setupImageDrop();
  window.RMF_ComparePanel?.setupSort?.();
  setupScanPanel();
  maybeShowOnboarding();
  updateScan();
});

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
        await chrome.storage.sync.set({ minConfidence: val });
        sendToActiveTab({ type: 'SET_MIN_CONFIDENCE', minConfidence: val });
        updateScan();
      }, 200);
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
  overlay.innerHTML = `<div class="onboarding-card" role="dialog" aria-modal="true" aria-label="Welcome to ShopShield">
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
}

async function renderScanHistory() {
  const card = $('scan-history-card');
  const list = $('scan-history');
  const empty = $('scan-history-empty');
  if (!card || !list) return;
  const data = await chrome.storage.local.get({ rmf_scan_history: [] });
  const hist = data.rmf_scan_history || [];
  list.textContent = '';
  if (!hist.length) {
    card.hidden = false;
    empty.hidden = false;
    empty.innerHTML = '<span class="empty-state-ico" aria-hidden="true">📋</span>' + (S()?.scan?.historyEmpty || '');
    return;
  }
  card.hidden = false;
  empty.hidden = true;
  hist.slice(0, 8).forEach((h) => {
    const li = document.createElement('li');
    const d = new Date(h.at);
    li.innerHTML = `<div class="sh-site">${h.site}</div><div class="sh-meta">${h.scanned} scanned · ${h.ai} AI · ${d.toLocaleDateString()}</div>`;
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

function selectTab(tab) {
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
  if (tab === 'compare') window.RMF_ComparePanel?.render?.(getActiveProduct);
  if (tab === 'tools') renderTools();
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
const MARKETPLACE_TABS = [
  'https://www.myntra.com/*',
  'https://www.flipkart.com/*',
  'https://www.meesho.com/*',
  'https://www.nykaa.com/*',
];

function isMarketplaceProductUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'flipkart.com') return /\/p\//.test(u.pathname);
    if (host === 'myntra.com') return /\/buy$/.test(u.pathname) || /\d{6,}/.test(u.pathname);
    if (host === 'meesho.com') return /\/product\//.test(u.pathname);
    if (host.includes('nykaa.com')) return /\/p\//.test(u.pathname);
  } catch { /* ignore */ }
  return false;
}

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
  const primary = await tryTab(active);
  if (primary && (message.type !== 'GET_PRODUCT' || primary.title)) return primary;

  // For product lookup, stick to the tab the user is viewing — never another tab.
  if (message.type === 'GET_PRODUCT' && isMarketplaceProductUrl(active?.url)) return primary;

  const candidates = await chrome.tabs.query({ currentWindow: true, url: MARKETPLACE_TABS });
  const productish = candidates.filter((t) => isMarketplaceProductUrl(t.url));
  const pool = [...(productish.length ? productish : candidates)].reverse();
  for (const tab of pool) {
    const r = await tryTab(tab);
    if (r && (message.type !== 'GET_PRODUCT' || r.title)) return r;
  }
  return primary;
}
async function getActiveProduct() {
  const active = await getActiveTab();
  if (!active?.id) return null;

  const tryTab = async () => {
    try { return await chrome.tabs.sendMessage(active.id, { type: 'GET_PRODUCT' }); } catch { return null; }
  };

  // Retry on the visible tab only — avoids picking a stale Flipkart tab in the background.
  for (let i = 0; i < 10; i++) {
    const p = await tryTab();
    if (p?.title) return p;
    await new Promise((r) => setTimeout(r, 250));
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
  updateNavBadge(live);

  const progress = $('scan-progress');
  const total = live.total || live.scanned || 0;
  const done = live.scanned || 0;
  const pending = live.pending || 0;
  if (progress && onSupported && state.enabled && (pending > 0 || (total > done))) {
    progress.hidden = false;
    progress.textContent = s ? s.scan.scanning(done, total || done + pending) : `Scanning ${done} / ${total || '…'}`;
  } else if (progress) progress.hidden = true;

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
  await renderScanHistory();
}

// ---- COMPARE (delegated to compare-panel.js) ------------------------------

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
  list.appendChild(actionButton(s ? s.tools.shareStats : 'Share my stats', () => shareStatsCard()));
  list.appendChild(actionButton(s ? s.tools.exportCorrections : 'Export corrections', () => exportCorrections()));

  await renderSellerTrust();
}

async function renderSellerTrust() {
  const s = S();
  const list = $('seller-list');
  const empty = $('seller-empty');
  if (!list) return;
  list.textContent = '';
  const r = await send({ type: 'RMF_GET_SELLERS' });
  const sellers = (r.ok && r.sellers) ? r.sellers : [];
  if (!sellers.length) {
    empty.hidden = false;
    empty.textContent = s ? s.tools.sellerEmpty : '';
    return;
  }
  empty.hidden = true;
  sellers.slice(0, 15).forEach((sel) => {
    const li = document.createElement('li');
    li.className = 'seller-row';
    const barClass = sel.aiPct >= 50 ? '' : 'ok';
    li.innerHTML = `<span class="seller-name">${sel.name}</span><span class="seller-bar ${barClass}" title="${sel.aiPct}% AI"><span style="width:${sel.aiPct}%"></span></span><span class="seller-pct ${sel.aiPct >= 50 ? 'bad' : 'ok'}">${sel.aiPct}%</span><small>${sel.total}</small>`;
    list.appendChild(li);
  });
}

function setupImageDrop() {
  const zone = $('image-drop');
  const file = $('image-file');
  const hint = $('image-drop-hint');
  const result = $('image-check-result');
  const s = S();
  if (!zone || !file) return;
  if (s?.tools?.dropHint) hint.textContent = s.tools.dropHint;

  const pick = () => file.click();
  zone.addEventListener('click', pick);
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag');
    const f = e.dataTransfer?.files?.[0];
    if (f) checkDroppedImage(f);
  });
  file.addEventListener('change', () => { if (file.files?.[0]) checkDroppedImage(file.files[0]); });
}

async function checkDroppedImage(blob) {
  const result = $('image-check-result');
  const s = S();
  result.hidden = false;
  result.textContent = s ? s.tools.checking : 'Checking…';
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  const r = await send({ type: 'RMF_DETECT_DATA', dataUrl });
  if (!r?.ok) {
    result.textContent = r?.error || 'Check failed';
    return;
  }
  const res = r.result;
  const high = res.confidence >= 90;
  const flagged = res.isAI && res.confidence >= 70;
  result.textContent = flagged
    ? `${high ? '🤖 AI Generated' : '⚠️ Likely AI'} · ${Math.round(res.confidence)}%`
    : `✓ Normal · ${Math.round(res.confidence)}%`;
  result.className = 'image-check-result ' + (flagged ? (high ? 'bad' : 'warn') : 'ok');
}

async function exportCorrections() {
  const r = await send({ type: 'RMF_GET_CORRECTIONS' });
  const data = (r.ok && r.corrections) ? r.corrections : [];
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'shopshield-corrections.json';
  a.click();
  URL.revokeObjectURL(url);
  toast(`Exported ${data.length} correction${data.length === 1 ? '' : 's'}`);
}

async function shareStatsCard() {
  const hist = (await chrome.storage.local.get({ rmf_scan_history: [] })).rmf_scan_history || [];
  const total = hist.reduce((n, h) => n + (h.scanned || 0), 0);
  const ai = hist.reduce((n, h) => n + (h.ai || 0), 0);
  const canvas = document.createElement('canvas');
  canvas.width = 600; canvas.height = 340;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 600, 340);
  grad.addColorStop(0, '#4F46E5');
  grad.addColorStop(1, '#6366f1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 340);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px system-ui,sans-serif';
  ctx.fillText('ShopShield', 40, 60);
  ctx.font = '18px system-ui,sans-serif';
  ctx.fillText('My shopping scan stats', 40, 95);
  ctx.font = 'bold 56px system-ui,sans-serif';
  ctx.fillText(String(total), 40, 175);
  ctx.font = '20px system-ui,sans-serif';
  ctx.fillText('products scanned', 40, 205);
  ctx.font = 'bold 40px system-ui,sans-serif';
  ctx.fillStyle = '#fecaca';
  ctx.fillText(String(ai), 40, 270);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui,sans-serif';
  ctx.fillText('AI-flagged', 40, 300);
  const a = document.createElement('a');
  a.download = 'shopshield-stats.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
  toast('Stats card downloaded');
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
      window.__compareSettingsSites = state.compareSites;
      await chrome.storage.sync.set({ compareSites: state.compareSites });
      if (!$('panel-compare').hidden) window.RMF_ComparePanel?.render?.(getActiveProduct);
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

  const serpKey = $('serp-api-key');
  if (serpKey) {
    $('serp-save')?.addEventListener('click', async () => {
      state.serpApiKey = serpKey.value.trim();
      await chrome.storage.sync.set({ serpApiKey: state.serpApiKey });
      toast(state.serpApiKey ? 'SerpApi key saved' : 'SerpApi key cleared');
    });
  }

  const notifyToggle = $('notify-on-ai');
  if (notifyToggle) {
    notifyToggle.addEventListener('change', async (e) => {
      state.notifyOnAI = e.target.checked;
      await chrome.storage.sync.set({ notifyOnAI: state.notifyOnAI });
      toast(state.notifyOnAI ? 'Notifications enabled' : 'Notifications off');
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
