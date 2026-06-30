// Badge confidence tiers: high (≥95%), medium (70–94%), below floor (no badge).
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');

function mockHfScore(extensionContext, aiScore) {
  return extensionContext.route('https://router.huggingface.co/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { label: 'artificial', score: aiScore },
        { label: 'human', score: 1 - aiScore },
      ]),
    }));
}

test('92% is labelled "Likely AI" (amber), not "AI Generated"', async ({ extensionContext, contentPage }) => {
  await mockHfScore(extensionContext, 0.92);
  await setSyncStorage(extensionContext, {
    provider: 'huggingface', hfToken: 'hf_testtoken', hfModel: 'Organika/sdxl-detector', minConfidence: 70, hfVerified: true,
  });

  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await contentPage.waitForBadges();

  const badge = contentPage.badges.first();
  await expect(badge).toHaveAttribute('data-conf', 'med');
  await expect(badge.locator('.rmf-label')).toContainText('Likely AI');
  await expect(badge.locator('.rmf-label')).not.toContainText('AI Generated');
  await expect(badge.locator('.rmf-score')).toHaveText('92%');
});

test('60% is below the 70% floor → no badge', async ({ extensionContext, contentPage }) => {
  await mockHfScore(extensionContext, 0.60);
  await setSyncStorage(extensionContext, {
    provider: 'huggingface', hfToken: 'hf_testtoken', hfModel: 'Organika/sdxl-detector', minConfidence: 70, hfVerified: true,
  });

  await contentPage.gotoListing();
  await contentPage.waitForScan();
  expect(await contentPage.badges.count()).toBe(0);
});
