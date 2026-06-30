// Backward-compatible re-exports — prefer `./fixtures/extension.fixture.cjs` in new tests.
const { launchExtensionContext, closeExtensionContext } = require('./helpers/extension-launcher.cjs');
const { listingHtml } = require('./helpers/marketplace-fixture.cjs');
const { getExtensionId, waitForServiceWorker } = require('./helpers/chrome-api.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');
const { EXT_DIR, ASSET_DIR } = require('./helpers/constants.cjs');

/** @deprecated Use `launchExtensionContext` from helpers or the Playwright fixture. */
async function launch() {
  return launchExtensionContext();
}

module.exports = {
  EXT_DIR,
  ASSET_DIR,
  fixtureHtml: listingHtml,
  launch,
  launchExtensionContext,
  closeExtensionContext,
  serviceWorker: waitForServiceWorker,
  extensionId: getExtensionId,
  setSyncStorage,
};
