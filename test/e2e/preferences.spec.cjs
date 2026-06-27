// test/e2e/preferences.spec.cjs
// Verifies the detection preferences actually change in-page behaviour:
//   - minimum-confidence threshold suppresses low-confidence flags
//   - disabling a marketplace stops detection there entirely
const { test, expect } = require('@playwright/test');
const { launch, setSyncStorage } = require('./_setup.cjs');

let context;
test.beforeAll(async () => { context = await launch(); });
test.afterAll(async () => { await context?.close(); });

test('minimum-confidence threshold suppresses lower-confidence flags', async () => {
  // Heuristic flags the AI fixtures at ~92%. A 95% threshold should suppress them.
  await setSyncStorage(context, { provider: 'heuristic', enabled: true, minConfidence: 95, disabledSites: [] });
  const page = await context.newPage();
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });

  await expect.poll(() => page.locator('.product-base[data-rmf-scanned="true"]').count(),
    { message: 'cards are still scanned', timeout: 20_000 }).toBeGreaterThan(0);

  expect(await page.locator('.rmf-badge').count(),
    'no badges when confidence is below the threshold').toBe(0);
  await page.close();
});

test('disabling a marketplace stops detection there', async () => {
  await setSyncStorage(context, { provider: 'heuristic', enabled: true, minConfidence: 50, disabledSites: ['myntra'] });
  const page = await context.newPage();
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });

  // Give the content script time to (not) run.
  await page.waitForTimeout(1500);
  expect(await page.locator('.product-base[data-rmf-scanned]').count(),
    'a disabled site is never scanned').toBe(0);
  expect(await page.locator('.rmf-badge').count(), 'no badges on a disabled site').toBe(0);
  await page.close();
});

test('corrupt / malformed stored settings never break detection', async () => {
  // Simulates a bad imported settings file or a corrupted sync value. The
  // content script must coerce these safely and keep working — not throw.
  await setSyncStorage(context, {
    provider: 'heuristic', enabled: true,
    minConfidence: 'not-a-number', disabledSites: 5, mode: 'bogus',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });

  await expect.poll(() => page.locator('.rmf-badge').count(),
    { message: 'detection still runs despite bad settings', timeout: 20_000 }).toBeGreaterThan(0);
  expect(errors, 'no uncaught errors from malformed settings').toEqual([]);
  await page.close();
});

test('threshold change applies live without reload', async () => {
  await setSyncStorage(context, { provider: 'heuristic', enabled: true, minConfidence: 50, disabledSites: [] });
  const page = await context.newPage();
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });

  await expect.poll(() => page.locator('.rmf-badge').count(),
    { message: 'badges appear at the default threshold', timeout: 20_000 }).toBeGreaterThan(0);

  // Raise the threshold from the options/popup surface (storage write) → badges clear.
  await setSyncStorage(context, { minConfidence: 99 });
  await expect.poll(() => page.locator('.rmf-badge').count(),
    { message: 'badges clear live when the threshold is raised', timeout: 10_000 }).toBe(0);
  await page.close();
});
