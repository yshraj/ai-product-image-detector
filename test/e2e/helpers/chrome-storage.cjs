// chrome.storage helpers for E2E tests.
const { DEFAULT_SYNC, CACHE_PREFIX, HISTORY_KEY } = require('./constants.cjs');
const { inServiceWorker } = require('./chrome-api.cjs');

async function getSyncStorage(context, keys) {
  return inServiceWorker(context, (k) => chrome.storage.sync.get(k), keys);
}

async function setSyncStorage(context, obj) {
  // Surface chrome.runtime.lastError (e.g. MAX_WRITE_OPERATIONS_PER_MINUTE) instead
  // of silently resolving — a swallowed quota error otherwise looks like a value bug.
  return inServiceWorker(context, (o) => new Promise((resolve, reject) => {
    chrome.storage.sync.set(o, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  }), obj);
}

/**
 * Reset sync storage to `desired`, writing ONLY the keys that differ from the
 * current value. Across a full suite the auto-reset fires before every test;
 * blindly re-writing all sync keys each time approaches chrome.storage.sync's
 * ~120 writes/minute quota and gets throttled, which silently drops later
 * writes. Diffing keeps the reset a no-op when nothing changed.
 */
async function resetSyncStorage(context, desired) {
  return inServiceWorker(context, (want) => new Promise((resolve, reject) => {
    chrome.storage.sync.get(null, (cur) => {
      const patch = {};
      for (const k of Object.keys(want)) {
        if (JSON.stringify(cur[k]) !== JSON.stringify(want[k])) patch[k] = want[k];
      }
      if (!Object.keys(patch).length) return resolve(false);
      chrome.storage.sync.set(patch, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(true);
      });
    });
  }), desired);
}

async function getLocalStorage(context, keys) {
  return inServiceWorker(context, (k) => chrome.storage.local.get(k), keys);
}

async function setLocalStorage(context, obj) {
  return inServiceWorker(context, (o) => new Promise((r) => chrome.storage.local.set(o, r)), obj);
}

async function clearDetectionCache(context) {
  return inServiceWorker(context, (prefix) => new Promise((resolve) => {
    chrome.storage.local.get(null, (all) => {
      const keys = Object.keys(all).filter((k) => k.startsWith(prefix));
      if (!keys.length) return resolve(0);
      chrome.storage.local.remove(keys, () => resolve(keys.length));
    });
  }), CACHE_PREFIX);
}

async function clearHistory(context) {
  return inServiceWorker(context, (key) => new Promise((r) => chrome.storage.local.remove(key, r)), HISTORY_KEY);
}

async function getSessionStorage(context, keys) {
  return inServiceWorker(context, (k) => chrome.storage.session.get(k), keys);
}

/** Reset sync + local detection artifacts to a known baseline. */
async function resetExtensionStorage(context, overrides = {}) {
  // CLIP offscreen load is slow and flaky under parallel CI workers; mocked compare E2E
  // tests exercise text/SerpApi ranking only. Live compare suites opt in via overrides.
  await resetSyncStorage(context, { ...DEFAULT_SYNC, compareUseClip: false, ...overrides });
  await setLocalStorage(context, { rmf_onboarding_done: true });
  await clearDetectionCache(context);
  await clearHistory(context);
  try {
    await inServiceWorker(context, () => chrome.storage.session.clear());
  } catch { /* session storage optional */ }
}

module.exports = {
  DEFAULT_SYNC,
  getSyncStorage,
  setSyncStorage,
  resetSyncStorage,
  getLocalStorage,
  setLocalStorage,
  clearDetectionCache,
  clearHistory,
  getSessionStorage,
  resetExtensionStorage,
};
