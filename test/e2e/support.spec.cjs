// The "support the developer" footer is a hard requirement: always present in
// the popup layout, on every tab and every extension state.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { PopupPage } = require('./pages/PopupPage.cjs');

test.describe('Support footer', () => {
  test('is visible on load and on every tab', async ({ extensionContext, popupUrl }) => {
    const page = await extensionContext.newPage();
    const popup = new PopupPage(page);
    await popup.goto(popupUrl);

    const link = page.locator('#support-link');
    await expect(link).toBeVisible();
    await expect(link).toContainText(/coffee/i);

    await popup.selectTab('settings');
    await expect(popup.settingsPanel).toBeVisible();
    await expect(link).toBeVisible();

    await popup.selectTab('scan');
    await expect(popup.scanPanel).toBeVisible();
    await expect(link).toBeVisible();
    await page.close();
  });

  test('stays visible when scanning is disabled', async ({ extensionContext, popupUrl }) => {
    const page = await extensionContext.newPage();
    const popup = new PopupPage(page);
    await popup.goto(popupUrl);

    await popup.toggleEnabled.uncheck();
    await expect(page.locator('#support-link')).toBeVisible();
    await page.close();
  });

  test('opens a real https target in a new tab with a safe rel and a11y name', async ({
    extensionContext, popupUrl,
  }) => {
    const page = await extensionContext.newPage();
    const popup = new PopupPage(page);
    await popup.goto(popupUrl);

    const link = page.locator('#support-link');
    await expect(link).toHaveAttribute('href', /^https:\/\//);
    await expect(link).toHaveAttribute('target', '_blank');
    const rel = await link.getAttribute('rel');
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
    // Non-empty accessible name for screen readers.
    const label = await link.getAttribute('aria-label');
    expect(label && label.length).toBeTruthy();
    await page.close();
  });

  test('is present in the connected (HF) state too', async ({ extensionContext, popupUrl }) => {
    const page = await extensionContext.newPage();
    const popup = new PopupPage(page);
    await popup.goto(popupUrl);
    await popup.connectHuggingFace('hf_demotoken123');
    await expect(popup.statusChip).toHaveText('Connected');
    await popup.selectTab('scan');
    await expect(page.locator('#support-link')).toBeVisible();
    await page.close();
  });
});
