// Extension installation, manifest, and service worker registration.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { MANIFEST } = require('./helpers/constants.cjs');
const { getManifestVersion } = require('./helpers/chrome-api.cjs');
const { getSyncStorage } = require('./helpers/chrome-storage.cjs');

test.describe('Extension installation & loading', () => {
  test('service worker registers with a valid extension ID', async ({ extensionContext, extensionId, serviceWorker }) => {
    expect(extensionId).toMatch(/^[a-p]{32}$/);
    expect(serviceWorker.url()).toContain(`chrome-extension://${extensionId}/`);
    expect(serviceWorker.url()).toContain('background/service-worker.js');
    await expect(extensionContext.serviceWorkers()).toHaveLength(1);
  });

  test('manifest version matches package and is readable from the worker', async ({ extensionContext }) => {
    const version = await getManifestVersion(extensionContext);
    expect(version).toBe(MANIFEST.version);
  });

  test('declared permissions are granted to the extension', async ({ extensionContext }) => {
    const { inServiceWorker } = require('./helpers/chrome-api.cjs');
    const granted = await inServiceWorker(extensionContext, () => new Promise((resolve) => {
      chrome.permissions.getAll(resolve);
    }));
    for (const perm of MANIFEST.permissions) {
      expect(granted.permissions, `missing permission: ${perm}`).toContain(perm);
    }
    for (const host of MANIFEST.host_permissions.slice(0, 4)) {
      expect(granted.origins.some((o) => o.includes(host.replace('/*', ''))), `missing host: ${host}`).toBe(true);
    }
  });

  test('sync storage has install defaults after reset', async ({ extensionContext }) => {
    const stored = await getSyncStorage(extensionContext, ['enabled', 'mode', 'provider', 'minConfidence']);
    expect(stored.enabled).toBe(true);
    expect(stored.mode).toBe('badge');
    expect(stored.provider).toBe('heuristic');
    expect(stored.minConfidence).toBe(70);
  });

  test('popup and options pages load without errors', async ({ popupUrl, optionsUrl, extensionContext }) => {
    const popup = await extensionContext.newPage();
    const errors = [];
    popup.on('pageerror', (e) => errors.push(String(e)));
    await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
    await expect(popup.locator('#panel-scan')).toBeVisible();
    await expect(popup.locator('.bottom-nav')).toBeVisible();
    expect(errors).toEqual([]);

    const options = await extensionContext.newPage();
    options.on('pageerror', (e) => errors.push(String(e)));
    await options.goto(optionsUrl, { waitUntil: 'domcontentloaded' });
    await expect(options.getByRole('heading', { name: 'Detection preferences' })).toBeVisible();
    expect(errors).toEqual([]);

    await popup.close();
    await options.close();
  });
});
