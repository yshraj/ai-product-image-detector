// Message passing: popup ↔ background ↔ content script.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const {
  getContentStats,
  getProduct,
  getPageReport,
  rescanTab,
  setContentEnabled,
  toggleDetection,
  validateHfToken,
  fetchImageViaWorker,
  remoteDetectViaWorker,
  getEngineHealth,
} = require('./helpers/chrome-messaging.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');
const { MYNTRA_LISTING_URL, MYNTRA_PRODUCT_URL } = require('./helpers/constants.cjs');
const { registerHfInferenceMock } = require('./helpers/mock-routes.cjs');

test.describe('Message passing', () => {
  test('content script responds to GET_STATS after page scan', async ({ extensionContext, contentPage }) => {
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForScan();

    const stats = await getContentStats(extensionContext);
    expect(stats).toBeTruthy();
    expect(stats.scanned).toBeGreaterThan(0);
    expect(typeof stats.ai).toBe('number');
    expect(typeof stats.aiHigh).toBe('number');
    expect(typeof stats.aiLikely).toBe('number');
  });

  test('content script responds to GET_PRODUCT on a product page', async ({ extensionContext, contentPage }) => {
    await contentPage.gotoProduct(MYNTRA_PRODUCT_URL);
    await expect.poll(
      () => getProduct(extensionContext, 'https://www.myntra.com/*', MYNTRA_PRODUCT_URL),
      { timeout: 10_000 },
    ).toMatchObject({ site: 'myntra', title: expect.stringContaining('Test Brand') });
  });

  test('GET_PAGE_REPORT returns structured export data', async ({ extensionContext, contentPage }) => {
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForScan();

    const report = await getPageReport(extensionContext);
    expect(report.products.length).toBeGreaterThan(0);
    expect(report.site).toBe('myntra');
    expect(report.app).toBeTruthy();
    expect(report.products[0]).toHaveProperty('confidence');
    expect(report.products[0]).toHaveProperty('verdict');
  });

  test('RESCAN clears and re-runs detection', async ({ extensionContext, contentPage }) => {
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForBadges();

    const res = await rescanTab(extensionContext);
    expect(res?.ok).toBe(true);
    await contentPage.waitForBadges(1, 15_000);
  });

  test('SET_ENABLED toggles content-script scanning', async ({ extensionContext, contentPage }) => {
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForBadges();

    await setContentEnabled(extensionContext, false);
    await contentPage.page.waitForTimeout(500);
    expect(await contentPage.badges.count()).toBe(0);

    await setContentEnabled(extensionContext, true);
    await contentPage.waitForBadges(1, 15_000);
  });

  test('background validates Hugging Face tokens', async ({ extensionContext }) => {
    const ok = await validateHfToken(extensionContext, 'hf_demotoken123');
    expect(ok.ok).toBe(true);
    expect(ok.user).toBe('testuser');

    const bad = await validateHfToken(extensionContext, 'hf_badtoken999');
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/rejected/i);
  });

  test('background fetches images for the content script (CORS bypass)', async ({ extensionContext }) => {
    const res = await fetchImageViaWorker(extensionContext, 'https://assets.myntassets.com/ai0.png');
    expect(res.ok).toBe(true);
    expect(res.dataUrl).toMatch(/^data:image\/[^;]+;base64,/);
  });

  test('background blocks SSRF URLs in RMF_FETCH_IMAGE', async ({ extensionContext }) => {
    const res = await fetchImageViaWorker(extensionContext, 'http://127.0.0.1/secret.png');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/blocked/i);
  });

  test('background runs remote detection when HF is configured', async ({ extensionContext }) => {
    const hf = await registerHfInferenceMock(extensionContext);
    await setSyncStorage(extensionContext, {
      provider: 'huggingface',
      hfToken: 'hf_testtoken',
      hfModel: 'test/model',
    });

    const res = await remoteDetectViaWorker(extensionContext, 'https://assets.myntassets.com/ai0.png');
    expect(res.ok).toBe(true);
    expect(res.result.confidence).toBe(97);
    expect(hf.getCallCount()).toBeGreaterThan(0);

    const health = await getEngineHealth(extensionContext);
    expect(health.ok).toBe(true);
    expect(health.health?.status).toBe('ok');
  });

  test('RMF_TOGGLE_ENABLED flips the global enabled flag', async ({ extensionContext }) => {
    const first = await toggleDetection(extensionContext);
    expect(first.ok).toBe(true);
    expect(typeof first.enabled).toBe('boolean');

    const second = await toggleDetection(extensionContext);
    expect(second.enabled).toBe(!first.enabled);
  });
});
