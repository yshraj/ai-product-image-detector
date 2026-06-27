// test/e2e/huggingface-error.spec.cjs
// Regression test for the cache-poisoning bug: when a remote engine IS configured
// but the call fails (cold start, rate limit, 5xx), the extension must NOT fall
// back to a misleading on-device "preview" badge, and must NOT cache a wrong
// verdict. Instead it shows no badge and records the error for the popup.
const { test, expect } = require('@playwright/test');
const { launch, setSyncStorage, serviceWorker } = require('./_setup.cjs');

let context;
let hfCalls = 0;

test.beforeAll(async () => {
  context = await launch();

  // Hugging Face configured, but the inference endpoint keeps failing (500).
  await context.route('https://router.huggingface.co/**', (route) => {
    hfCalls++;
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' });
  });

  await setSyncStorage(context, {
    provider: 'huggingface', hfToken: 'hf_testtoken', hfModel: 'Organika/sdxl-detector',
  });
});

test.afterAll(async () => { await context?.close(); });

test('a failing remote engine shows no preview badge and surfaces the error', async () => {
  const page = await context.newPage();
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });

  // Cards get scanned (so we know detection ran), but the engine erroring out
  // must NOT produce any badge — especially not a misleading preview one.
  await expect.poll(() => page.locator('.product-base[data-rmf-scanned="true"]').count(),
    { message: 'cards should be scanned', timeout: 20_000 }).toBeGreaterThan(0);

  expect(hfCalls, 'HF endpoint should have been attempted').toBeGreaterThan(0);
  expect(await page.locator('.rmf-badge').count(),
    'no badge should appear when the configured engine fails').toBe(0);
  expect(await page.locator('.rmf-badge[data-preview="true"]').count(),
    'must never silently fall back to a preview badge').toBe(0);

  // The error is recorded on the engine-health channel for the popup to show.
  const sw = await serviceWorker(context);
  const health = await sw.evaluate(() =>
    chrome.storage.session.get('engineHealth').then((r) => r.engineHealth || null));
  expect(health?.status).toBe('error');
  expect(health?.provider).toBe('huggingface');
  console.log(`\n[e2e] engine health after failure: ${JSON.stringify(health)}`);

  await page.close();
});
