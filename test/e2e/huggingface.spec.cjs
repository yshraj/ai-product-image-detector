// Remote Hugging Face detection via the service worker (mocked endpoint).
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');
const { registerHfInferenceMock } = require('./helpers/mock-routes.cjs');

test('uses the Hugging Face model verdict when a token is set', async ({ extensionContext, contentPage }) => {
  const hf = await registerHfInferenceMock(extensionContext);
  await setSyncStorage(extensionContext, {
    provider: 'huggingface',
    hfToken: 'hf_testtoken',
    hfModel: 'Organika/sdxl-detector',
    hfVerified: true,
  });

  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await contentPage.waitForBadges();

  expect(hf.getCallCount()).toBeGreaterThan(0);

  const scoreTexts = await contentPage.page.$$eval('.rmf-score', (els) => els.map((e) => e.textContent));
  expect(scoreTexts).toContain('97%');

  const badge = contentPage.badges.first();
  await expect(badge).toHaveAttribute('data-conf', 'high');
  await expect(badge.locator('.rmf-label')).toContainText('AI Generated');

  await badge.click();
  await expect(contentPage.popover).toContainText('Hugging Face');
  await expect(contentPage.popover).toContainText('Organika/sdxl-detector');
  expect(await contentPage.page.locator('.rmf-badge[data-preview="true"]').count()).toBe(0);
});
