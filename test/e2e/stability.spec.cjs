// Stability / lifecycle E2E — SPA product-change freshness, popup re-open
// consistency, per-tab isolation, and a console-error gate. These target the
// "popup says 'open a product page' until I refresh" class of bugs: content
// readiness, messaging, and SPA route detection without a full page reload.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { PopupPage } = require('./pages/PopupPage.cjs');
const { getProduct } = require('./helpers/chrome-messaging.cjs');
const { closeMarketplaceTabs, activateMarketplaceTab } = require('./helpers/tab-utils.cjs');
const {
  MYNTRA_PRODUCT_URL,
  MYNTRA_PRODUCT_URL_2,
} = require('./helpers/constants.cjs');

const MYNTRA = 'https://www.myntra.com/*';

// Simulate an SPA product-to-product navigation the way a real PDP does it:
// change the URL via pushState AND mutate the title/og/JSON-LD nodes in place.
async function spaNavigateToProductB(page) {
  await page.evaluate((url) => {
    history.pushState({}, '', url);
    const setMeta = (sel, val) => { const m = document.querySelector(sel); if (m) m.setAttribute('content', val); };
    document.title = 'Other Brand Men Red Linen Casual Shirt - Buy Online';
    setMeta('meta[property="og:title"]', 'Other Brand Men Red Linen Casual Shirt');
    setMeta('meta[property="og:image"]', 'https://assets.myntassets.com/real3.png?product=2');
    setMeta('meta[property="product:brand"]', 'Other Brand');
    setMeta('meta[property="product:price:amount"]', '899');
    const h1 = document.querySelector('h1');
    if (h1) h1.textContent = 'Other Brand Men Red Linen Casual Shirt';
    const ld = document.querySelector('script[type="application/ld+json"]');
    if (ld) {
      ld.textContent = JSON.stringify({
        '@type': 'Product',
        name: 'Other Brand Men Red Linen Casual Shirt',
        brand: { name: 'Other Brand' },
        offers: { price: '899', seller: { name: 'Other Seller Ltd' } },
      });
    }
  }, MYNTRA_PRODUCT_URL_2);
}

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

    await expect.poll(async () => {
      const p = await getProduct(extensionContext, MYNTRA, MYNTRA_PRODUCT_URL);
      return p?.title || '';
    }, { timeout: 10_000 }).toMatch(/Test Brand/i);

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

  test('SPA product→product change keeps content script product in sync', async ({
    extensionContext, popupUrl,
  }) => {
    const productTab = await extensionContext.newPage();
    await productTab.goto(MYNTRA_PRODUCT_URL, { waitUntil: 'domcontentloaded' });

    await expect.poll(async () => {
      const p = await getProduct(extensionContext, MYNTRA, MYNTRA_PRODUCT_URL);
      return p?.title || '';
    }, { timeout: 10_000 }).toMatch(/Test Brand/i);

    const popupTab = await extensionContext.newPage();
    const popup = new PopupPage(popupTab);
    await popup.goto(popupUrl);
    await expect(popup.scanPanel).toBeVisible();

    await spaNavigateToProductB(productTab);

    await expect.poll(async () => {
      const p = await getProduct(extensionContext, MYNTRA, MYNTRA_PRODUCT_URL_2);
      return p?.title || '';
    }, { timeout: 12_000 }).toMatch(/Other Brand/i);

    await popupTab.close();
    await productTab.close();
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
    await expect.poll(async () => {
      const p = await getProduct(extensionContext, MYNTRA, MYNTRA_PRODUCT_URL_2);
      return p?.title || '';
    }, { timeout: 10_000 }).toMatch(/Other Brand/i);

    await activateMarketplaceTab(extensionContext, 'men-shirts');
    let popupTab = await extensionContext.newPage();
    let popup = new PopupPage(popupTab);
    await popup.goto(popupUrl);
    const listingCount = await popupTab.locator('#scan-count').textContent();
    expect(listingCount && /\d+/.test(listingCount)).toBe(true);
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
