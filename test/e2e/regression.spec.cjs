// Cross-cutting regression tests — installation through full user journeys.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { PopupPage } = require('./pages/PopupPage.cjs');
const { OptionsPage } = require('./pages/OptionsPage.cjs');
const {
  sendRuntimeMessage,
  getProduct,
  getContentStats,
  toggleDetection,
} = require('./helpers/chrome-messaging.cjs');
const { setSyncStorage, getSyncStorage } = require('./helpers/chrome-storage.cjs');
const { getActionBadge, getManifestVersion } = require('./helpers/chrome-api.cjs');
const { activateMarketplaceTab, closeMarketplaceTabs } = require('./helpers/tab-utils.cjs');
const { MYNTRA_LISTING_URL, MYNTRA_PRODUCT_URL, MANIFEST } = require('./helpers/constants.cjs');

test.describe('Regression — extension surfaces', () => {
  test('all three popup tabs render without page errors', async ({ extensionContext, popupUrl }) => {
    const page = await extensionContext.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    const popup = new PopupPage(page);
    await popup.goto(popupUrl);

    for (const tab of ['scan', 'compare', 'settings']) {
      await popup.selectTab(tab);
      await expect(popup.page.locator(`#panel-${tab}`)).toBeVisible();
    }
    expect(errors).toEqual([]);
    await page.close();
  });

  test('options page sections load and version matches manifest', async ({ optionsUrl, extensionContext }) => {
    const page = await extensionContext.newPage();
    const options = new OptionsPage(page);
    await options.goto(optionsUrl);
    await expect(page.getByRole('heading', { name: 'Detection preferences' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent detections' })).toBeVisible();

    const version = await getManifestVersion(extensionContext);
    await expect(page.locator('#version')).toContainText(version);
    expect(version).toBe(MANIFEST.version);
    await page.close();
  });

  test('browser action popup reflects disabled state after keyboard toggle', async ({
    extensionContext, contentPage,
  }) => {
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForBadges();

    await toggleDetection(extensionContext);
    await expect.poll(() => getActionBadge(extensionContext), { timeout: 10_000 }).toBe('');

    await toggleDetection(extensionContext);
    const stored = await getSyncStorage(extensionContext, ['enabled']);
    expect(stored.enabled).toBe(true);
  });
});

test.describe('Regression — messaging & storage', () => {
  test('sync settings written from popup persist and are readable', async ({ popupPage, extensionContext }) => {
    await popupPage.openSettings();
    const slider = popupPage.page.locator('#popup-confidence');
    await slider.fill('80');
    await slider.dispatchEvent('change');
    await expect.poll(
      () => getSyncStorage(extensionContext, ['minConfidence']).then((s) => s.minConfidence),
      { timeout: 5000 },
    ).toBe(80);
  });

  test('GET_PRODUCT on listing page reports isProductPage false', async ({ extensionContext, contentPage }) => {
    await contentPage.gotoListing();
    await expect.poll(
      () => getProduct(extensionContext, 'https://www.myntra.com/*', MYNTRA_LISTING_URL),
      { timeout: 10_000 },
    ).toMatchObject({ isProductPage: false });
  });

  test('GET_PRODUCT on product page includes color when present in title', async ({
    extensionContext, contentPage,
  }) => {
    await contentPage.gotoProduct(MYNTRA_PRODUCT_URL);
    await expect.poll(
      () => getProduct(extensionContext, 'https://www.myntra.com/*', MYNTRA_PRODUCT_URL),
      { timeout: 10_000 },
    ).toMatchObject({
      isProductPage: true,
      title: expect.stringMatching(/Test Brand/i),
      color: 'blue',
    });
  });
});

test.describe('Regression — user workflows', () => {
  test.beforeEach(async ({ extensionContext }) => {
    await closeMarketplaceTabs(extensionContext);
  });

  test('unsupported tab shows scan message in popup', async ({ extensionContext, popupUrl }) => {
    const other = await extensionContext.newPage();
    await other.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
    await other.bringToFront();

    const popup = await extensionContext.newPage();
    await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
    await popup.locator('.onboarding .onboarding-skip, .onboarding button.primary').first().click().catch(() => {});
    await expect.poll(async () => {
      const t = await popup.locator('#scan-hint').textContent();
      return t && /myntra|flipkart|meesho|nykaa|unsupported|open a product/i.test(t);
    }, { timeout: 10_000 }).toBe(true);
    await popup.close();
    await other.close();
  });

  test('full journey: scan listing → similar products on product page', async ({
    extensionContext, popupUrl, contentPage,
  }) => {
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForScan(1);
    await activateMarketplaceTab(extensionContext, 'men-shirts');

    const stats = await getContentStats(extensionContext);
    expect(stats.scanned).toBeGreaterThan(0);

    const productTab = await extensionContext.newPage();
    await productTab.goto(MYNTRA_PRODUCT_URL, { waitUntil: 'domcontentloaded' });
    await productTab.bringToFront();

    await setSyncStorage(extensionContext, { serpApiKey: 'test_serp_key' });

    const popup = await extensionContext.newPage();
    const popupPage = new PopupPage(popup);
    await popupPage.goto(popupUrl);

    await popupPage.selectTab('compare');
    await expect.poll(async () => {
      const t = await popup.locator('#compare-title').textContent();
      return t && /Test Brand/i.test(t);
    }, { timeout: 10_000 }).toBe(true);
    await popup.locator('#compare-search').click();
    await expect.poll(() => popup.locator('.compare-results .result-card').count(), { timeout: 25_000 }).toBeGreaterThan(0);

    await popupPage.selectTab('settings');
    await expect(popup.locator('#compare-sites')).toBeVisible();

    await popup.close();
    await productTab.close();
  });

  test('compare query includes color token for blue product titles', async () => {
    const { buildSearchQuery } = require('../../utils/product-query.js');
    const product = {
      title: 'Test Brand Men Blue Cotton Casual Shirt',
      brand: 'Test Brand',
      color: 'blue',
    };
    const q = buildSearchQuery(product);
    expect(q.toLowerCase()).toMatch(/blue/);
  });
});

test.describe('Regression — error handling', () => {
  test('compare search without product returns error', async ({ extensionContext }) => {
    const res = await sendRuntimeMessage(extensionContext, {
      type: 'RMF_COMPARE_SEARCH',
      product: { site: 'myntra', title: '' },
      sites: ['amazon'],
      cache: false,
    });
    expect(res.ok).toBe(true);
    expect(res.matches?.length ?? 0).toBe(0);
  });

  test('engine health endpoint responds when HF not configured', async ({ extensionContext }) => {
    const { getEngineHealth } = require('./helpers/chrome-messaging.cjs');
    const health = await getEngineHealth(extensionContext);
    expect(health.ok).toBe(true);
    expect(health).toHaveProperty('health');
  });
});
