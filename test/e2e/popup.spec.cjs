// Popup UI: bottom-nav, Scan status, engine connect flow (Settings tab).
const path = require('path');
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');

const shot = (name) => path.resolve(__dirname, '../../test-results', name);

test('bottom nav switches between Scan and Settings', async ({ extensionContext, popupUrl }) => {
  const page = await extensionContext.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#panel-scan')).toBeVisible();
  await expect(page.locator('#nav-scan')).toHaveAttribute('aria-selected', 'true');

  await page.locator('#nav-settings').click();
  await expect(page.locator('#panel-settings')).toBeVisible();
  await expect(page.locator('#panel-scan')).toBeHidden();
  await expect(page.locator('.bottom-nav .nav-btn')).toHaveCount(2);
  await page.close();
});

test('preview state shows warn status + HF onboarding stepper', async ({ extensionContext, popupUrl }) => {
  const page = await extensionContext.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'warn');
  await expect(page.locator('#status-chip')).toHaveText('Preview');

  await page.locator('#nav-settings').click();
  await page.locator('#tab-huggingface').click();
  await expect(page.locator('.stepper li')).toHaveCount(3);
  await page.screenshot({ path: shot('popup-preview.png') });
  await page.close();
});

test('connecting Hugging Face validates the token and flips status to connected', async ({ extensionContext, popupUrl }) => {
  const page = await extensionContext.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#nav-settings').click();
  await page.locator('#tab-huggingface').click();
  await page.locator('#hf-token').fill('hf_demotoken123');
  await page.locator('#hf-save').click();

  await expect(page.locator('#hf-feedback')).toContainText('testuser');
  await expect(page.locator('#status-chip')).toHaveText('Connected');
  await page.screenshot({ path: shot('popup-connected.png') });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#status-chip')).toHaveText('Connected');
  await page.close();
});

test('malformed token is rejected before any network call', async ({ extensionContext, popupUrl }) => {
  const page = await extensionContext.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#nav-settings').click();
  await page.locator('#tab-huggingface').click();
  await page.locator('#hf-token').fill('not-a-token');
  await page.locator('#hf-save').click();
  await expect(page.locator('.toast.err')).toBeVisible();
  await expect(page.locator('#hf-feedback')).toHaveClass(/err/);
  await page.close();
});

test('a token rejected by Hugging Face surfaces a clear error', async ({ extensionContext, popupUrl }) => {
  await setSyncStorage(extensionContext, { provider: 'heuristic', hfToken: '', hfVerified: false, hfUser: '' });
  const page = await extensionContext.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#nav-settings').click();
  await page.locator('#tab-huggingface').click();
  await page.locator('#hf-token').fill('hf_badtoken999');
  await page.locator('#hf-save').click();
  await expect(page.locator('#hf-feedback')).toHaveClass(/err/);
  await expect(page.locator('#hf-feedback')).toContainText('rejected');
  await page.close();
});

test('only Hugging Face and Preview engines are offered', async ({ extensionContext, popupUrl }) => {
  const page = await extensionContext.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#nav-settings').click();
  await expect(page.locator('#provider-seg .seg')).toHaveCount(2);
  await expect(page.locator('#tab-aiornot')).toHaveCount(0);
  await page.close();
});

test('engine tabs and mode radios expose correct ARIA roles', async ({ extensionContext, popupUrl }) => {
  const page = await extensionContext.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#nav-settings').click();
  await expect(page.locator('#provider-seg')).toHaveAttribute('role', 'tablist');
  await expect(page.locator('#mode-seg')).toHaveAttribute('role', 'radiogroup');
  await expect(page.locator('.bottom-nav')).toHaveAttribute('role', 'tablist');
  await page.close();
});
