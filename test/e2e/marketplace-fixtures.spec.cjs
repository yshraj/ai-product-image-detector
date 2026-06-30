// Multi-marketplace fixture coverage — all sites use local HTML, never live pages.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');

const SITES = [
  { name: 'myntra', url: 'https://www.myntra.com/men-shirts', card: '.product-base' },
  { name: 'flipkart', url: 'https://www.flipkart.com/search?q=shirt', card: '._1AtVbE' },
  { name: 'meesho', url: 'https://www.meesho.com/search?q=shirt', card: '[data-testid="product-card"]' },
  { name: 'nykaa', url: 'https://www.nykaa.com/search/result/?q=shirt', card: '.css-d5z3ro' },
];

for (const site of SITES) {
  test(`${site.name} listing scans from local fixture`, async ({ extensionContext }) => {
    await setSyncStorage(extensionContext, { provider: 'heuristic', minConfidence: 70 });
    const page = await extensionContext.newPage();
    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.goto(site.url, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.locator(site.card).count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await expect.poll(() => page.locator('[data-rmf-scanned]').count(), { timeout: 20_000 }).toBeGreaterThan(0);
    await page.close();
  });
}
