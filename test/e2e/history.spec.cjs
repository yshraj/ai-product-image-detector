// test/e2e/history.spec.cjs
// Flagged items are logged to a local activity history and shown on the options
// page; clearing empties it.
const { test, expect } = require('@playwright/test');
const { launch, extensionId } = require('./_setup.cjs');

let context;
let optUrl;

test.beforeAll(async () => {
  context = await launch();
  const id = await extensionId(context);
  optUrl = `chrome-extension://${id}/options/options.html`;
});
test.afterAll(async () => { await context?.close(); });

test('flagged items appear in history and can be cleared', async () => {
  // Generate flags on a marketplace page.
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.locator('.rmf-badge').count(), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500); // let history writes flush

  // Open options → history should list the flagged items.
  const opt = await context.newPage();
  await opt.goto(optUrl, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => opt.locator('.hist-item').count(), {
    message: 'flagged items show in history', timeout: 10_000,
  }).toBeGreaterThan(0);

  // Each item shows a verdict + score.
  await expect(opt.locator('.hist-item .hist-verdict').first()).toContainText('%');

  // Clear empties it.
  await opt.locator('#clear-history').click();
  await expect(opt.locator('#history-empty')).toBeVisible();
  await expect(opt.locator('.hist-item')).toHaveCount(0);

  await opt.close();
  await page.close();
});
