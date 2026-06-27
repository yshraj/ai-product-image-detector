// test/e2e/options.spec.cjs
// Exercises the full Settings (options) page: sections render, preferences
// autosave + persist, data controls work, and legal text is present.
const { test, expect } = require('@playwright/test');
const { launch, extensionId, setSyncStorage } = require('./_setup.cjs');

let context;
let optUrl;

test.beforeAll(async () => {
  context = await launch();
  const id = await extensionId(context);
  optUrl = `chrome-extension://${id}/options/options.html`;
});
test.afterAll(async () => { await context?.close(); });

test('renders all settings sections + version', async () => {
  const page = await context.newPage();
  await page.goto(optUrl, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#version')).toHaveText('v1.3.0');
  await expect(page.getByRole('heading', { name: 'Detection engine' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Detection preferences' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Data & privacy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About & help' })).toBeVisible();
  await page.close();
});

test('confidence threshold autosaves and persists', async () => {
  await setSyncStorage(context, { minConfidence: 50 });
  const page = await context.newPage();
  await page.goto(optUrl, { waitUntil: 'domcontentloaded' });

  await page.$eval('#opt-confidence', (el) => {
    el.value = '80';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#confidence-val')).toHaveText('80%');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#opt-confidence')).toHaveValue('80');
  await expect(page.locator('#confidence-val')).toHaveText('80%');
  await page.close();
});

test('per-site toggle persists as disabledSites', async () => {
  await setSyncStorage(context, { disabledSites: [] });
  const page = await context.newPage();
  await page.goto(optUrl, { waitUntil: 'domcontentloaded' });

  const nykaa = page.locator('#site-checks input[data-site="nykaa"]');
  await expect(nykaa).toBeChecked();
  await nykaa.uncheck();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#site-checks input[data-site="nykaa"]')).not.toBeChecked();
  await page.close();
});

test('reset all settings restores defaults', async () => {
  await setSyncStorage(context, { minConfidence: 90, mode: 'hide' });
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(optUrl, { waitUntil: 'domcontentloaded' });

  await page.locator('#reset-all').click();
  await expect(page.locator('#opt-confidence')).toHaveValue('70');
  await expect(page.locator('#mode-seg .seg[data-mode="badge"]')).toHaveClass(/active/);
  await page.close();
});

test('privacy policy and terms are available in-app', async () => {
  const page = await context.newPage();
  await page.goto(optUrl, { waitUntil: 'domcontentloaded' });

  // Legal text lives in collapsible <details> — expand before asserting.
  await page.getByRole('group').filter({ hasText: 'Privacy Policy' }).locator('summary').click();
  await page.getByRole('group').filter({ hasText: 'Terms of Use' }).locator('summary').click();

  await expect(page.getByText('does not collect, store, or transmit')).toBeVisible();
  await expect(page.getByText('decision-support tool, not a guarantee')).toBeVisible();
  await expect(page.locator('#feedback-link')).toHaveAttribute('href', /github\.com\/.+\/issues/);
  await page.close();
});
