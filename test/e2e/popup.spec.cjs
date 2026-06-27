// test/e2e/popup.spec.cjs
// Renders the popup, screenshots it (preview + connected states), and asserts
// the SaaS UI behaves: provider switching, engine-status pill, HF onboarding
// stepper, live token validation (success + failure), and accessibility wiring.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { launch, extensionId, setSyncStorage } = require('./_setup.cjs');

let context;
let popupUrl;

test.beforeAll(async () => {
  context = await launch();
  const id = await extensionId(context);
  popupUrl = `chrome-extension://${id}/popup/popup.html`;
});
test.afterAll(async () => { await context?.close(); });

const shot = (name) => path.resolve(__dirname, '../../test-results', name);

test('popup renders preview state with warning + onboarding stepper', async () => {
  const page = await context.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });

  // Default engine = preview → warn status.
  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'warn');
  await expect(page.locator('#status-chip')).toHaveText('Preview');

  // The persisted (default) provider tab is selected + focusable on load.
  await expect(page.locator('#tab-heuristic')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#tab-heuristic')).toHaveAttribute('tabindex', '0');

  // Hugging Face onboarding stepper is visible (no accordion to expand).
  await page.locator('#provider-seg .seg[data-provider="huggingface"]').click();
  await expect(page.locator('.stepper li')).toHaveCount(3);
  await expect(page.locator('.stepper a[href*="huggingface.co/settings/tokens"]')).toBeVisible();

  await page.waitForTimeout(250); // let the panel entrance animation settle
  await page.screenshot({ path: shot('popup-preview.png') });
  console.log('\n[e2e] saved popup-preview.png');
  await page.close();
});

test('connecting Hugging Face validates the token and flips status to connected', async () => {
  const page = await context.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });

  await page.locator('#provider-seg .seg[data-provider="huggingface"]').click();
  await page.locator('#hf-token').fill('hf_demotoken123');
  await page.locator('#hf-save').click();

  // Inline success feedback names the verified user (from mocked whoami).
  await expect(page.locator('#hf-feedback')).toBeVisible();
  await expect(page.locator('#hf-feedback')).toContainText('testuser');

  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'good');
  await expect(page.locator('#status-chip')).toHaveText('Connected');
  await expect(page.locator('#status-title')).toHaveText('Hugging Face');

  await page.waitForTimeout(250);
  await page.screenshot({ path: shot('popup-connected.png') });
  console.log('[e2e] saved popup-connected.png');

  // State persisted to storage (verified survives reload).
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#status-chip')).toHaveText('Connected');
  await page.close();
});

test('malformed token is rejected before any network call', async () => {
  const page = await context.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#provider-seg .seg[data-provider="huggingface"]').click();
  await page.locator('#hf-token').fill('not-a-token');
  await page.locator('#hf-save').click();
  await expect(page.locator('.toast.err')).toBeVisible();
  await expect(page.locator('#hf-feedback')).toHaveClass(/err/);
  await expect(page.locator('#hf-token')).toHaveAttribute('aria-invalid', 'true');
  await page.close();
});

test('a token rejected by Hugging Face surfaces a clear error', async () => {
  // Reset to a clean preview state so a prior test's verified token can't leak in.
  await setSyncStorage(context, {
    provider: 'heuristic', hfToken: '', hfVerified: false, hfUser: '',
  });
  const page = await context.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#provider-seg .seg[data-provider="huggingface"]').click();
  // The shared whoami mock rejects any token containing "bad".
  await page.locator('#hf-token').fill('hf_badtoken999');
  await page.locator('#hf-save').click();

  await expect(page.locator('#hf-feedback')).toHaveClass(/err/);
  await expect(page.locator('#hf-feedback')).toContainText('rejected');
  // Status must NOT claim a working connection.
  await expect(page.locator('#status-chip')).not.toHaveText('Connected');
  await page.close();
});

test('only Hugging Face and Preview engines are offered (AI or Not removed)', async () => {
  const page = await context.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#provider-seg .seg')).toHaveCount(2);
  await expect(page.locator('#tab-huggingface')).toBeVisible();
  await expect(page.locator('#tab-heuristic')).toBeVisible();
  await expect(page.locator('#tab-aiornot')).toHaveCount(0);
  await expect(page.locator('#panel-aiornot')).toHaveCount(0);
  await expect(page.getByText('AI or Not')).toHaveCount(0);
  await page.close();
});

test('provider tabs and mode radios expose correct ARIA roles', async () => {
  const page = await context.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#provider-seg')).toHaveAttribute('role', 'tablist');
  await expect(page.locator('#mode-seg')).toHaveAttribute('role', 'radiogroup');

  // Selecting a tab sets aria-selected and reveals its panel.
  await page.locator('#tab-huggingface').click();
  await expect(page.locator('#tab-huggingface')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-huggingface')).toBeVisible();
  await page.close();
});
