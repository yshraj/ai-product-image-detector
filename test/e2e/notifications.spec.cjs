// Opt-in OS notifications (observed via rmf_lastNotify session record).
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { setSyncStorage, getSessionStorage } = require('./helpers/chrome-storage.cjs');

test('notifies once when enabled and a page has AI', async ({ extensionContext, contentPage }) => {
  await setSyncStorage(extensionContext, {
    provider: 'heuristic', enabled: true, notifyOnAI: true, minConfidence: 70, disabledSites: [],
  });
  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await contentPage.waitForBadges();

  await expect.poll(async () => {
    const r = await getSessionStorage(extensionContext, 'rmf_lastNotify');
    return r.rmf_lastNotify?.ai > 0;
  }, { timeout: 15_000 }).toBe(true);
});

test('does not notify when the toggle is off (default)', async ({ extensionContext, contentPage }) => {
  await setSyncStorage(extensionContext, {
    provider: 'heuristic', enabled: true, notifyOnAI: false, minConfidence: 70, disabledSites: [],
  });
  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await contentPage.waitForBadges();
  await contentPage.page.waitForTimeout(1500);

  const r = await getSessionStorage(extensionContext, 'rmf_lastNotify');
  expect(r.rmf_lastNotify).toBeFalsy();
});
