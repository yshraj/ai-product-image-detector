// scripts/generate-store-screenshot.cjs — composes real popup UI captures
// (from capture-screenshots.cjs) onto Chrome-Web-Store-compliant 1280x800
// canvases with brand styling. Covers the listing screenshot slots that
// don't need real marketplace content; the badges-on-a-real-listing shots
// still require a manual live-site capture (see CHROMEWEBSTORE.md).
//
// Usage: node scripts/generate-store-screenshot.cjs
// Requires: docs/screenshots/03-popup-scan-preview.png and
//           docs/screenshots/04b-popup-settings-connected.png
//           (run "npm run capture-screenshots" first)
// Output: docs/promo/store-screenshot-*.png
'use strict';

const fs = require('fs');
const path = require('path');
process.env.CI = process.env.CI || 'true';
const { chromium } = require('@playwright/test');

const OUT_DIR = path.join(__dirname, '../docs/promo');
const SHOT_DIR = path.join(__dirname, '../docs/screenshots');
const ICON_PATH = path.join(__dirname, '../icons/icon-128.png');

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif`;
const GRADIENT = `linear-gradient(135deg, #34D399 0%, #10B981 55%, #047857 100%)`;

const SLIDES = [
  {
    popup: 'store-screenshot-popup-1280x800.png',
    src: '03-popup-scan-preview.png',
    headline: 'Is this product photo <span class="accent">real</span>?',
    sub: 'TrueKart scans product images on AliExpress, Temu, Shein, Amazon, Myntra, Flipkart, Meesho &amp; Nykaa and flags the ones that look AI-generated — before you buy.',
  },
  {
    popup: 'store-screenshot-settings-1280x800.png',
    src: '04b-popup-settings-connected.png',
    headline: 'Free to use. <span class="accent">Free to trust.</span>',
    sub: 'Works instantly with a built-in on-device engine, or connect a free Hugging Face model in about a minute for higher-confidence results. No account, no backend, no tracking.',
  },
];

function dataUri(file, mime) {
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

function html(popupSrc, iconSrc, headline, sub) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1280px; height: 800px; font-family: ${FONT}; overflow: hidden; }
    .stage {
      width: 1280px; height: 800px; background: ${GRADIENT};
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 90px; position: relative; color: #ffffff;
    }
    .copy { max-width: 520px; }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
    .brand img { width: 40px; height: 40px; border-radius: 10px; }
    .brand span { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
    h1 { font-size: 44px; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; }
    h1 .accent { color: #d1fae5; }
    p { margin-top: 20px; font-size: 19px; font-weight: 500; color: #ecfdf5; line-height: 1.5; }
    .frame {
      flex: none; width: 420px; border-radius: 28px; background: #0c1222;
      padding: 14px; box-shadow: 0 30px 70px rgba(4,64,48,0.45), 0 10px 24px rgba(4,64,48,0.3);
      transform: rotate(1.2deg);
    }
    .frame-inner { border-radius: 18px; overflow: hidden; background: #fff; }
    .frame-inner img { display: block; width: 100%; height: auto; }
  </style></head>
  <body>
    <div class="stage">
      <div class="copy">
        <div class="brand"><img src="${iconSrc}" alt=""><span>TrueKart</span></div>
        <h1>${headline}</h1>
        <p>${sub}</p>
      </div>
      <div class="frame"><div class="frame-inner"><img src="${popupSrc}" alt="TrueKart popup"></div></div>
    </div>
  </body></html>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const iconSrc = dataUri(ICON_PATH, 'image/png');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const slide of SLIDES) {
      const srcPath = path.join(SHOT_DIR, slide.src);
      if (!fs.existsSync(srcPath)) {
        console.error(`Skipping ${slide.popup}: missing ${srcPath} — run "npm run capture-screenshots" first.`);
        continue;
      }
      const popupSrc = dataUri(srcPath, 'image/png');
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.setContent(html(popupSrc, iconSrc, slide.headline, slide.sub), { waitUntil: 'load' });
      const out = path.join(OUT_DIR, slide.popup);
      await page.screenshot({ path: out });
      await page.close();
      console.log(`✓ ${out} (1280x800)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
