// Extension fixture for live marketplace tests — no network mocks.
const { test: base, expect } = require('@playwright/test');
const { launchExtensionContext, closeExtensionContext } = require('../helpers/extension-launcher.cjs');
const { getExtensionId, extensionUrl, waitForServiceWorker } = require('../helpers/chrome-api.cjs');
const { resetExtensionStorage } = require('../helpers/chrome-storage.cjs');

const test = base.extend({
  extensionContext: [async ({}, use) => {
    const context = await launchExtensionContext({ skipRoutes: true });
    await use(context);
    await closeExtensionContext(context);
  }, { scope: 'worker' }],

  _storageReset: [async ({ extensionContext }, use) => {
    await resetExtensionStorage(extensionContext);
    await use();
  }, { auto: true }],

  extensionId: async ({ extensionContext }, use) => {
    await use(await getExtensionId(extensionContext));
  },

  serviceWorker: async ({ extensionContext }, use) => {
    await use(await waitForServiceWorker(extensionContext));
  },

  popupUrl: async ({ extensionId }, use) => {
    await use(extensionUrl(extensionId, 'popup/popup.html'));
  },
});

module.exports = { test, expect };
