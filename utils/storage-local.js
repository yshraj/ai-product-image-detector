// utils/storage-local.js — thin chrome.storage.local helpers with safe fallbacks.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_StorageLocal = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  /**
   * @template T
   * @param {string} key
   * @param {T} fallback
   * @returns {Promise<T>}
   */
  async function get(key, fallback) {
    try {
      const data = await chrome.storage.local.get(key);
      return data[key] ?? fallback;
    } catch {
      return fallback;
    }
  }

  /** @param {string} key @param {unknown} value */
  async function set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch { /* storage unavailable */ }
  }

  return { get, set };
}));
