// test/unit/cache.test.cjs — detection result cache keying and TTL.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const store = {};

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  global.chrome = {
    storage: {
      local: {
        get: (keys) => {
          if (keys === null) return Promise.resolve({ ...store });
          const key = typeof keys === 'string' ? keys : Object.keys(keys)[0];
          return Promise.resolve(key in store ? { [key]: store[key] } : {});
        },
        set: (obj) => {
          Object.assign(store, obj);
          return Promise.resolve();
        },
        remove: (keys) => {
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]);
          return Promise.resolve();
        },
      },
    },
  };
  global.window = { RMF_Defaults: { CACHE_PREFIX: 'rmf_cache_test_' } };
  delete require.cache[require.resolve('../../utils/cache.js')];
});

test('cache returns null for missing entries', async () => {
  require('../../utils/cache.js');
  const val = await window.RMF_Cache.get('https://example.com/a.jpg');
  assert.equal(val, null);
});

test('cache round-trips detection results', async () => {
  require('../../utils/cache.js');
  const url = 'https://assets.myntassets.com/x.jpg';
  const data = { isAI: true, confidence: 92, source: 'preview' };
  await window.RMF_Cache.set(url, data);
  const hit = await window.RMF_Cache.get(url);
  assert.deepEqual(hit, data);
});

test('cache keys differ for different image URLs', async () => {
  require('../../utils/cache.js');
  await window.RMF_Cache.set('https://a.example/1.jpg', { n: 1 });
  await window.RMF_Cache.set('https://a.example/2.jpg', { n: 2 });
  assert.deepEqual(await window.RMF_Cache.get('https://a.example/1.jpg'), { n: 1 });
  assert.deepEqual(await window.RMF_Cache.get('https://a.example/2.jpg'), { n: 2 });
});

test('cache honors custom TTL expiry', async () => {
  require('../../utils/cache.js');
  const url = 'https://assets.myntassets.com/ttl.jpg';
  await window.RMF_Cache.set(url, { ok: true }, 1);
  const hit = await window.RMF_Cache.get(url);
  assert.deepEqual(hit, { ok: true });
  await new Promise((r) => setTimeout(r, 5));
  const miss = await window.RMF_Cache.get(url);
  assert.equal(miss, null);
});
