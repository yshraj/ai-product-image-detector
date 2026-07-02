// "Scan whole page" — the viewport gate keeps normal scans to what's visible,
// so this user-initiated action must reach off-screen and lazy-loaded products.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { getContentStats, scanWholePage } = require('./helpers/chrome-messaging.cjs');

const MYNTRA = 'https://www.myntra.com/*';

test.describe('Scan whole page', () => {
  test('scans off-screen products the viewport gate skipped', async ({ contentPage, extensionContext }) => {
    // A short viewport leaves most of the 8-card first batch off-screen and the
    // second (lazy) batch entirely unloaded.
    await contentPage.page.setViewportSize({ width: 360, height: 320 });
    await contentPage.gotoListing();
    await contentPage.waitForScan(1);

    const before = await getContentStats(extensionContext);
    expect(before.scanned).toBeGreaterThan(0);
    // Sanity: the viewport gate genuinely left the first batch incomplete.
    expect(before.scanned).toBeLessThan(8);

    await scanWholePage(extensionContext);

    // Every up-front card (and then some, as scrolling loads the lazy batch)
    // ends up scanned, and the count strictly grows past the gated baseline.
    await expect.poll(async () => {
      const s = await getContentStats(extensionContext);
      return s ? s.scanned : 0;
    }, { timeout: 20_000 }).toBeGreaterThanOrEqual(8);

    const after = await getContentStats(extensionContext);
    expect(after.scanned).toBeGreaterThan(before.scanned);

    // The page is scrolled back to where the user left it (top).
    const scrollY = await contentPage.page.evaluate(() => window.scrollY);
    expect(scrollY).toBeLessThan(50);
  });

  test('popup exposes a Scan whole page control that clears once complete', async ({
    contentPage, extensionContext, popupUrl,
  }) => {
    await contentPage.page.setViewportSize({ width: 360, height: 320 });
    await contentPage.gotoListing();
    await contentPage.waitForScan(1);
    // Make the listing tab the active/last-accessed marketplace tab.
    await contentPage.page.bringToFront();

    const popupPage = await extensionContext.newPage();
    await popupPage.goto(popupUrl, { waitUntil: 'domcontentloaded' });

    const scanBtn = popupPage.locator('#scan-page');
    await expect(scanBtn).toBeVisible({ timeout: 12_000 });
    await expect(scanBtn).toContainText(/whole page/i);

    await scanBtn.click();
    // Once everything is scanned there is nothing "more" to scan → control hides.
    await expect(scanBtn).toBeHidden({ timeout: 20_000 });

    const stats = await getContentStats(extensionContext);
    expect(stats.scanned).toBeGreaterThanOrEqual(8);

    await popupPage.close();
  });
});
