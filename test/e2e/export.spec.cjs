// test/e2e/export.spec.cjs
// The content script builds a page report (name/price/verdict per scanned card)
// that the popup serialises to JSON/CSV.
const { test, expect } = require('@playwright/test');
const { launch, serviceWorker } = require('./_setup.cjs');

let context;
test.beforeAll(async () => { context = await launch(); });
test.afterAll(async () => { await context?.close(); });

test('GET_PAGE_REPORT returns scanned products with verdicts', async () => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.locator('.rmf-badge').count(), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(800);

  const sw = await serviceWorker(context);
  const report = await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://www.myntra.com/*' });
    return chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_REPORT' });
  });

  expect(report.app).toBe('RealModel Filter');
  expect(report.site).toBe('myntra');
  expect(report.products.length, 'report has scanned products').toBeGreaterThan(0);
  expect(report.aiFlagged, 'some flagged as AI').toBeGreaterThan(0);

  const p = report.products[0];
  expect(p).toHaveProperty('name');
  expect(p).toHaveProperty('verdict');
  expect(['ai', 'real']).toContain(p.verdict);
  expect(typeof p.confidence).toBe('number');
  expect(p.imageUrl).toMatch(/^https?:\/\//);

  // At least one AI verdict among the fixtures.
  expect(report.products.some((x) => x.verdict === 'ai')).toBe(true);
  console.log(`\n[e2e] report: ${report.products.length} products, ${report.aiFlagged} AI`);
  await page.close();
});
