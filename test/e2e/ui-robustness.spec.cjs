// UI robustness E2E — the input/interaction edge cases the rest of the suite
// doesn't cover: dark-mode rendering, rapid clicking, and long/invalid input.
// These are behavioural guards (no feature changes): the popup must stay
// usable and error-free under color-scheme changes, mashed buttons, and junk
// input, and settings validation must reject bad tokens gracefully.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { PopupPage } = require('./pages/PopupPage.cjs');

// Real JS errors only — ignore resource 404s (fixture images etc.).
function attachErrorCollector(page, sink) {
  page.on('pageerror', (err) => sink.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Failed to load resource|net::ERR|favicon/i.test(text)) return;
    sink.push(`console.error: ${text}`);
  });
}

// Parse "rgb(r, g, b)" → perceived luminance 0..255.
function luminance(rgb) {
  const m = String(rgb).match(/\d+/g);
  if (!m) return 255;
  const [r, g, b] = m.map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

test.describe('UI robustness', () => {
  // ---- Dark mode: the popup honours prefers-color-scheme without breaking. --
  test('popup renders a dark surface under prefers-color-scheme: dark', async ({
    extensionContext, popupUrl,
  }) => {
    const page = await extensionContext.newPage();
    const errors = [];
    attachErrorCollector(page, errors);

    await page.emulateMedia({ colorScheme: 'light' });
    const popup = new PopupPage(page);
    await popup.goto(popupUrl);
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.emulateMedia({ colorScheme: 'dark' });
    // Re-read after the media switch; :root/body tokens re-resolve live.
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    // Dark theme must actually darken the surface, and all three tabs must
    // remain switchable and visible in the dark palette.
    expect(luminance(darkBg), `dark bg ${darkBg} should be darker than light bg ${lightBg}`)
      .toBeLessThan(luminance(lightBg));
    for (const tab of ['settings', 'scan']) {
      await popup.selectTab(tab);
      await expect(page.locator(`#panel-${tab}`)).toBeVisible();
    }
    expect(errors, errors.join('\n')).toEqual([]);
    await page.close();
  });

  // ---- Rapid clicking: mashing the tab bar must not desync the UI. ---------
  test('rapid tab switching stays consistent and error-free', async ({
    extensionContext, popupUrl,
  }) => {
    const page = await extensionContext.newPage();
    const errors = [];
    attachErrorCollector(page, errors);
    const popup = new PopupPage(page);
    await popup.goto(popupUrl);

    const tabs = ['settings', 'scan'];
    for (let i = 0; i < 30; i++) {
      // Fire clicks without awaiting visibility between them — worst case.
      await popup.nav(tabs[i % tabs.length]).click({ noWaitAfter: true });
    }
    // After the storm, the last selected tab must be the single active panel.
    await popup.selectTab('scan');
    await expect(popup.scanPanel).toBeVisible();
    await expect(popup.settingsPanel).toBeHidden();
    expect(errors, errors.join('\n')).toEqual([]);
    await page.close();
  });

  // ---- Rapid save clicks: double/triple-tapping Save must not crash. -------
  test('mashing the HF save button is handled gracefully', async ({
    extensionContext, popupUrl,
  }) => {
    const page = await extensionContext.newPage();
    const errors = [];
    attachErrorCollector(page, errors);
    const popup = new PopupPage(page);
    await popup.goto(popupUrl);

    await popup.openSettings();
    await page.locator('#tab-huggingface').click();
    await page.locator('#hf-token').fill('hf_definitelyNotARealTokenValue123456');
    const save = page.locator('#hf-save');
    // Triple-click in quick succession — no unhandled rejection, feedback shows.
    await Promise.all([save.click(), save.click(), save.click()]);
    await expect(page.locator('#hf-feedback')).toBeVisible({ timeout: 12_000 });
    expect(errors, errors.join('\n')).toEqual([]);
    await page.close();
  });

  // ---- Invalid token: validation rejects non-hf_ input with a clear error. -
  test('an invalid HF token is rejected with guidance, not a crash', async ({
    extensionContext, popupUrl,
  }) => {
    const page = await extensionContext.newPage();
    const errors = [];
    attachErrorCollector(page, errors);
    const popup = new PopupPage(page);
    await popup.goto(popupUrl);

    await popup.openSettings();
    await page.locator('#tab-huggingface').click();
    await page.locator('#hf-token').fill('not-a-real-token');
    await page.locator('#hf-save').click();

    // The regex guard (`/^hf_.../`) must surface a friendly message.
    await expect(page.locator('#hf-feedback')).toContainText(/hf_/i, { timeout: 12_000 });
    expect(errors, errors.join('\n')).toEqual([]);
    await page.close();
  });

  // ---- Very long input: pasting a huge string must not hang or throw. ------
  test('a very long token value is accepted by the field without breaking', async ({
    extensionContext, popupUrl,
  }) => {
    const page = await extensionContext.newPage();
    const errors = [];
    attachErrorCollector(page, errors);
    const popup = new PopupPage(page);
    await popup.goto(popupUrl);

    await popup.openSettings();
    const longValue = 'hf_' + 'x'.repeat(5000);
    const token = page.locator('#hf-token');
    await page.locator('#tab-huggingface').click();
    await token.fill(longValue);
    // The field must hold the value and the page must stay responsive.
    expect((await token.inputValue()).length).toBe(longValue.length);
    await page.locator('#hf-save').click();
    await expect(page.locator('#hf-feedback')).toBeVisible({ timeout: 12_000 });
    // Tab bar still works after the large-input round-trip.
    await popup.selectTab('scan');
    await expect(popup.scanPanel).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
    await page.close();
  });
});
