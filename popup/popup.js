// popup/popup.js
const CACHE_PREFIX = 'rmf_cache_';
const DEFAULTS = {
  enabled: true, mode: 'badge', provider: 'heuristic',
  hfToken: '', hfModel: 'Organika/sdxl-detector', apiKey: '',
};

const $ = (id) => document.getElementById(id);

let state = { ...DEFAULTS };

document.addEventListener('DOMContentLoaded', async () => {
  state = await chrome.storage.sync.get(DEFAULTS);

  $('toggle-enabled').checked = state.enabled;
  $('hf-token').value = state.hfToken || '';
  $('hf-model').value = state.hfModel && state.hfModel !== DEFAULTS.hfModel ? state.hfModel : '';
  $('aiornot-key').value = state.apiKey || '';

  setActiveProvider(state.provider);
  setActiveMode(state.mode);
  renderStatus();
  updateStats();

  // enable / disable
  $('toggle-enabled').addEventListener('change', async (e) => {
    state.enabled = e.target.checked;
    await chrome.storage.sync.set({ enabled: state.enabled });
    sendToActiveTab({ type: 'SET_ENABLED', enabled: state.enabled });
    renderStatus();
  });

  // provider segmented control — switching just shows the panel; the engine
  // only becomes active once a key is saved (or Preview is chosen).
  $('provider-seg').querySelectorAll('.seg').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const p = btn.dataset.provider;
      showPanel(p);
      $('provider-seg').querySelectorAll('.seg').forEach((b) => b.classList.toggle('active', b === btn));
      if (p === 'heuristic') {
        state.provider = 'heuristic';
        await chrome.storage.sync.set({ provider: 'heuristic' });
        renderStatus();
      }
    });
  });

  // mode segmented control
  $('mode-seg').querySelectorAll('.seg').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      state.mode = mode;
      await chrome.storage.sync.set({ mode });
      setActiveMode(mode);
      sendToActiveTab({ type: 'SET_MODE', mode });
    });
  });

  // HF connect
  $('hf-save').addEventListener('click', async () => {
    const token = $('hf-token').value.trim();
    const model = $('hf-model').value.trim() || DEFAULTS.hfModel;
    if (!token) return toast('Enter your hf_ token first', true);
    if (!/^hf_/.test(token)) return toast('Token should start with "hf_"', true);
    state = { ...state, provider: 'huggingface', hfToken: token, hfModel: model };
    await chrome.storage.sync.set({ provider: 'huggingface', hfToken: token, hfModel: model });
    renderStatus();
    toast('Hugging Face connected');
  });

  // show / hide token
  $('hf-token-toggle').addEventListener('click', () => {
    const f = $('hf-token');
    const show = f.type === 'password';
    f.type = show ? 'text' : 'password';
    $('hf-token-toggle').textContent = show ? 'hide' : 'show';
  });

  // AI or Not connect
  $('aiornot-save').addEventListener('click', async () => {
    const key = $('aiornot-key').value.trim();
    if (!key) return toast('Enter your API key first', true);
    state = { ...state, provider: 'aiornot', apiKey: key };
    await chrome.storage.sync.set({ provider: 'aiornot', apiKey: key });
    renderStatus();
    toast('AI or Not connected');
  });

  // CTA from preview panel → jump to HF
  $('goto-hf').addEventListener('click', () => {
    setActiveProvider('huggingface');
    $('hf-onboard').open = true;
    $('hf-token').focus();
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

function showPanel(provider) {
  ['huggingface', 'aiornot', 'heuristic'].forEach((p) => {
    $(`panel-${p}`).hidden = p !== provider;
  });
}

function setActiveProvider(provider) {
  showPanel(provider);
  $('provider-seg').querySelectorAll('.seg').forEach((b) => {
    b.classList.toggle('active', b.dataset.provider === provider);
  });
}

function setActiveMode(mode) {
  $('mode-seg').querySelectorAll('.seg').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
}

function renderStatus() {
  const card = $('status-card');
  let stateName, title, sub, chip;

  if (!state.enabled) {
    stateName = 'off'; title = 'Detection paused'; sub = 'Toggle on to scan images'; chip = 'Off';
  } else if (state.provider === 'huggingface' && state.hfToken) {
    stateName = 'good'; title = 'Hugging Face'; sub = state.hfModel || DEFAULTS.hfModel; chip = 'Accurate';
  } else if (state.provider === 'aiornot' && state.apiKey) {
    stateName = 'good'; title = 'AI or Not'; sub = 'Cloud API connected'; chip = 'Accurate';
  } else {
    stateName = 'warn'; title = 'Preview heuristic'; sub = 'Low accuracy — connect a model'; chip = 'Preview';
  }

  card.dataset.state = stateName;
  $('status-title').textContent = title;
  $('status-sub').textContent = sub;
  $('status-chip').textContent = chip;
}

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
  const tab = await getActiveTab();
  if (tab?.id) {
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' });
      if (resp) live = resp;
    } catch { /* unsupported page */ }
  }
  $('ai-count').textContent = live.ai ?? 0;
  $('total-count').textContent = live.scanned ?? 0;
}

function toast(msg, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.textContent = msg;
  $('toast-host').appendChild(t);
  setTimeout(() => t.remove(), 2000);
}
