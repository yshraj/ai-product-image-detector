// research/accuracy-test/scrape.cjs
// Scrape ~N product images from a Flipkart search into ./images and write
// images/manifest.json. Reuses the installed Playwright Chromium.
//
//   node research/accuracy-test/scrape.cjs "navy blue casual shirt" 18
//
// Notes:
//  - Flipkart CDN URLs carry a /<w>/<h>/ size segment; we bump it to 832x832
//    so the detector sees a real photo, not a 128px thumbnail.
//  - We only keep product-card images (skip logos, icons, sprites).

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const QUERY = process.argv[2] || 'navy blue casual shirt';
const WANT = Number(process.argv[3] || 18);
const OUT = path.join(__dirname, 'images');

const upscale = (u) => u.replace(/\/image\/\d+\/\d+\//, '/image/832/832/');
const isProductImg = (u) =>
  /rukminim\d*\.flixcart\.com\/image\//.test(u) && !/promos|logo|icon/i.test(u);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    viewport: { width: 1400, height: 1000 },
  });

  const url = `https://www.flipkart.com/search?q=${encodeURIComponent(QUERY)}`;
  console.log('opening', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Dismiss the login popup Flipkart throws on first load.
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(2500);

  // Scroll to trigger lazy image loading.
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 1600);
    await page.waitForTimeout(900);
  }

  const raw = await page.$$eval('img', (imgs) =>
    imgs.map((im) => im.currentSrc || im.src).filter(Boolean),
  );
  await browser.close();

  const seen = new Set();
  const urls = [];
  for (const u of raw) {
    if (!isProductImg(u)) continue;
    const big = upscale(u);
    const key = big.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(big);
    if (urls.length >= WANT) break;
  }
  console.log(`found ${urls.length} product images`);

  const manifest = [];
  let i = 0;
  for (const u of urls) {
    i++;
    const id = String(i).padStart(2, '0');
    const file = `${id}.jpg`;
    try {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(path.join(OUT, file), buf);
      manifest.push({ id, file, url: u, bytes: buf.length });
      console.log(`  saved ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`  skip ${file}: ${e.message}`);
    }
  }

  fs.writeFileSync(
    path.join(OUT, 'manifest.json'),
    JSON.stringify({ query: QUERY, count: manifest.length, images: manifest }, null, 2),
  );
  console.log(`\ndone — ${manifest.length} images in ${OUT}`);
})();
