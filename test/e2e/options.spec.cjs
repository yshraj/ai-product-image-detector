// Full Settings (options) page: autosave, persistence, legal text.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');
const { MANIFEST } = require('./helpers/constants.cjs');

test('renders all settings sections + version', async ({ optionsPage }) => {
  await expect(optionsPage.version).toHaveText(`v${MANIFEST.version}`);
  await expect(optionsPage.page.getByRole('heading', { name: 'Detection engine' })).toBeVisible();
  await expect(optionsPage.page.getByRole('heading', { name: 'Detection preferences' })).toBeVisible();
  await expect(optionsPage.page.getByRole('heading', { name: 'Data & privacy' })).toBeVisible();
});

test('confidence threshold autosaves and persists', async ({ extensionContext, optionsUrl }) => {
  await setSyncStorage(extensionContext, { minConfidence: 50 });
  const page = await extensionContext.newPage();
  await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' });

  await page.$eval('#opt-confidence', (el) => {
    el.value = '80';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#confidence-val')).toHaveText('80%');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#opt-confidence')).toHaveValue('80');
  await page.close();
});

test('per-site toggle persists as disabledSites', async ({ extensionContext, optionsUrl }) => {
  await setSyncStorage(extensionContext, { disabledSites: [] });
  const page = await extensionContext.newPage();
  await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' });

  const nykaa = page.locator('#site-checks input[data-site="nykaa"]');
  await expect(nykaa).toBeChecked();
  await nykaa.uncheck();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#site-checks input[data-site="nykaa"]')).not.toBeChecked();
  await page.close();
});

test('reset all settings restores defaults', async ({ extensionContext, optionsUrl }) => {
  await setSyncStorage(extensionContext, { minConfidence: 90, mode: 'hide' });
  const page = await extensionContext.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' });

  await page.locator('#reset-all').click();
  await expect(page.locator('#opt-confidence')).toHaveValue('70');
  await expect(page.locator('#mode-seg .seg[data-mode="badge"]')).toHaveClass(/active/);
  await page.close();
});

test('privacy policy and terms are available in-app', async ({ optionsPage }) => {
  await optionsPage.page.getByRole('group').filter({ hasText: 'Privacy Policy' }).locator('summary').click();
  await optionsPage.page.getByRole('group').filter({ hasText: 'Terms of Use' }).locator('summary').click();
  await expect(optionsPage.page.getByText('does not collect, store, or transmit')).toBeVisible();
  await expect(optionsPage.page.getByText('decision-support tool, not a guarantee')).toBeVisible();
});
