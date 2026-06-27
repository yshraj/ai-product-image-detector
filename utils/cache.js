// utils/cache.js
// Cache detection results so the same image URL is never processed twice.
// Uses chrome.storage.local (~10MB) with a default 7-day TTL, optional per-entry
// TTL (used to back off briefly on transient remote errors), and a soft cap on
// the number of entries so the store can't grow without bound.
(function () {
  const CACHE_KEY_PREFIX = 'rmf_cache_';
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  const MAX_ENTRIES = 3000;                      // soft cap (~well under quota)
  const EVICT_BATCH = 400;                        // oldest N removed when over cap
  const PRUNE_PROBABILITY = 0.04;                 // ~1 in 25 writes triggers a sweep

  // Build a short, stable, storage-safe key. Two independent rolling hashes plus
  // the length make accidental collisions (which would show a wrong verdict on a
  // different image) astronomically unlikely while keeping the key tiny.
  function keyFor(imageUrl) {
    let h1 = 5381;      // djb2
    let h2 = 0x811c9dc5; // fnv-ish
    for (let i = 0; i < imageUrl.length; i++) {
      const c = imageUrl.charCodeAt(i);
      h1 = ((h1 << 5) + h1 + c) | 0;
      h2 = (h2 ^ c) * 0x01000193 | 0;
    }
    return CACHE_KEY_PREFIX +
      (h1 >>> 0).toString(36) + '-' +
      (h2 >>> 0).toString(36) + '-' +
      imageUrl.length.toString(36);
  }

  function isExpired(entry, now) {
    const ttl = typeof entry.ttl === 'number' ? entry.ttl : CACHE_TTL_MS;
    return now - entry.timestamp > ttl;
  }

  // Remove the oldest entries when the store exceeds the soft cap. Runs rarely
  // (probabilistically) so it doesn't add latency to every write.
  async function maybeEvict() {
    if (Math.random() > PRUNE_PROBABILITY) return;
    try {
      const all = await chrome.storage.local.get(null);
      const now = Date.now();
      const entries = [];
      const expired = [];
      for (const k of Object.keys(all)) {
        if (!k.startsWith(CACHE_KEY_PREFIX)) continue;
        if (isExpired(all[k], now)) expired.push(k);
        else entries.push([k, all[k].timestamp || 0]);
      }
      const toRemove = expired;
      if (entries.length > MAX_ENTRIES) {
        entries.sort((a, b) => a[1] - b[1]); // oldest first
        const overflow = entries.length - MAX_ENTRIES + EVICT_BATCH;
        for (let i = 0; i < overflow && i < entries.length; i++) toRemove.push(entries[i][0]);
      }
      if (toRemove.length) await chrome.storage.local.remove(toRemove);
    } catch { /* best-effort housekeeping */ }
  }

  const RMF_Cache = {
    keyPrefix: CACHE_KEY_PREFIX,

    async get(imageUrl) {
      try {
        const key = keyFor(imageUrl);
        const result = await chrome.storage.local.get(key);
        const entry = result[key];
        if (!entry) return null;
        if (isExpired(entry, Date.now())) {
          chrome.storage.local.remove(key);
          return null;
        }
        return entry.data;
      } catch {
        return null;
      }
    },

    // ttlMs is optional; when omitted the default 7-day TTL applies.
    async set(imageUrl, data, ttlMs) {
      try {
        const key = keyFor(imageUrl);
        const entry = { data, timestamp: Date.now() };
        if (typeof ttlMs === 'number') entry.ttl = ttlMs;
        await chrome.storage.local.set({ [key]: entry });
        maybeEvict();
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
