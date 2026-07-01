// test/unit/tab-search.test.cjs — hidden tab scrape helper (mocked chrome APIs)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const TabSearch = require('../../compare/tab-search.js');

function makeChromeMock({ tabComplete = true, items = [], loadDelayMs = 0, failLoad = false } = {}) {
  const removed = [];
  let createdUrl = '';
  return {
    removed,
    chrome: {
      tabs: {
        create: async ({ url, active }) => {
          createdUrl = url;
          assert.equal(active, false);
          return { id: 42, status: tabComplete ? 'complete' : 'loading' };
        },
        get: async () => ({ id: 42, status: tabComplete ? 'complete' : 'loading' }),
        remove: async (id) => { removed.push(id); },
        onUpdated: {
          _listeners: [],
          addListener(fn) { this._listeners.push(fn); },
          removeListener(fn) {
            this._listeners = this._listeners.filter((f) => f !== fn);
          },
          emit(id, info) { this._listeners.forEach((fn) => fn(id, info)); },
        },
      },
      scripting: {
        executeScript: async ({ files, func, args }) => {
          if (loadDelayMs) await new Promise((r) => setTimeout(r, loadDelayMs));
          if (failLoad) throw new Error('injection failed');
          if (files) return [{ result: undefined }];
          if (func) return [{ result: items }];
          return [{ result: [] }];
        },
      },
    },
    getCreatedUrl: () => createdUrl,
  };
}

test('openHiddenSearchTab opens inactive tab with encoded search URL', async () => {
  const mock = makeChromeMock({ items: [{ title: 'Test Shoe', price: '₹999', url: 'https://x', image: '' }] });
  global.chrome = mock.chrome;

  const result = await TabSearch.openHiddenSearchTab('amazon', 'nike air max black');
  assert.equal(result.ok, true);
  assert.equal(result.platform, 'amazon');
  assert.ok(result.items.length >= 1);
  assert.match(mock.getCreatedUrl(), /amazon\.in\/s\?k=nike/);
  assert.deepEqual(mock.removed, [42]);
  delete global.chrome;
});

test('openHiddenSearchTab always removes tab on scrape failure', async () => {
  const mock = makeChromeMock({ failLoad: true });
  global.chrome = mock.chrome;

  const result = await TabSearch.openHiddenSearchTab('flipkart', 'roadster shirt');
  assert.equal(result.ok, false);
  assert.ok(result.error);
  assert.deepEqual(mock.removed, [42]);
  delete global.chrome;
});

test('openHiddenSearchTab times out slow page loads and cleans up tab', async () => {
  const mock = makeChromeMock({ tabComplete: false, loadDelayMs: 50 });
  global.chrome = mock.chrome;

  const result = await TabSearch.openHiddenSearchTab('myntra', 'shirt', {
    timeoutMs: 30,
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /timeout/i);
  assert.deepEqual(mock.removed, [42]);
  delete global.chrome;
});

test('openHiddenSearchTab rejects unknown platform', async () => {
  const result = await TabSearch.openHiddenSearchTab('unknown', 'query');
  assert.equal(result.ok, false);
  assert.match(result.error, /unknown platform/);
});

test('fetchSearchPageViaTab delegates to openHiddenSearchTab', async () => {
  const mock = makeChromeMock({ items: [{ title: 'Nykaa Lipstick', price: '₹399', url: 'https://nykaa.com/p/1', image: '' }] });
  global.chrome = mock.chrome;

  const items = await TabSearch.fetchSearchPageViaTab(
    'https://www.nykaa.com/search/result/?q=lipstick',
    'nykaa',
  );
  assert.ok(items.length >= 1);
  assert.deepEqual(mock.removed, [42]);
  delete global.chrome;
});
