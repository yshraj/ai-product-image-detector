// "Why flagged?" badge popover — transparency, actions, keyboard.
const { test, expect } = require('./fixtures/extension.fixture.cjs');

test('badge click reveals a transparent details popover (preview engine)', async ({ contentPage }) => {
  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await contentPage.waitForBadges();

  await contentPage.badges.first().click();
  await expect(contentPage.popover).toBeVisible();
  await expect(contentPage.popover).toContainText('Why flagged?');
  await expect(contentPage.popover).toContainText('preview');
  await expect(contentPage.page.locator('.rmf-badge[aria-expanded="true"]')).toHaveCount(1);

  const pop = contentPage.popover;
  await expect(pop.locator('a[href^="https://lens.google.com/uploadbyurl"]')).toBeVisible();
  await expect(pop.locator('a[href*="amazon.in/s?k="]')).toBeVisible();
  await expect(pop.locator('a[href*="myntra.com/search"]')).toHaveCount(0);

  await contentPage.page.locator('.rmf-pop-close').click();
  await expect(contentPage.popover).toHaveCount(0);
});

test('only one popover is open at a time and Escape closes it', async ({ contentPage }) => {
  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await contentPage.waitForBadges();

  await contentPage.badges.nth(0).click();
  await contentPage.badges.nth(1).click();
  await expect(contentPage.popover).toHaveCount(1);

  await contentPage.page.keyboard.press('Escape');
  await expect(contentPage.popover).toHaveCount(0);
});
