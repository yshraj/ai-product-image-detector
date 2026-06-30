#!/usr/bin/env node
// Capture QA screenshots of major ShopShield workflows (offline fixtures only).
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { launchExtensionContext, closeExtensionContext } = require('../test/e2e/helpers/extension-launcher.cjs');
const { getExtensionId, extensionUrl } = require('../test/e2e/helpers/chrome-api.cjs');
const { setSyncStorage, setLocalStorage } = require('../test/e2e/helpers/chrome-storage.cjs');
const { MYNTRA_PRODUCT_URL, MYNTRA_LISTING_URL } = require('../test/e2e/helpers/constants.cjs');
const { registerHfInferenceMock } = require('../test/e2e/helpers/mock-routes.cjs');

const OUT = path.resolve(__dirname, '../qa-screenshots/after');

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('  ✓', file);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await launchExtensionContext();
  await setLocalStorage(ctx, { rmf_onboarding_done: true });
  await setSyncStorage(ctx, { serpApiKey: 'test_serp_key', provider: 'huggingface', hfToken: 'hf_test', hfVerified: true });
  await registerHfInferenceMock(ctx);

  const extId = await getExtensionId(ctx);
  const popupUrl = extensionUrl(extId, 'popup/popup.html');

  const popup = await ctx.newPage();
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await shot(popup, '01-popup-scan-tab');

  await popup.locator('#nav-compare').click();
  await shot(popup, '02-popup-compare-tab-empty');

  const productTab = await ctx.newPage();
  await productTab.goto(MYNTRA_PRODUCT_URL, { waitUntil: 'domcontentloaded' });
  await popup.reload({ waitUntil: 'domcontentloaded' });
  await popup.locator('#nav-compare').click();
  await popup.waitForTimeout(500);
  await shot(popup, '03-popup-compare-product-loaded');

  await popup.locator('#compare-search').click();
  await popup.waitForSelector('.compare-results .result-card', { timeout: 30_000 });
  await shot(popup, '04-popup-compare-results-success');

  await popup.locator('#nav-tools').click();
  await shot(popup, '05-popup-tools-tab');

  await popup.locator('#nav-settings').click();
  await shot(popup, '06-popup-settings-tab');

  const listing = await ctx.newPage();
  await listing.setViewportSize({ width: 1280, height: 1400 });
  await listing.goto(MYNTRA_LISTING_URL, { waitUntil: 'domcontentloaded' });
  await listing.waitForSelector('.rmf-badge', { timeout: 30_000 });
  await shot(listing, '07-myntra-listing-badges');

  await productTab.bringToFront();
  await shot(productTab, '08-myntra-product-page');

  await ctx.route('https://serpapi.com/**', (route) => route.fulfill({ status: 503, body: '{"error":"mock fail"}' }));
  const popup2 = await ctx.newPage();
  await popup2.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup2.locator('#nav-compare').click();
  await popup2.waitForTimeout(300);
  await popup2.locator('#compare-search').click();
  await popup2.waitForTimeout(3000);
  await shot(popup2, '09-compare-search-in-progress-or-partial');

  await popup.close();
  await popup2.close();
  await productTab.close();
  await listing.close();
  await closeExtensionContext(ctx);
  console.log(`\nQA screenshots saved to ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
