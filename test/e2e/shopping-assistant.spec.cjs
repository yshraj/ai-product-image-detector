// Shopping assistant UI: Compare + Tools tabs (regression).
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');
const { closeMarketplaceTabs, activateMarketplaceTab } = require('./helpers/tab-utils.cjs');
const { MYNTRA_PRODUCT_URL } = require('./helpers/constants.cjs');

test.describe('Shopping assistant — Compare & Tools', () => {
  test.beforeEach(async ({ extensionContext }) => {
    await closeMarketplaceTabs(extensionContext);
  });
  test('Compare tab shows auto-search and manual marketplace links', async ({ extensionContext, popupUrl }) => {
    const productTab = await extensionContext.newPage();
    await productTab.goto(MYNTRA_PRODUCT_URL, { waitUntil: 'domcontentloaded' });
    const { getProduct } = require('./helpers/chrome-messaging.cjs');
    await expect.poll(
      () => getProduct(extensionContext, 'https://www.myntra.com/*', MYNTRA_PRODUCT_URL),
      { timeout: 10_000 },
    ).toMatchObject({ title: expect.stringMatching(/Test Brand/i) });

    const popup = await extensionContext.newPage();
    await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
    await popup.locator('#nav-compare').click();
    await expect.poll(async () => {
      const t = await popup.locator('#compare-title').textContent();
      return t && /Test Brand/i.test(t);
    }, { timeout: 10_000 }).toBe(true);
    await expect(popup.locator('#compare-search')).toBeVisible();
    await popup.locator('#compare-manual').evaluate((el) => { el.open = true; });
    await expect(popup.locator('#compare-list a')).toHaveCount(4);
    await popup.close();
    await productTab.close();
  });

  test('Compare respects marketplace toggles in Settings', async ({ extensionContext, popupUrl }) => {
    await setSyncStorage(extensionContext, { compareSites: ['amazon'] });

    const productTab = await extensionContext.newPage();
    await productTab.goto(MYNTRA_PRODUCT_URL, { waitUntil: 'domcontentloaded' });

    const popup = await extensionContext.newPage();
    await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
    await popup.locator('#nav-settings').click();
    await popup.locator('#compare-sites input[data-site="amazon"]').waitFor({ state: 'visible' });
    await popup.locator('#nav-compare').click();
    await expect.poll(async () => {
      const t = await popup.locator('#compare-title').textContent();
      return t && /Test Brand/i.test(t);
    }, { timeout: 10_000 }).toBe(true);
    await popup.locator('#compare-manual').evaluate((el) => { el.open = true; });
    await expect.poll(() => popup.locator('#compare-list a').count(), { timeout: 10_000 }).toBe(1);
    await popup.close();
    await productTab.close();
  });

  test('Tools tab offers reverse image search and copy actions', async ({ extensionContext, popupUrl }) => {
    const productTab = await extensionContext.newPage();
    await productTab.goto(MYNTRA_PRODUCT_URL, { waitUntil: 'domcontentloaded' });

    const popup = await extensionContext.newPage();
    await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
    await popup.locator('#nav-tools').click();
    await expect.poll(() => popup.locator('#reverse-list a').count(), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect.poll(() => popup.locator('#tools-list button').count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(5);
    await popup.close();
    await productTab.close();
  });

  test('Scan tab shows confidence threshold hint on a listing page', async ({ extensionContext, popupUrl, contentPage }) => {
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForScan(1);

    await activateMarketplaceTab(extensionContext, 'men-shirts');
    const popup = await extensionContext.newPage();
    await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
    await popup.locator('#nav-scan').click();
    await expect.poll(async () => {
      const t = await popup.locator('#conf-hint').textContent();
      return t && /70%/.test(t);
    }, { timeout: 10_000 }).toBe(true);
    await popup.close();
  });
});
