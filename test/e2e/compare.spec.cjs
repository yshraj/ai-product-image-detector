// Compare tab — SerpApi path mocked via Playwright route interception.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');
const { sendRuntimeMessage, getProduct } = require('./helpers/chrome-messaging.cjs');
const { MYNTRA_PRODUCT_URL } = require('./helpers/constants.cjs');
const { closeMarketplaceTabs } = require('./helpers/tab-utils.cjs');

test.describe('Compare search (mocked SerpApi)', () => {
  test.beforeEach(async ({ extensionContext }) => {
    await closeMarketplaceTabs(extensionContext);
  });

  test('returns scored matches from mocked Google Shopping', async ({ extensionContext }) => {
    await setSyncStorage(extensionContext, {
      serpApiKey: 'test_serp_key',
      compareSites: ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa'],
    });

    const productTab = await extensionContext.newPage();
    await productTab.goto(MYNTRA_PRODUCT_URL, { waitUntil: 'domcontentloaded' });

    await expect.poll(async () => {
      const p = await getProduct(extensionContext, 'https://www.myntra.com/*', MYNTRA_PRODUCT_URL);
      return p?.title && /Test Brand/i.test(p.title);
    }, { timeout: 10_000 }).toBe(true);

    const product = await getProduct(extensionContext, 'https://www.myntra.com/*', MYNTRA_PRODUCT_URL);
    const res = await sendRuntimeMessage(extensionContext, {
      type: 'RMF_COMPARE_SEARCH',
      product,
      sites: ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa'],
      cache: false,
    });

    expect(res.ok).toBe(true);
    expect(res.source).toBe('serp');
    expect(res.matches?.length).toBeGreaterThan(0);
    expect(res.matches[0].best.match.score).toBeGreaterThanOrEqual(40);
    await productTab.close();
  });

  test('caches compare results in local storage on repeat search', async ({ extensionContext }) => {
    await setSyncStorage(extensionContext, {
      serpApiKey: 'test_serp_key',
      compareSites: ['amazon', 'flipkart'],
    });

    const productTab = await extensionContext.newPage();
    await productTab.goto(MYNTRA_PRODUCT_URL, { waitUntil: 'domcontentloaded' });

    await expect.poll(async () => {
      const p = await getProduct(extensionContext, 'https://www.myntra.com/*', MYNTRA_PRODUCT_URL);
      return p?.title && /Test Brand/i.test(p.title);
    }, { timeout: 10_000 }).toBe(true);

    const product = await getProduct(extensionContext, 'https://www.myntra.com/*', MYNTRA_PRODUCT_URL);

    const first = await sendRuntimeMessage(extensionContext, {
      type: 'RMF_COMPARE_SEARCH',
      product,
      sites: ['amazon', 'flipkart'],
      cache: false,
    });
    expect(first.ok).toBe(true);
    expect(first.cached).toBe(false);

    const second = await sendRuntimeMessage(extensionContext, {
      type: 'RMF_COMPARE_SEARCH',
      product,
      sites: ['amazon', 'flipkart'],
      cache: true,
    });
    expect(second.ok).toBe(true);
    expect(second.cached).toBe(true);
    await productTab.close();
  });
});
