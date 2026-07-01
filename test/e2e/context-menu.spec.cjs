// Context-menu image check — handler invoked via RMF_RUN_IMAGE_CHECK (no native OS menu).
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');
const { runImageCheck } = require('./helpers/chrome-messaging.cjs');
const { getExtensionId, extensionUrl, inServiceWorker } = require('./helpers/chrome-api.cjs');
const { registerHfInferenceMock } = require('./helpers/mock-routes.cjs');

const TEST_PAGE = 'https://www.myntra.com/truekart-context-test';
const IMAGE_URL = 'https://assets.myntassets.com/ai0.png';

test('context image check injects a result badge on any page', async ({ extensionContext }) => {
  await registerHfInferenceMock(extensionContext);
  await setSyncStorage(extensionContext, {
    provider: 'huggingface',
    hfToken: 'hf_testtoken',
    hfVerified: true,
    minConfidence: 70,
  });

  const page = await extensionContext.newPage();
  await page.goto(TEST_PAGE, { waitUntil: 'domcontentloaded' });
  await page.setContent(`<html><body><img src="${IMAGE_URL}" width="300" height="300" alt="test"></body></html>`);

  const res = await runImageCheck(extensionContext, 'https://www.myntra.com/*', IMAGE_URL, TEST_PAGE);
  expect(res.ok, res.error || '').toBe(true);

  await expect.poll(() => page.locator('.rmf-ctx-badge').count(), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect(page.locator('.rmf-ctx-badge')).toContainText(/AI|Normal/i);
  await page.close();
});

test('context menu handler is registered in the service worker', async ({ extensionContext }) => {
  await inServiceWorker(extensionContext, async () => {
    if (typeof self.RMF_setupContextMenu === 'function') await self.RMF_setupContextMenu();
  });
  const ready = await inServiceWorker(extensionContext, () => typeof self.RMF_runImageCheck === 'function');
  expect(ready).toBe(true);
  const menus = await inServiceWorker(extensionContext, () => new Promise((resolve) => {
    if (!chrome.contextMenus?.getAll) return resolve(null);
    chrome.contextMenus.getAll(resolve);
  }));
  if (Array.isArray(menus)) {
    const item = menus.find((m) => m.id === 'rmf-check-image');
    expect(item?.title).toMatch(/Check this image/i);
  }
});
