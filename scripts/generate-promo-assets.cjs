// scripts/generate-promo-assets.cjs — renders Chrome Web Store promotional
// graphics (small tile 440x280, marquee/feature graphic 1400x560) from the
// extension's real icon and brand tokens (popup/popup.css), via Playwright
// screenshotting an HTML template at exact pixel dimensions. Iconographic
// only — no marketplace screenshots, per docs/STORE-ASSETS.md's spec.
//
// Usage: node scripts/generate-promo-assets.cjs
// Output: docs/promo/*.png
'use strict';

const fs = require('fs');
const path = require('path');
process.env.CI = process.env.CI || 'true';
const { chromium } = require('@playwright/test');

const OUT_DIR = path.join(__dirname, '../docs/promo');
const ICON_PATH = path.join(__dirname, '../icons/icon-128.png');

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif`;
const GRADIENT = `linear-gradient(135deg, #34D399 0%, #10B981 55%, #047857 100%)`;

function iconDataUri() {
  const b64 = fs.readFileSync(ICON_PATH).toString('base64');
  return `data:image/png;base64,${b64}`;
}

function smallTileHtml(icon) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 440px; height: 280px; font-family: ${FONT}; overflow: hidden; }
    .tile {
      width: 440px; height: 280px; display: flex; align-items: center; gap: 24px;
      padding: 0 32px; background: ${GRADIENT}; position: relative;
    }
    .icon-wrap {
      flex: none; width: 120px; height: 120px; border-radius: 26px;
      background: rgba(255,255,255,0.16); display: grid; place-items: center;
      box-shadow: 0 8px 24px rgba(4,120,87,0.35);
    }
    .icon-wrap img { width: 88px; height: 88px; border-radius: 18px; }
    .text { color: #ffffff; }
    .word { font-size: 34px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
    .word .accent { color: #d1fae5; }
    .tagline { margin-top: 8px; font-size: 16px; font-weight: 500; color: #ecfdf5; line-height: 1.35; max-width: 250px; }
  </style></head>
  <body>
    <div class="tile">
      <div class="icon-wrap"><img src="${icon}" alt=""></div>
      <div class="text">
        <div class="word">True<span class="accent">Kart</span></div>
        <div class="tagline">Spot AI &amp; fake product photos before you buy.</div>
      </div>
    </div>
  </body></html>`;
}

function marqueeHtml(icon) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1400px; height: 560px; font-family: ${FONT}; overflow: hidden; }
    .marquee {
      width: 1400px; height: 560px; position: relative; background: ${GRADIENT};
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; color: #ffffff;
    }
    .badge-row { display: flex; gap: 18px; margin-bottom: 36px; }
    .fake-badge {
      display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px;
      border-radius: 999px; background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.28); font-size: 15px; font-weight: 700;
      backdrop-filter: blur(2px);
    }
    .dot { width: 9px; height: 9px; border-radius: 50%; }
    .dot.red { background: #f87171; }
    .dot.amber { background: #fbbf24; }
    .dot.green { background: #6ee7b7; }
    h1 { font-size: 52px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; max-width: 980px; }
    h1 .accent { color: #d1fae5; }
    p.sub { margin-top: 18px; font-size: 22px; font-weight: 500; color: #ecfdf5; max-width: 760px; line-height: 1.4; }
    .footer { position: absolute; left: 40px; bottom: 32px; display: flex; align-items: center; gap: 12px; }
    .footer img { width: 40px; height: 40px; border-radius: 10px; }
    .footer .name { font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: -0.01em; }
  </style></head>
  <body>
    <div class="marquee">
      <div class="badge-row">
        <span class="fake-badge"><span class="dot red"></span>AI Generated</span>
        <span class="fake-badge"><span class="dot amber"></span>Likely AI</span>
        <span class="fake-badge"><span class="dot green"></span>Looks Real</span>
      </div>
      <h1>Is this product photo <span class="accent">real</span>?</h1>
      <p class="sub">TrueKart flags AI-generated &amp; fake product photos on AliExpress, Temu, Shein, Amazon &amp; more — before you buy.</p>
      <div class="footer"><img src="${icon}" alt=""><span class="name">TrueKart</span></div>
    </div>
  </body></html>`;
}

async function shootHtml(browser, html, width, height, outPath) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: outPath });
  await page.close();
  console.log(`  ✓ ${path.basename(outPath)} (${width}x${height})`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const icon = iconDataUri();
  const browser = await chromium.launch({ headless: true });
  try {
    await shootHtml(browser, smallTileHtml(icon), 440, 280, path.join(OUT_DIR, 'small-tile-440x280.png'));
    await shootHtml(browser, marqueeHtml(icon), 1400, 560, path.join(OUT_DIR, 'marquee-1400x560.png'));
  } finally {
    await browser.close();
  }
  console.log(`\nDone. Promotional graphics written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
