// test/e2e/details.spec.cjs
// Clicking a badge opens a "why flagged?" popover explaining the verdict; it
// closes via the Close button and Escape, and never one opens at a time.
const { test, expect } = require('@playwright/test');
const { launch } = require('./_setup.cjs');

let context;
test.beforeAll(async () => { context = await launch(); });
test.afterAll(async () => { await context?.close(); });

async function openFixture() {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.locator('.rmf-badge').count(), { timeout: 20_000 }).toBeGreaterThan(0);
  return page;
}

test('badge click reveals a transparent details popover (preview engine)', async () => {
  const page = await openFixture();

  await page.locator('.rmf-badge').first().click();
  const pop = page.locator('.rmf-pop');
  await expect(pop).toBeVisible();
  await expect(pop).toContainText('Why flagged?');
  await expect(pop).toContainText('confidence');
  await expect(pop).toContainText('preview'); // heuristic verdict is preview-grade
  await expect(page.locator('.rmf-badge[aria-expanded="true"]')).toHaveCount(1);

  // Reverse-image-search + marketplace-search handoffs (no backend).
  const lens = pop.locator('a[href^="https://lens.google.com/uploadbyurl"]');
  await expect(lens).toBeVisible();
  await expect(lens).toHaveAttribute('href', /assets\.myntassets\.com/); // image URL encoded in
  await expect(pop.locator('a[href*="bing.com/images/search"]')).toBeVisible();
  await expect(pop.locator('a[href*="amazon.in/s?k="]')).toBeVisible();
  // We're on Myntra, so a "Myntra" search link is not offered.
  await expect(pop.locator('a[href*="myntra.com/search"]')).toHaveCount(0);

  // Close button removes it.
  await page.locator('.rmf-pop-close').click();
  await expect(page.locator('.rmf-pop')).toHaveCount(0);
  await expect(page.locator('.rmf-badge[aria-expanded="true"]')).toHaveCount(0);
  await page.close();
});

test('only one popover is open at a time and Escape closes it', async () => {
  const page = await openFixture();
  const badges = page.locator('.rmf-badge');

  await badges.nth(0).click();
  await badges.nth(1).click(); // opening a second closes the first
  await expect(page.locator('.rmf-pop')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(page.locator('.rmf-pop')).toHaveCount(0);
  await page.close();
});
