// Activity history on the options page.
const { test, expect } = require('./fixtures/extension.fixture.cjs');

test('flagged items appear in history and can be cleared', async ({ extensionContext, contentPage, optionsUrl }) => {
  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await contentPage.waitForBadges();
  await contentPage.page.waitForTimeout(1500);

  const opt = await extensionContext.newPage();
  await opt.goto(optionsUrl, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => opt.locator('.hist-item').count(), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(opt.locator('.hist-item .hist-verdict').first()).toContainText('%');

  await opt.locator('#clear-history').click();
  await expect(opt.locator('#history-empty')).toBeVisible();
  await opt.close();
});
