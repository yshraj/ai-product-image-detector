// Compare production hardening — stale navigation, refresh, partial failure.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');
const { closeMarketplaceTabs, activateMarketplaceTab } = require('./helpers/tab-utils.cjs');
const { MYNTRA_PRODUCT_URL, MYNTRA_PRODUCT_URL_2 } = require('./helpers/constants.cjs');

function productUrlPart(url) {
  if (url.includes('9876543')) return '9876543';
  return '1234567';
}

async function openCompareWithProduct(extensionContext, popupUrl, productUrl) {
  const productTab = await extensionContext.newPage();
  await productTab.goto(productUrl, { waitUntil: 'domcontentloaded' });

  const popup = await extensionContext.newPage();
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.locator('.onboarding .onboarding-skip, .onboarding button.primary').first().click().catch(() => {});

  await activateMarketplaceTab(extensionContext, productUrlPart(productUrl));
  await popup.locator('#nav-compare').click();

  await expect.poll(async () => {
    const t = await popup.locator('#compare-title').textContent();
    return t && !/Open a product page/i.test(t);
  }, { timeout: 15_000 }).toBe(true);

  return { productTab, popup };
}

test.describe('Compare hardening', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ extensionContext }) => {
    await closeMarketplaceTabs(extensionContext);
    await setSyncStorage(extensionContext, {
      serpApiKey: 'test_serp_key',
      compareSites: ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa'],
    });
  });

  test('does not show stale results after navigating to a different product', async ({ extensionContext, popupUrl }) => {
    const { productTab, popup } = await openCompareWithProduct(extensionContext, popupUrl, MYNTRA_PRODUCT_URL);

    await expect.poll(
      () => popup.locator('#compare-results .result-card').count(),
      { timeout: 45_000 },
    ).toBeGreaterThan(0);
    await expect(popup.locator('#compare-title')).toContainText('Test Brand');

    await productTab.goto(MYNTRA_PRODUCT_URL_2, { waitUntil: 'domcontentloaded' });
    await activateMarketplaceTab(extensionContext, productUrlPart(MYNTRA_PRODUCT_URL_2));

    await expect.poll(
      () => popup.locator('#compare-title').textContent(),
      { timeout: 20_000 },
    ).toMatch(/Other Brand/i);

    await expect.poll(
      () => popup.locator('#compare-results .result-card').count(),
      { timeout: 45_000 },
    ).toBeGreaterThan(0);
    await expect(popup.locator('#compare-title')).not.toContainText('Test Brand Men Blue');

    await popup.close();
    await productTab.close();
  });

  test('refresh clears result cards before showing new results', async ({ extensionContext, popupUrl }) => {
    const { productTab, popup } = await openCompareWithProduct(extensionContext, popupUrl, MYNTRA_PRODUCT_URL);

    await expect.poll(
      () => popup.locator('#compare-results .result-card').count(),
      { timeout: 45_000 },
    ).toBeGreaterThan(0);

    const refresh = popup.locator('#compare-refresh');
    await refresh.click();

    await expect.poll(async () => {
      const cards = await popup.locator('#compare-results .result-card').count();
      const skeleton = await popup.locator('#compare-skeleton').isVisible();
      return cards === 0 || skeleton;
    }, { timeout: 5000 }).toBe(true);

    await expect.poll(
      () => popup.locator('#compare-results .result-card').count(),
      { timeout: 45_000 },
    ).toBeGreaterThan(0);

    await popup.close();
    await productTab.close();
  });

  test('partial failure still renders matches and shows warning', async ({ extensionContext, popupUrl }) => {
    const serpHandler = async (route) => {
      const url = route.request().url();
      if (url.includes('engine=google_shopping')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            shopping_results: [
              {
                title: 'Test Brand Men Blue Cotton Casual Shirt',
                price: '₹1,299',
                link: 'https://www.flipkart.com/test-shirt/p/itm123',
                thumbnail: 'https://assets.myntassets.com/real3.png',
              },
            ],
          }),
        });
      }
      return route.continue();
    };
    await extensionContext.route('https://serpapi.com/**', serpHandler);

    try {
      const { productTab, popup } = await openCompareWithProduct(extensionContext, popupUrl, MYNTRA_PRODUCT_URL);

      await expect.poll(
        () => popup.locator('#compare-results .result-card').count(),
        { timeout: 45_000 },
      ).toBeGreaterThan(0);

      const siteStatus = await popup.locator('#compare-site-status').textContent();
      expect(siteStatus?.length).toBeGreaterThan(0);

      await popup.close();
      await productTab.close();
    } finally {
      await extensionContext.unroute('https://serpapi.com/**', serpHandler);
    }
  });
});
