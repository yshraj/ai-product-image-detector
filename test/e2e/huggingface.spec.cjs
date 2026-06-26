// test/e2e/huggingface.spec.cjs
// Verifies that when a Hugging Face token is configured, the extension uses the
// REMOTE model (via the service worker) instead of the on-device heuristic.
// The HF endpoint is mocked so the test is offline and deterministic.
const { test, expect } = require('@playwright/test');
const { launch, setSyncStorage } = require('./_setup.cjs');

let context;
let hfCalls = 0;

test.beforeAll(async () => {
  context = await launch();

  // Mock the HF Inference API. Returns a fixed verdict (97% artificial) so we
  // can prove the score came from HF, not the heuristic (which yields 92%).
  await context.route('https://api-inference.huggingface.co/**', (route) => {
    hfCalls++;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { label: 'artificial', score: 0.97 },
        { label: 'human', score: 0.03 },
      ]),
    });
  });

  // Configure the extension to use Hugging Face.
  await setSyncStorage(context, {
    provider: 'huggingface',
    hfToken: 'hf_testtoken',
    hfModel: 'Organika/sdxl-detector',
  });
});

test.afterAll(async () => { await context?.close(); });

test('uses the Hugging Face model verdict when a token is set', async () => {
  const page = await context.newPage();
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });

  await expect.poll(() => page.locator('.rmf-badge').count(),
    { message: 'badges should appear from the HF verdict', timeout: 25_000 }).toBeGreaterThan(0);

  // The HF endpoint must actually have been hit.
  expect(hfCalls, 'HF inference endpoint should be called').toBeGreaterThan(0);

  // Score must reflect HF (97%), not the heuristic (92%).
  const scoreTexts = await page.$$eval('.rmf-score', (els) => els.map((e) => e.textContent));
  console.log(`\n[e2e] HF badge scores: ${[...new Set(scoreTexts)].join(', ')}`);
  expect(scoreTexts).toContain('97%');

  // HF results are authoritative, not preview.
  expect(await page.locator('.rmf-badge[data-preview="true"]').count(),
    'HF badges must not be tagged preview').toBe(0);

  await page.close();
});
