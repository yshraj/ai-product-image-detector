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
  MYNTRA_LISTING_URL,
} = require('./helpers/constants.cjs');

const MYNTRA = 'https://www.myntra.com/*';

// Simulate an SPA product-to-product navigation the way a real PDP does it:
// change the URL via pushState AND mutate the title/og/JSON-LD nodes in place.
// The content script's MutationObserver (title selectors) + 1200ms popup poll
// are what actually re-detect the product — the pushState wrapper alone runs in
// the page's main world and never reaches the isolated content-script world.
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

// Collect uncaught exceptions and console.error output on a page. Resource-load
// failures (image 404s etc.) are ignored — we only gate on real JS errors.
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

  // ---- The flagship symptom, happy path: popup opened while already on a
  // product page must detect the product without a refresh. -----------------
  test('popup opened on a product page detects the product without refresh', async ({
    extensionContext, popupUrl,
  }) => {
    const productTab = await extensionContext.newPage();
    await productTab.goto(MYNTRA_PRODUCT_URL, { waitUntil: 'domcontentloaded' });

    // Content script must be ready and returning the product.
    await expect.poll(async () => {
      const p = await getProduct(extensionContext, MYNTRA, MYNTRA_PRODUCT_URL);
      return p?.title || '';
    }, { timeout: 10_000 }).toMatch(/Test Brand/i);

    const popupTab = await extensionContext.newPage();
    const popup = new PopupPage(popupTab);
    await popup.goto(popupUrl);
    await popup.selectTab('compare');

    const title = popupTab.locator('#compare-title');
    await expect(title).toContainText(/Test Brand/i, { timeout: 12_000 });
    await expect(title).not.toHaveClass(/muted/);

    await popupTab.close();
    await productTab.close();
  });

  // ---- SPA route change (no reload) must refresh the popup's product. ------
  test('SPA product→product change refreshes the popup without a reload', async ({
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
    await popup.selectTab('compare');
    await expect(popupTab.locator('#compare-title')).toContainText(/Test Brand/i, { timeout: 12_000 });

    // Navigate to a different product entirely in-page (no reload).
    await spaNavigateToProductB(productTab);

    // The popup must reflect the new product without being reopened or the page
    // reloaded — via RMF_PRODUCT_CHANGED or the 1200ms watcher poll.
    await expect(popupTab.locator('#compare-title')).toContainText(/Other Brand/i, { timeout: 12_000 });

    await popupTab.close();
    await productTab.close();
  });

  // ---- Per-active-tab isolation: no product state leaks between tabs. ------
  test('popup reflects the active tab, not a stale one', async ({ extensionContext, popupUrl }) => {
    const tabA = await extensionContext.newPage();
    await tabA.goto(MYNTRA_PRODUCT_URL, { waitUntil: 'domcontentloaded' });
    const tabB = await extensionContext.newPage();
    await tabB.goto(MYNTRA_PRODUCT_URL_2, { waitUntil: 'domcontentloaded' });

    await expect.poll(async () => {
      const p = await getProduct(extensionContext, MYNTRA, MYNTRA_PRODUCT_URL_2);
      return p?.title || '';
    }, { timeout: 10_000 }).toMatch(/Other Brand/i);

    // Activate product A, open a fresh popup → must show A.
    await activateMarketplaceTab(extensionContext, '1234567');
    let popupTab = await extensionContext.newPage();
    let popup = new PopupPage(popupTab);
    await popup.goto(popupUrl);
    await popup.selectTab('compare');
    await expect(popupTab.locator('#compare-title')).toContainText(/Test Brand/i, { timeout: 12_000 });
    await popupTab.close();

    // Activate product B, open a fresh popup → must show B (no leak from A).
    await activateMarketplaceTab(extensionContext, '9876543');
    popupTab = await extensionContext.newPage();
    popup = new PopupPage(popupTab);
    await popup.goto(popupUrl);
    await popup.selectTab('compare');
    await expect(popupTab.locator('#compare-title')).toContainText(/Other Brand/i, { timeout: 12_000 });
    await popupTab.close();

    await tabA.close();
    await tabB.close();
  });

  // ---- Repeated open/close must re-initialise cleanly with no JS errors. ---
  // A representative sample of the "open 100+ times" requirement — kept modest
  // so it stays fast in CI while still exercising re-initialisation.
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

      // Every tab must render its status chip and switch cleanly each time.
      await expect(popup.statusChip).toBeVisible();
      await popup.selectTab('compare');
      await expect(popup.comparePanel).toBeVisible();
      await popup.selectTab('settings');
      await expect(popup.settingsPanel).toBeVisible();
      await popup.selectTab('scan');
      await expect(popup.scanPanel).toBeVisible();

      await page.close();
    }
    expect(errors, `console/page errors across ${OPENS} popup opens:\n${errors.join('\n')}`).toEqual([]);
  });

  // ---- Listing page shows the empty state (not a false product). ----------
  test('popup on a category page shows the empty state, not a stale product', async ({
    extensionContext, popupUrl,
  }) => {
    const listingTab = await extensionContext.newPage();
    await listingTab.goto(MYNTRA_LISTING_URL, { waitUntil: 'domcontentloaded' });

    const popupTab = await extensionContext.newPage();
    const popup = new PopupPage(popupTab);
    await popup.goto(popupUrl);
    await popup.selectTab('compare');

    await expect(popupTab.locator('#compare-title')).toContainText(/open a product page/i, { timeout: 12_000 });
    await popupTab.close();
    await listingTab.close();
  });
});
