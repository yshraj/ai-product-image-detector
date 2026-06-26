// test/e2e/popup.spec.cjs
// Renders the popup, screenshots it (preview + connected states), and asserts
// the SaaS UI behaves: provider switching, engine-status pill, HF onboarding.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { launch, extensionId } = require('./_setup.cjs');

let context;
let popupUrl;

test.beforeAll(async () => {
  context = await launch();
  const id = await extensionId(context);
  popupUrl = `chrome-extension://${id}/popup/popup.html`;
});
test.afterAll(async () => { await context?.close(); });

const shot = (name) => path.resolve(__dirname, '../../test-results', name);

test('popup renders preview state with warning + onboarding', async () => {
  const page = await context.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });

  // Default engine = preview → warn status.
  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'warn');
  await expect(page.locator('#status-chip')).toHaveText('Preview');

  // Hugging Face onboarding steps exist.
  await page.locator('#provider-seg .seg[data-provider="huggingface"]').click();
  await page.locator('#hf-onboard summary').click();
  await expect(page.locator('.steps li')).toHaveCount(5);
  await expect(page.locator('.steps a[href*="huggingface.co/settings/tokens"]')).toBeVisible();

  await page.screenshot({ path: shot('popup-preview.png') });
  console.log('\n[e2e] saved popup-preview.png');
  await page.close();
});

test('connecting Hugging Face flips engine status to accurate', async () => {
  const page = await context.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });

  await page.locator('#provider-seg .seg[data-provider="huggingface"]').click();
  await page.locator('#hf-token').fill('hf_demotoken123');
  await page.locator('#hf-save').click();

  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'good');
  await expect(page.locator('#status-chip')).toHaveText('Accurate');
  await expect(page.locator('#status-title')).toHaveText('Hugging Face');

  await page.screenshot({ path: shot('popup-connected.png') });
  console.log('[e2e] saved popup-connected.png');

  // Token persisted to storage.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#status-chip')).toHaveText('Accurate');
  await page.close();
});

test('invalid token is rejected', async () => {
  const page = await context.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#provider-seg .seg[data-provider="huggingface"]').click();
  await page.locator('#hf-token').fill('not-a-token');
  await page.locator('#hf-save').click();
  await expect(page.locator('.toast.err')).toBeVisible();
  await page.close();
});
