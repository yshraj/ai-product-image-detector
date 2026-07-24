// chrome.storage read/write and persistence across browser restarts.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { launchExtensionContext, closeExtensionContext } = require('./helpers/extension-launcher.cjs');
const { setSyncStorage, getSyncStorage, setLocalStorage, getLocalStorage, clearDetectionCache } = require('./helpers/chrome-storage.cjs');
const { CACHE_PREFIX } = require('./helpers/constants.cjs');

test.describe('Chrome storage', () => {
  test('sync storage writes persist within the same session', async ({ extensionContext }) => {
    await setSyncStorage(extensionContext, { minConfidence: 85, mode: 'hide' });
    const stored = await getSyncStorage(extensionContext, ['minConfidence', 'mode']);
    expect(stored.minConfidence).toBe(85);
    expect(stored.mode).toBe('hide');
  });

  test('local cache entries are written during detection', async ({ extensionContext, contentPage }) => {
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForScan();

    const all = await getLocalStorage(extensionContext, null);
    const cacheKeys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
    expect(cacheKeys.length).toBeGreaterThan(0);
  });

  // Known occasional CI flake (GitHub Actions shared runners; not reproduced
  // locally): waitForScan() only guarantees the first card finished, and with
  // several viewport-visible cards under a 3-way concurrency limit, one can
  // still be mid-flight and write its cache entry right after
  // clearDetectionCache() runs. A fix polling on the content script's
  // GET_STATS `pending` count before clearing was tried and reverted 2026-07-25
  // — `pending` got stuck at a static non-zero value under artificial
  // --repeat-each stress even in full isolation, which needs its own
  // investigation before trusting that signal (see content.js's `pending`
  // bookkeeping in updateSessionCounts/processCard). Left as-is rather than
  // ship an unverified fix.
  test('clearing detection cache removes cached verdicts', async ({ extensionContext, contentPage }) => {
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForScan();

    const removed = await clearDetectionCache(extensionContext);
    expect(removed).toBeGreaterThan(0);

    const after = await getLocalStorage(extensionContext, null);
    expect(Object.keys(after).filter((k) => k.startsWith(CACHE_PREFIX))).toHaveLength(0);
  });

  test('local storage survives browser restart with the same user-data profile', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-ext-persist-'));

    const ctx1 = await launchExtensionContext({ userDataDir });
    await setLocalStorage(ctx1, { persist_test_key: 'persist-value' });
    await new Promise((r) => setTimeout(r, 1000));
    await closeExtensionContext(ctx1);

    const ctx2 = await launchExtensionContext({ userDataDir });
    try {
      const local = await getLocalStorage(ctx2, 'persist_test_key');
      expect(local.persist_test_key).toBe('persist-value');
    } finally {
      await closeExtensionContext(ctx2);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
