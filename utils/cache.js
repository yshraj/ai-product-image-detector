// utils/cache.js
// Cache detection results so the same image URL is never processed twice.
// Uses chrome.storage.local (~10MB) with a 7-day TTL.
(function () {
  const CACHE_KEY_PREFIX = 'rmf_cache_';
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Build a short, stable, storage-safe key from a URL.
  function keyFor(imageUrl) {
    let hash = 5381;
    for (let i = 0; i < imageUrl.length; i++) {
      hash = ((hash << 5) + hash + imageUrl.charCodeAt(i)) | 0;
    }
    return CACHE_KEY_PREFIX + (hash >>> 0).toString(36);
  }

  const RMF_Cache = {
    keyPrefix: CACHE_KEY_PREFIX,

    async get(imageUrl) {
      try {
        const key = keyFor(imageUrl);
        const result = await chrome.storage.local.get(key);
        const entry = result[key];
        if (!entry) return null;
        if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
          chrome.storage.local.remove(key);
          return null;
        }
        return entry.data;
      } catch {
        return null;
      }
    },

    async set(imageUrl, data) {
      try {
        const key = keyFor(imageUrl);
        await chrome.storage.local.set({
          [key]: { data, timestamp: Date.now() },
        });
      } catch (err) {
        window.RMF_Log?.warn('cache set failed', err);
      }
    },

    async stats() {
      const all = await chrome.storage.local.get(null);
      const keys = Object.keys(all).filter((k) => k.startsWith(CACHE_KEY_PREFIX));
      let aiCount = 0;
      for (const k of keys) {
        if (all[k]?.data?.isAI) aiCount++;
      }
      return { total: keys.length, ai: aiCount };
    },

    async clear() {
      const all = await chrome.storage.local.get(null);
      const keys = Object.keys(all).filter((k) => k.startsWith(CACHE_KEY_PREFIX));
      await chrome.storage.local.remove(keys);
      return keys.length;
    },
  };

  window.RMF_Cache = RMF_Cache;
})();
