// Detection preferences change in-page behaviour.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');

test('minimum-confidence threshold suppresses lower-confidence flags', async ({ extensionContext, contentPage }) => {
  await setSyncStorage(extensionContext, { provider: 'heuristic', enabled: true, minConfidence: 95, disabledSites: [] });
  await contentPage.gotoListing();
  await contentPage.waitForScan();
  expect(await contentPage.badges.count()).toBe(0);
});

test('disabling a marketplace stops detection there', async ({ extensionContext, contentPage }) => {
  await setSyncStorage(extensionContext, { provider: 'heuristic', enabled: true, minConfidence: 50, disabledSites: ['myntra'] });
  await contentPage.gotoListing();
  await contentPage.page.waitForTimeout(1500);
  expect(await contentPage.page.locator('.product-base[data-rmf-scanned]').count()).toBe(0);
});

test('corrupt stored settings never break detection', async ({ extensionContext, contentPage }) => {
  await setSyncStorage(extensionContext, {
    provider: 'heuristic', enabled: true,
    minConfidence: 'not-a-number', disabledSites: 5, mode: 'bogus',
  });
  const errors = [];
  contentPage.page.on('pageerror', (e) => errors.push(String(e)));
  await contentPage.gotoListing();
  await contentPage.waitForBadges();
  expect(errors).toEqual([]);
});

test('threshold change applies live without reload', async ({ extensionContext, contentPage }) => {
  await setSyncStorage(extensionContext, { provider: 'heuristic', enabled: true, minConfidence: 50, disabledSites: [] });
  await contentPage.gotoListing();
  await contentPage.waitForBadges();

  await setSyncStorage(extensionContext, { minConfidence: 99 });
  await expect.poll(() => contentPage.badges.count(), { timeout: 10_000 }).toBe(0);
});
