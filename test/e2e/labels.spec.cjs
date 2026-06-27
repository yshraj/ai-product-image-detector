// test/e2e/labels.spec.cjs
// Locks in the badge tiers driven by confidence:
//   >= 90  → "AI Generated" (data-conf="high")
//   70..89 → "Likely AI"    (data-conf="med")
//   < 70   → no badge
// Uses a mocked Hugging Face verdict so the score is deterministic.
const { test, expect } = require('@playwright/test');
const { launch, setSyncStorage } = require('./_setup.cjs');

function hfContext(aiScore) {
  return async () => {
    const context = await launch();
    await context.route('https://router.huggingface.co/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { label: 'artificial', score: aiScore },
          { label: 'human', score: 1 - aiScore },
        ]),
      }));
    await setSyncStorage(context, {
      provider: 'huggingface', hfToken: 'hf_testtoken', hfModel: 'Organika/sdxl-detector', minConfidence: 70,
    });
    return context;
  };
}

test.describe('mid-confidence verdict (just below the 95% bar)', () => {
  let context;
  test.beforeAll(async () => { context = await hfContext(0.92)(); });
  test.afterAll(async () => { await context?.close(); });

  test('92% is labelled "Likely AI" (amber), not "AI Generated"', async () => {
    const page = await context.newPage();
    await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.locator('.rmf-badge').count(), { timeout: 20_000 }).toBeGreaterThan(0);

    const badge = page.locator('.rmf-badge').first();
    await expect(badge).toHaveAttribute('data-conf', 'med');
    await expect(badge.locator('.rmf-label')).toContainText('Likely AI');
    await expect(badge.locator('.rmf-label')).not.toContainText('AI Generated');
    await expect(badge.locator('.rmf-score')).toHaveText('92%');
    await page.close();
  });
});

test.describe('below-floor verdict', () => {
  let context;
  test.beforeAll(async () => { context = await hfContext(0.60)(); }); // 60% < 70 floor
  test.afterAll(async () => { await context?.close(); });

  test('60% is below the 70% floor → no badge', async () => {
    const page = await context.newPage();
    await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });
    // Cards get scanned, but nothing is flagged below the floor.
    await expect.poll(() => page.locator('.product-base[data-rmf-scanned="true"]').count(),
      { timeout: 20_000 }).toBeGreaterThan(0);
    expect(await page.locator('.rmf-badge').count()).toBe(0);
    await page.close();
  });
});
