// Accessibility audit with axe-core (popup + options).
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const AxeBuilderImport = require('@axe-core/playwright');
const AxeBuilder = AxeBuilderImport.default || AxeBuilderImport.AxeBuilder || AxeBuilderImport;

async function audit(page) {
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important;opacity:1!important}',
  });
  await page.waitForTimeout(250);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test('popup (preview state) has no serious/critical a11y violations', async ({ extensionContext, popupUrl }) => {
  const page = await extensionContext.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#nav-settings').click();
  await page.locator('#tab-huggingface').click();
  expect(await audit(page)).toEqual([]);
  await page.close();
});

test('popup (connected state) has no serious/critical a11y violations', async ({ extensionContext, popupUrl }) => {
  const page = await extensionContext.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#nav-settings').click();
  await page.locator('#tab-huggingface').click();
  await page.locator('#hf-token').fill('hf_demotoken123');
  await page.locator('#hf-save').click();
  await expect(page.locator('#status-chip')).toHaveText('Connected');
  expect(await audit(page)).toEqual([]);
  await page.close();
});

test('options page has no serious/critical a11y violations', async ({ optionsPage }) => {
  expect(await audit(optionsPage.page)).toEqual([]);
});
