// research/accuracy-test/run-heuristic.cjs
// Runs the EXACT current on-device heuristic (ported from
// detection/tfjs-detector.js) against ./images and prints accuracy vs labels.
// Uses a Playwright page so canvas.getImageData works; images are passed as
// data: URLs (which never taint the canvas).
//
//   node research/accuracy-test/run-heuristic.cjs

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { printReport } = require('./metrics.cjs');

const SET = process.argv[2] || '.'; // e.g. "set2"
const DIR = path.join(__dirname, SET);
const IMG = path.join(DIR, 'images');

// Verbatim port of heuristicScore() from detection/tfjs-detector.js.
function heuristicInPage() {
  window.__heur = async (dataUrl) => {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = dataUrl;
    });
    const W = 96, H = 96;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);
    const g = new Float64Array(W * H);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      g[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    const variance = (arr) => {
      let m = 0; for (const v of arr) m += v; m /= arr.length;
      let s = 0; for (const v of arr) s += (v - m) ** 2; return s / arr.length;
    };
    const border = [];
    for (let x = 0; x < W; x++) { border.push(g[x], g[(H - 1) * W + x]); }
    for (let y = 0; y < H; y++) { border.push(g[y * W], g[y * W + W - 1]); }
    const bgFlat = Math.max(0, 1 - variance(border) / 350);
    let edge = 0;
    for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) {
      const i = y * W + x;
      edge += Math.abs(g[i] - g[i - 1]) + Math.abs(g[i] - g[i - W]);
    }
    const edgeAvg = edge / ((W - 1) * (H - 1));
    const smooth = Math.max(0, 1 - edgeAvg / 22);
    const B = 8, blockVars = [];
    for (let by = 0; by + B <= H; by += B) for (let bx = 0; bx + B <= W; bx += B) {
      const block = [];
      for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) block.push(g[(by + y) * W + (bx + x)]);
      blockVars.push(variance(block));
    }
    blockVars.sort((a, b) => a - b);
    const p20 = blockVars[Math.floor(blockVars.length * 0.2)] || 0;
    const noiseLack = Math.max(0, 1 - p20 / 6);
    const score01 = 0.45 * noiseLack + 0.35 * smooth + 0.20 * bgFlat;
    return Math.round(Math.min(1, score01) * 100);
  };
}

(async () => {
  const files = fs.readdirSync(IMG).filter((f) => /^\d+\.jpg$/.test(f)).sort();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.evaluate(heuristicInPage);

  const scoreMap = {};
  for (const f of files) {
    const id = f.replace('.jpg', '');
    const b64 = fs.readFileSync(path.join(IMG, f)).toString('base64');
    const dataUrl = `data:image/jpeg;base64,${b64}`;
    scoreMap[id] = await page.evaluate((u) => window.__heur(u), dataUrl);
  }
  await browser.close();

  fs.writeFileSync(
    path.join(DIR, 'heuristic-scores.json'),
    JSON.stringify(scoreMap, null, 2),
  );
  // Extension flags the heuristic AI at confidence >= 60 (see tfjs-detector.js).
  printReport(`ON-DEVICE HEURISTIC — ${SET}`, scoreMap, 60, DIR);
})();
