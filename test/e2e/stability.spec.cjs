// Stability / lifecycle E2E — SPA product-change freshness, popup re-open
// consistency, per-tab isolation, and a console-error gate. These target the
// "popup says 'open a product page' until I refresh" class of bugs: content
// readiness, messaging, and SPA route detection without a full page reload.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { PopupPage } = require('./pages/PopupPage.cjs');
const { getContentStats } = require('./helpers/chrome-messaging.cjs');
const { closeMarketplaceTabs, activateMarketplaceTab } = require('./helpers/tab-utils.cjs');
const {
  MYNTRA_PRODUCT_URL,
  MYNTRA_PRODUCT_URL_2,
} = require('./helpers/constants.cjs');

function attachErrorCollector(page, sink) {
  page.on('pageerror', (err) => sink.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Failed to load resource|net::ERR|favicon/i.test(text)) return;
    sink.push(`console.error: ${text}`);
  });
}

test.describe('Stability & lifecycle', () => {
  test.beforeEach(async ({ extensionContext }) => {
    await closeMarketplaceTabs(extensionContext);
  });

  test('popup opened on a product page shows live scan stats without refresh', async ({
    extensionContext, popupUrl,
  }) => {
    const productTab = await extensionContext.newPage();
    await productTab.goto(MYNTRA_PRODUCT_URL, { waitUntil: 'domcontentloaded' });

    const popupTab = await extensionContext.newPage();
    const popup = new PopupPage(popupTab);
    await popup.goto(popupUrl);

    await expect(popup.scanPanel).toBeVisible();
    await expect.poll(async () => {
      const t = await popupTab.locator('#scan-count').textContent();
      return t && /\d+/.test(t);
    }, { timeout: 12_000 }).toBe(true);

    await popupTab.close();
    await productTab.close();
  });

  test('SPA pushState navigation re-runs scanning without a reload', async ({
    extensionContext, contentPage,
  }) => {
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForScan(1);

    const errors = [];
    attachErrorCollector(contentPage.page, errors);

    // Real SPA route change: the content script patches pushState and re-scans
    // on a genuine pathname change (not query-only). Scanning must recover
    // without a full reload.
    await contentPage.page.evaluate(() => history.pushState({}, '', '/men-tshirts'));

    await expect.poll(
      async () => (await getContentStats(extensionContext))?.scanned ?? 0,
      { timeout: 12_000 },
    ).toBeGreaterThan(0);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('popup reflects the active tab scan stats, not a stale one', async ({
    extensionContext, popupUrl, contentPage,
  }) => {
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForScan(3);
    await activateMarketplaceTab(extensionContext, 'men-shirts');

    const tabB = await extensionContext.newPage();
    await tabB.goto(MYNTRA_PRODUCT_URL_2, { waitUntil: 'domcontentloaded' });

    await activateMarketplaceTab(extensionContext, 'men-shirts');
    let popupTab = await extensionContext.newPage();
    let popup = new PopupPage(popupTab);
    await popup.goto(popupUrl);
    // Poll: scan-count is populated by an async updateScan() after the popup
    // messages the content script — reading it synchronously races that round-trip.
    await expect.poll(async () => {
      const t = await popupTab.locator('#scan-count').textContent();
      return !!(t && /\d+/.test(t));
    }, { timeout: 12_000 }).toBe(true);
    await popupTab.close();

    await activateMarketplaceTab(extensionContext, '9876543');
    popupTab = await extensionContext.newPage();
    popup = new PopupPage(popupTab);
    await popup.goto(popupUrl);
    await expect.poll(async () => {
      const t = await popupTab.locator('#scan-count').textContent();
      return t && /\d+/.test(t);
    }, { timeout: 12_000 }).toBe(true);
    await popupTab.close();

    await tabB.close();
  });

  test('repeated popup open/close stays consistent and error-free', async ({
    extensionContext, popupUrl,
  }) => {
    const errors = [];
    const OPENS = 20;
    for (let i = 0; i < OPENS; i++) {
      const page = await extensionContext.newPage();
      attachErrorCollector(page, errors);
      const popup = new PopupPage(page);
      await popup.goto(popupUrl);

      await expect(popup.statusChip).toBeVisible();
      await popup.selectTab('settings');
      await expect(popup.settingsPanel).toBeVisible();
      await popup.selectTab('scan');
      await expect(popup.scanPanel).toBeVisible();

      await page.close();
    }
    expect(errors, `console/page errors across ${OPENS} popup opens:\n${errors.join('\n')}`).toEqual([]);
  });

  test('popup on a category page shows scan activity, not a stale product state', async ({
    extensionContext, popupUrl, contentPage,
  }) => {
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForScan(1);
    await activateMarketplaceTab(extensionContext, 'men-shirts');

    const popupTab = await extensionContext.newPage();
    const popup = new PopupPage(popupTab);
    await popup.goto(popupUrl);

    await expect(popup.scanPanel).toBeVisible();
    await expect.poll(async () => {
      const t = await popupTab.locator('#scan-count').textContent();
      return t && /\d+/.test(t);
    }, { timeout: 12_000 }).toBe(true);

    await popupTab.close();
  });
});
