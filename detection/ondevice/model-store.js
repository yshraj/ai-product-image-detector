// detection/ondevice/model-store.js
// IndexedDB-backed store for the on-device model weights. Runs in BOTH the
// service worker (writes during download) and the offscreen document (reads to
// build the ORT session) — IndexedDB is available in both contexts.
//
// Two object stores:
//   models   — completed, verified weights: { key, buf(ArrayBuffer), meta }
//   partials — in-flight resumable downloads: { key, chunks[], received, total, etag }
//
// Cache key = `${MODEL_ID}@${MODEL_VERSION}`. Bumping MODEL_VERSION orphans the
// old entry (cleared by pruneOldVersions) so a model/preprocessing change never
// serves stale weights — this is the versioned cache + invalidation contract.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RMF_ModelStore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  const CFG = (typeof self !== 'undefined' && self.RMF_OndeviceConfig) ||
    (typeof window !== 'undefined' && window.RMF_OndeviceConfig) || {};
  const DB_NAME = CFG.DB_NAME || 'rmf_ondevice';
  const DB_VERSION = CFG.DB_VERSION || 1;
  const STORE_MODELS = CFG.STORE_MODELS || 'models';
  const STORE_PARTIALS = CFG.STORE_PARTIALS || 'partials';

  function cacheKey() {
    return `${CFG.MODEL_ID || 'model'}@${CFG.MODEL_VERSION || 1}`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_MODELS)) db.createObjectStore(STORE_MODELS, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(STORE_PARTIALS)) db.createObjectStore(STORE_PARTIALS, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    });
  }

  function tx(db, store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const os = t.objectStore(store);
      let out;
      Promise.resolve(fn(os)).then((v) => { out = v; }).catch(reject);
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error || new Error('IndexedDB tx failed'));
      t.onabort = () => reject(t.error || new Error('IndexedDB tx aborted'));
    });
  }

  const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  async function getMeta() {
    const db = await openDb();
    try {
      const rec = await tx(db, STORE_MODELS, 'readonly', (os) => reqP(os.get(cacheKey())));
      return rec ? rec.meta : null;
    } finally { db.close(); }
  }

  async function hasModel() {
    const meta = await getMeta().catch(() => null);
    return !!(meta && meta.complete);
  }

  // Returns the full model as an ArrayBuffer, or null if not cached/complete.
  async function getModelBuffer() {
    const db = await openDb();
    try {
      const rec = await tx(db, STORE_MODELS, 'readonly', (os) => reqP(os.get(cacheKey())));
      if (!rec || !rec.meta || !rec.meta.complete || !rec.buf) return null;
      return rec.buf;
    } finally { db.close(); }
  }

  async function putModel(buf, meta) {
    const db = await openDb();
    try {
      await tx(db, STORE_MODELS, 'readwrite', (os) =>
        reqP(os.put({ key: cacheKey(), buf, meta: { ...meta, complete: true, at: Date.now() } })));
      // Completing a download makes any partial obsolete.
      await tx(db, STORE_PARTIALS, 'readwrite', (os) => reqP(os.delete(cacheKey()))).catch(() => {});
    } finally { db.close(); }
  }

  async function deleteModel() {
    const db = await openDb();
    try {
      await tx(db, STORE_MODELS, 'readwrite', (os) => reqP(os.delete(cacheKey())));
      await tx(db, STORE_PARTIALS, 'readwrite', (os) => reqP(os.delete(cacheKey())));
    } finally { db.close(); }
  }

  // Drop any cached models/partials whose key differs from the current version.
  async function pruneOldVersions() {
    const db = await openDb();
    const key = cacheKey();
    try {
      for (const store of [STORE_MODELS, STORE_PARTIALS]) {
        const keys = await tx(db, store, 'readonly', (os) => reqP(os.getAllKeys()));
        const stale = (keys || []).filter((k) => k !== key);
        if (stale.length) {
          await tx(db, store, 'readwrite', (os) => Promise.all(stale.map((k) => reqP(os.delete(k)))));
        }
      }
    } finally { db.close(); }
  }

  // ---- resumable partials --------------------------------------------------
  async function getPartial() {
    const db = await openDb();
    try {
      return await tx(db, STORE_PARTIALS, 'readonly', (os) => reqP(os.get(cacheKey())));
    } finally { db.close(); }
  }

  async function savePartial(partial) {
    const db = await openDb();
    try {
      await tx(db, STORE_PARTIALS, 'readwrite', (os) =>
        reqP(os.put({ key: cacheKey(), ...partial, at: Date.now() })));
    } finally { db.close(); }
  }

  async function clearPartial() {
    const db = await openDb();
    try {
      await tx(db, STORE_PARTIALS, 'readwrite', (os) => reqP(os.delete(cacheKey())));
    } finally { db.close(); }
  }

  return {
    cacheKey,
    getMeta,
    hasModel,
    getModelBuffer,
    putModel,
    deleteModel,
    pruneOldVersions,
    getPartial,
    savePartial,
    clearPartial,
  };
}));
