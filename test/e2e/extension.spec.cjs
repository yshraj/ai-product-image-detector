// test/e2e/extension.spec.cjs
// Heuristic-preview detection + infinite-scroll, on cross-origin CORS-less
// images (production-like). Proves the service-worker image-fetch fix and the
// scroll observer both work.
const { test, expect } = require('@playwright/test');
const { launch } = require('./_setup.cjs');

let context;
test.beforeAll(async () => { context = await launch(); });
test.afterAll(async () => { await context?.close(); });

test('preview engine: discriminates AI vs real and handles infinite scroll', async () => {
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));

  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });

  await expect.poll(() => page.locator('.rmf-badge').count(),
    { message: 'badges should appear on cross-origin images', timeout: 20_000 }).toBeGreaterThan(0);

  const initialCards = await page.locator('.product-base').count();
  console.log(`\n[e2e] initial: ${initialCards} cards, ${await page.locator('.rmf-badge').count()} badges`);

  const scores = await page.$$eval('.product-base', (cards) =>
    cards.map((c) => {
      const s = c.querySelector('.rmf-score');
      return { img: c.getAttribute('data-testimg'), score: s ? parseInt(s.textContent) : null };
    }));
  const aiFlagged = scores.filter((s) => s.img?.startsWith('ai') && s.score != null).length;
  const realFlagged = scores.filter((s) => s.img?.startsWith('real') && s.score != null).length;
  console.log(`[e2e] AI-like flagged ${aiFlagged}, real-like flagged ${realFlagged}`);
  console.log(`[e2e] flagged: ${scores.filter((s) => s.score != null).map((s) => s.img + '=' + s.score + '%').join(', ')}`);

  expect(aiFlagged, 'some AI-like images flagged').toBeGreaterThan(0);
  expect(aiFlagged, 'AI-like flagged more than real-like').toBeGreaterThan(realFlagged);

  // Preview badges must be tagged as preview.
  expect(await page.locator('.rmf-badge[data-preview="true"]').count()).toBeGreaterThan(0);

  // Infinite scroll.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.locator('.product-base').count(),
    { message: 'second batch inserted', timeout: 10_000 }).toBeGreaterThan(initialCards);

  const grown = await page.locator('.product-base').count();
  await expect.poll(() => page.locator('.product-base[data-rmf-scanned="true"]').count(),
    { message: 'all cards scanned after scroll', timeout: 20_000 }).toBe(grown);

  console.log(`[e2e] after scroll: ${grown} cards, ${await page.locator('.rmf-badge').count()} badges`);
  await page.close();
});
