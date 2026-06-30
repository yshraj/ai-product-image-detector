// Page export report (GET_PAGE_REPORT).
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { getPageReport } = require('./helpers/chrome-messaging.cjs');

test('GET_PAGE_REPORT returns scanned products with verdicts', async ({ extensionContext, contentPage }) => {
  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await contentPage.waitForScan();

  const report = await getPageReport(extensionContext);
  expect(report.app).toMatch(/Shopping Assistant|ShopShield/);
  expect(report.site).toBe('myntra');
  expect(report.products.length).toBeGreaterThan(0);
  expect(report.products[0]).toMatchObject({
    verdict: expect.stringMatching(/^(ai|real)$/),
    confidence: expect.any(Number),
  });
});
