// scripts/capture-screenshots.cjs — regenerate the README/store-listing
// screenshots from the real, running extension against served fixture pages
// (the same offline fixtures the E2E suite uses — no live network).
//
// Usage: node scripts/capture-screenshots.cjs
// Output: docs/screenshots/*.png
'use strict';

const fs = require('fs');
const path = require('path');
// Reuse the same headless launch path the CI E2E run uses (extension-launcher.cjs
// only goes headless when CI=true) — this script needs pixels, not a display.
process.env.CI = process.env.CI || 'true';
const { launchExtensionContext, closeExtensionContext } = require('../test/e2e/helpers/extension-launcher.cjs');
const { getExtensionId, extensionUrl } = require('../test/e2e/helpers/chrome-api.cjs');
const { resetExtensionStorage, setSyncStorage } = require('../test/e2e/helpers/chrome-storage.cjs');
const { registerHfInferenceMock } = require('../test/e2e/helpers/mock-routes.cjs');
const { MYNTRA_LISTING_URL } = require('../test/e2e/helpers/constants.cjs');
const { PopupPage } = require('../test/e2e/pages/PopupPage.cjs');
const { OptionsPage } = require('../test/e2e/pages/OptionsPage.cjs');
const { ContentPage } = require('../test/e2e/pages/ContentPage.cjs');

const OUT_DIR = path.resolve(__dirname, '../docs/screenshots');

async function shot(page, name, opts = {}) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), ...opts });
  console.log(`  ✓ ${name}.png`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('Launching extension (headless)…');
  const context = await launchExtensionContext();
  try {
    await registerHfInferenceMock(context, () => [
      { label: 'artificial', score: 0.94 },
      { label: 'human', score: 0.06 },
    ]);
    await resetExtensionStorage(context);

    const extensionId = await getExtensionId(context);

    // 1. On-page badge + "Why flagged?" popover on a product listing.
    // Note: the E2E fixture uses placeholder product images (solid shapes /
    // noise textures, not real photos), so this is useful to confirm the
    // overlay renders correctly but is NOT suitable as a marketing screenshot —
    // see the note printed at the end of this script and CHROMEWEBSTORE.md.
    console.log('Capturing on-page badge + popover…');
    const contentPage = new ContentPage(await context.newPage());
    await contentPage.page.setViewportSize({ width: 1280, height: 900 });
    await contentPage.gotoListing(MYNTRA_LISTING_URL);
    await contentPage.waitForBadges(1, 20_000);
    await contentPage.page.waitForTimeout(500); // let the badge-in animation settle

    const firstBadge = contentPage.badges.first();
    await firstBadge.scrollIntoViewIfNeeded();
    const cardBox = await contentPage.productCards.first().boundingBox();
    if (cardBox) {
      await shot(contentPage.page, '01-badge-on-card', {
        clip: { x: Math.max(0, cardBox.x - 20), y: Math.max(0, cardBox.y - 20), width: cardBox.width + 40, height: cardBox.height + 40 },
      });
    }

    await firstBadge.click();
    await contentPage.popover.waitFor({ state: 'visible', timeout: 5000 });
    await contentPage.page.waitForTimeout(300); // let the popover-in animation settle
    const popBox = await contentPage.popover.boundingBox();
    if (popBox) {
      await shot(contentPage.page, '02-why-flagged-popover', {
        clip: { x: Math.max(0, popBox.x - 16), y: Math.max(0, popBox.y - 16), width: popBox.width + 32, height: popBox.height + 32 },
      });
    }
    await contentPage.page.close();

    // 2. Popup — Scan tab, preview mode (default, zero-setup state).
    console.log('Capturing popup — Scan tab (preview mode)…');
    const popupPage1 = new PopupPage(await context.newPage());
    await popupPage1.page.setViewportSize({ width: 380, height: 640 });
    await popupPage1.goto(extensionUrl(extensionId, 'popup/popup.html'));
    await popupPage1.page.waitForTimeout(500);
    await shot(popupPage1.page, '03-popup-scan-preview', { clip: { x: 0, y: 0, width: 380, height: 600 } });
    await popupPage1.page.close();

    // 3. Popup — Settings tab, Hugging Face connected (the "good" state).
    console.log('Capturing popup — Settings tab (Hugging Face connected)…');
    await setSyncStorage(context, {
      provider: 'huggingface',
      hfToken: 'hf_demo_token_for_screenshots',
      hfVerified: true,
      hfUser: 'demo-user',
    });
    const popupPage2 = new PopupPage(await context.newPage());
    await popupPage2.page.setViewportSize({ width: 380, height: 640 });
    await popupPage2.goto(extensionUrl(extensionId, 'popup/popup.html'));
    await popupPage2.page.waitForTimeout(300);
    await shot(popupPage2.page, '04-popup-scan-connected', { clip: { x: 0, y: 0, width: 380, height: 400 } });
    await popupPage2.openSettings();
    await popupPage2.page.waitForTimeout(300);
    await shot(popupPage2.page, '04b-popup-settings-connected', { clip: { x: 0, y: 0, width: 380, height: 600 } });
    await popupPage2.page.close();

    // 4. Options page — full settings.
    console.log('Capturing options page…');
    const optionsPage = new OptionsPage(await context.newPage());
    await optionsPage.page.setViewportSize({ width: 900, height: 1000 });
    await optionsPage.goto(extensionUrl(extensionId, 'options/options.html'));
    await optionsPage.page.waitForTimeout(300);
    await shot(optionsPage.page, '05-options-page', { fullPage: true });
    await optionsPage.page.close();

    console.log(`\nDone. Screenshots written to ${OUT_DIR}`);
    console.log('Note: these use offline test fixtures, not a live marketplace —');
    console.log('fine for README/docs, but re-shoot on a real marketplace page before');
    console.log('submitting Chrome Web Store listing screenshots (see CHROMEWEBSTORE.md).');
  } finally {
    await closeExtensionContext(context);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
