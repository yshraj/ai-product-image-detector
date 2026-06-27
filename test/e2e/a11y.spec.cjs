// test/e2e/a11y.spec.cjs
// Automated accessibility audit of the popup with axe-core. Asserts there are no
// serious/critical violations (incl. colour contrast and ARIA wiring) in both
// the default "preview" state and a connected state.
const { test, expect } = require('@playwright/test');
const AxeBuilderImport = require('@axe-core/playwright');
const AxeBuilder = AxeBuilderImport.default || AxeBuilderImport.AxeBuilder || AxeBuilderImport;
const { launch, extensionId } = require('./_setup.cjs');

let context;
let popupUrl;
let optionsUrl;

test.beforeAll(async () => {
  context = await launch();
  const id = await extensionId(context);
  popupUrl = `chrome-extension://${id}/popup/popup.html`;
  optionsUrl = `chrome-extension://${id}/options/options.html`;
});
test.afterAll(async () => { await context?.close(); });

async function audit(page) {
  // Neutralise entrance animations so contrast is measured at final opacity,
  // not mid-fade (a blended sample would give false contrast failures). This
  // also mirrors what prefers-reduced-motion users actually see.
  await page.addStyleTag({
    content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}',
  });
  await page.waitForTimeout(60);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (blocking.length) {
    console.log('\n[a11y] violations:\n' +
      blocking.map((v) => `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`).join('\n'));
  }
  return blocking;
}

test('popup (preview state) has no serious/critical a11y violations', async () => {
  const page = await context.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#provider-seg .seg[data-provider="huggingface"]').click();
  expect(await audit(page)).toEqual([]);
  await page.close();
});

test('popup (connected state) has no serious/critical a11y violations', async () => {
  const page = await context.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#provider-seg .seg[data-provider="huggingface"]').click();
  await page.locator('#hf-token').fill('hf_demotoken123');
  await page.locator('#hf-save').click();
  await expect(page.locator('#status-chip')).toHaveText('Connected');
  expect(await audit(page)).toEqual([]);
  await page.close();
});

test('options page has no serious/critical a11y violations', async () => {
  const page = await context.newPage();
  await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Detection preferences' })).toBeVisible();
  expect(await audit(page)).toEqual([]);
  await page.close();
});
