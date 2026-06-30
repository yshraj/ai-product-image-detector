// HF engine failure must not fall back to misleading preview badges.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { setSyncStorage, getSessionStorage } = require('./helpers/chrome-storage.cjs');

test('a failing remote engine shows no preview badge and surfaces the error', async ({ extensionContext, contentPage }) => {
  let hfCalls = 0;
  await extensionContext.route('https://router.huggingface.co/**', (route) => {
    hfCalls++;
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' });
  });
  await setSyncStorage(extensionContext, {
    provider: 'huggingface',
    hfToken: 'hf_testtoken',
    hfModel: 'Organika/sdxl-detector',
    hfVerified: true,
  });

  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await contentPage.waitForScan();

  expect(hfCalls).toBeGreaterThan(0);
  expect(await contentPage.badges.count()).toBe(0);
  expect(await contentPage.page.locator('.rmf-badge[data-preview="true"]').count()).toBe(0);

  const health = await getSessionStorage(extensionContext, 'engineHealth');
  expect(health.engineHealth?.status).toBe('error');
  expect(health.engineHealth?.provider).toBe('huggingface');
});
