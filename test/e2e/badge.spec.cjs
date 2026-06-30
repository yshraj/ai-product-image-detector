// Toolbar action badge reflects AI count on the current tab.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { getActionBadge } = require('./helpers/chrome-api.cjs');
const { rescanTab, setContentEnabled } = require('./helpers/chrome-messaging.cjs');

async function badgeMatchesPage(contentPage, extensionContext) {
  const n = await contentPage.badges.count();
  const b = Number(await getActionBadge(extensionContext));
  return n > 0 && b === n;
}

test('badge equals the number of AI-flagged images on the page', async ({ contentPage, extensionContext }) => {
  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await expect.poll(() => badgeMatchesPage(contentPage, extensionContext), { timeout: 20_000 }).toBe(true);
});

test('RESCAN re-detects the page and keeps the badge consistent', async ({ contentPage, extensionContext }) => {
  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await expect.poll(() => badgeMatchesPage(contentPage, extensionContext), { timeout: 20_000 }).toBe(true);

  await rescanTab(extensionContext);
  await expect.poll(() => badgeMatchesPage(contentPage, extensionContext), { timeout: 15_000 }).toBe(true);
});

test('disabling detection clears the badge', async ({ contentPage, extensionContext }) => {
  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await contentPage.waitForBadges();

  await setContentEnabled(extensionContext, false);
  await expect.poll(() => getActionBadge(extensionContext), { timeout: 10_000 }).toBe('');
});
