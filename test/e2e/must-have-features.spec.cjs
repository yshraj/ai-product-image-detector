// End-to-end coverage for the three "Must Have" additions:
//   1. Retry action on engine error (popup status card)
//   2. "Scan whole page" keyboard-shortcut command (manifest + handler)
//   3. "Copy link" action in the "Why flagged?" popover
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { MANIFEST } = require('./helpers/constants.cjs');
const { setSyncStorage, setSessionStorage } = require('./helpers/chrome-storage.cjs');

// ── Feature 3: Copy image link ──────────────────────────────────────────────
test.describe('Copy image link (Why flagged? popover)', () => {
  test('popover exposes a Copy link action that copies the image URL', async ({
    contentPage, extensionContext,
  }) => {
    await extensionContext.grantPermissions(['clipboard-read', 'clipboard-write']);
    await contentPage.setViewportAllVisible();
    await contentPage.gotoListing();
    await contentPage.waitForBadges();

    await contentPage.badges.first().click();
    await expect(contentPage.popover).toBeVisible();

    const copyBtn = contentPage.popover.locator('.rmf-pop-copy');
    await expect(copyBtn).toBeVisible();
    await expect(copyBtn).toHaveText('Copy link');

    await copyBtn.click();
    // Inline success feedback confirms the copy succeeded (async API or the
    // execCommand fallback) without a toast.
    await expect(copyBtn).toHaveText('Copied!');

    const clip = await contentPage.page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    expect(clip).toMatch(/^https?:\/\//);

    // Feedback reverts so the action can be repeated.
    await expect(copyBtn).toHaveText('Copy link', { timeout: 3000 });
  });
});

// ── Feature 2: Scan-whole-page keyboard shortcut ────────────────────────────
test.describe('Scan whole page shortcut', () => {
  test('manifest declares a scan-page command with a suggested key', () => {
    expect(MANIFEST.commands).toBeTruthy();
    const cmd = MANIFEST.commands['scan-page'];
    expect(cmd).toBeTruthy();
    expect(cmd.suggested_key.default).toBe('Alt+Shift+S');
    expect(cmd.description).toMatch(/scan/i);
    // The existing toggle shortcut must remain intact.
    expect(MANIFEST.commands['toggle-detection'].suggested_key.default).toBe('Alt+Shift+R');
  });

  test('command handler force-scans the active tab via SCAN_PAGE', async ({
    contentPage, serviceWorker,
  }) => {
    await contentPage.page.setViewportSize({ width: 360, height: 320 });
    await contentPage.gotoListing();
    await contentPage.waitForScan(1);
    await contentPage.page.bringToFront();

    // Chrome commands can't be dispatched from a page in Playwright, so invoke
    // the same handler the onCommand listener calls (scanActivePage), exercising
    // the real active-tab query + SCAN_PAGE message path.
    await serviceWorker.evaluate(() => self.scanActivePage && self.scanActivePage());

    // SCAN_PAGE walks the page and scans off-screen/lazy cards the viewport gate
    // skipped, so the scanned count climbs past the gated first batch.
    await expect.poll(() => contentPage.scannedCards.count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(8);
  });
});

// ── Feature 1: Retry on engine error ────────────────────────────────────────
test.describe('Retry on engine error', () => {
  async function makeErrorState(context) {
    await setSyncStorage(context, {
      provider: 'huggingface',
      hfToken: 'hf_testtoken0000000000000000',
      hfVerified: true,
      hfUser: 'tester',
    });
    await setSessionStorage(context, {
      engineHealth: { provider: 'huggingface', status: 'error', error: 'Model is warming up — retry in ~20s', at: Date.now() },
    });
  }

  test('Retry button appears only in the error state', async ({ extensionContext, popupUrl }) => {
    await makeErrorState(extensionContext);
    const page = await extensionContext.newPage();
    await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });

    const retry = page.locator('#status-retry');
    await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'error');
    await expect(retry).toBeVisible();
    await expect(retry).toHaveText('Retry');
    await expect(retry).toHaveAttribute('aria-label', /retry/i);
    await page.close();
  });

  test('Retry is hidden when the engine is healthy (default preview state)', async ({ popupPage }) => {
    // Default state after reset is preview mode → no error → no retry affordance.
    await expect(popupPage.statusCard).not.toHaveAttribute('data-state', 'error');
    await expect(popupPage.page.locator('#status-retry')).toBeHidden();
  });

  test('clicking Retry clears cached verdicts and rescans without crashing', async ({
    extensionContext, popupUrl,
  }) => {
    await makeErrorState(extensionContext);
    // Seed a cache entry so we can prove Retry clears it.
    await extensionContext.serviceWorkers()[0].evaluate(() =>
      chrome.storage.local.set({ rmf_cache_https_example_com_x: { isAI: false, confidence: 0 } }));

    const page = await extensionContext.newPage();
    await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });

    const retry = page.locator('#status-retry');
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(retry).toHaveText('Retrying…');

    // Cache is cleared as part of the retry.
    await expect.poll(async () => {
      const all = await extensionContext.serviceWorkers()[0].evaluate(() =>
        chrome.storage.local.get(null).then((o) => Object.keys(o).filter((k) => k.startsWith('rmf_cache_')).length));
      return all;
    }, { timeout: 15_000 }).toBe(0);

    // Button recovers to its idle label and the popup did not error out.
    await expect(retry).toHaveText('Retry', { timeout: 15_000 });
    await page.close();
  });
});
