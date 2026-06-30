// Keyboard shortcut (Alt+Shift+R) toggles detection via the service worker command handler.
// Playwright cannot fire chrome.commands directly; we exercise the same code path via RMF_TOGGLE_ENABLED.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { toggleDetection } = require('./helpers/chrome-messaging.cjs');
const { getSyncStorage } = require('./helpers/chrome-storage.cjs');
const { getActionBadge } = require('./helpers/chrome-api.cjs');
const { MANIFEST } = require('./helpers/constants.cjs');

test.describe('Keyboard shortcut & browser action', () => {
  test('manifest declares the toggle-detection command', () => {
    expect(MANIFEST.commands).toHaveProperty('toggle-detection');
    expect(MANIFEST.commands['toggle-detection'].suggested_key.default).toBe('Alt+Shift+R');
  });

  test('toggle command disables scanning and clears the toolbar badge', async ({ extensionContext, contentPage }) => {
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForBadges();

    const off = await toggleDetection(extensionContext);
    expect(off.ok).toBe(true);
    expect(off.enabled).toBe(false);

    const stored = await getSyncStorage(extensionContext, ['enabled']);
    expect(stored.enabled).toBe(false);

    await expect.poll(() => getActionBadge(extensionContext), { timeout: 10_000 }).toBe('');

    const on = await toggleDetection(extensionContext);
    expect(on.enabled).toBe(true);
  });

  test('popup master toggle stays in sync with storage', async ({ popupPage, extensionContext }) => {
    await popupPage.toggleEnabled.uncheck();
    const stored = await getSyncStorage(extensionContext, ['enabled']);
    expect(stored.enabled).toBe(false);

    await popupPage.toggleEnabled.check();
    const again = await getSyncStorage(extensionContext, ['enabled']);
    expect(again.enabled).toBe(true);
  });
});
