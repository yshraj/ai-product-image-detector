// Playwright fixtures — one isolated extension context per test.
const { test: base, expect } = require('@playwright/test');
const { launchExtensionContext, closeExtensionContext } = require('../helpers/extension-launcher.cjs');
const { getExtensionId, extensionUrl, waitForServiceWorker } = require('../helpers/chrome-api.cjs');
const { resetExtensionStorage } = require('../helpers/chrome-storage.cjs');
const { PopupPage } = require('../pages/PopupPage.cjs');
const { OptionsPage } = require('../pages/OptionsPage.cjs');
const { ContentPage } = require('../pages/ContentPage.cjs');

const test = base.extend({
  /** One extension-loaded browser per worker (amortises launch cost). */
  extensionContext: [async ({}, use) => {
    const context = await launchExtensionContext();
    await use(context);
    await closeExtensionContext(context);
  }, { scope: 'worker' }],

  /** Auto-reset storage before each test for deterministic state. */
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

  optionsUrl: async ({ extensionId }, use) => {
    await use(extensionUrl(extensionId, 'options/options.html'));
  },

  popupPage: async ({ extensionContext, popupUrl }, use) => {
    const page = await extensionContext.newPage();
    const popup = new PopupPage(page);
    await popup.goto(popupUrl);
    await use(popup);
    await page.close();
  },

  optionsPage: async ({ extensionContext, optionsUrl }, use) => {
    const page = await extensionContext.newPage();
    const options = new OptionsPage(page);
    await options.goto(optionsUrl);
    await use(options);
    await page.close();
  },

  contentPage: async ({ extensionContext }, use) => {
    const page = await extensionContext.newPage();
    await use(new ContentPage(page));
    await page.close();
  },
});

module.exports = { test, expect };
