// First-run onboarding funnel — the final step routes users to connect a free
// model, which is the fastest path from install to accurate detection.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { setLocalStorage } = require('./helpers/chrome-storage.cjs');

test.describe('Onboarding', () => {
  test('final step routes the user to Settings → Hugging Face', async ({ extensionContext, popupUrl }) => {
    // Re-arm onboarding (the auto storage reset marks it done).
    await setLocalStorage(extensionContext, { rmf_onboarding_done: false });

    const page = await extensionContext.newPage();
    await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });

    const overlay = page.locator('.onboarding');
    await expect(overlay).toBeVisible();

    const next = page.locator('#onboard-next');
    await next.click(); // step 1 → 2
    await next.click(); // step 2 → 3 (connect)
    await expect(next).toHaveText('Connect a free model');

    await next.click(); // finish + jump to HF settings

    await expect(overlay).toHaveCount(0);
    await expect(page.locator('#panel-settings')).toBeVisible();
    await expect(page.locator('#panel-huggingface')).toBeVisible();

    await page.close();
  });

  test('skip dismisses onboarding and does not reappear on reopen', async ({ extensionContext, popupUrl }) => {
    await setLocalStorage(extensionContext, { rmf_onboarding_done: false });

    const page = await extensionContext.newPage();
    await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.onboarding')).toBeVisible();
    await page.locator('.onboarding-skip').click();
    await expect(page.locator('.onboarding')).toHaveCount(0);

    // Reopen: onboarding stays dismissed.
    const page2 = await extensionContext.newPage();
    await page2.goto(popupUrl, { waitUntil: 'domcontentloaded' });
    await expect(page2.locator('#panel-scan')).toBeVisible();
    await expect(page2.locator('.onboarding')).toHaveCount(0);

    await page.close();
    await page2.close();
  });
});
