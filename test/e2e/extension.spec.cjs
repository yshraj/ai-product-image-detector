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

  // Badges are accessible to assistive tech (interactive button + label).
  const firstBadge = page.locator('.rmf-badge').first();
  await expect(firstBadge).toHaveAttribute('role', 'button');
  await expect(firstBadge).toHaveAttribute('aria-label', /RealModel Filter:.*confidence/);

  // Infinite scroll: scrolling to the bottom appends a new batch below the fold…
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.locator('.product-base').count(),
    { message: 'second batch inserted', timeout: 10_000 }).toBeGreaterThan(initialCards);

  // …then scrolling them into view gets them scanned (viewport-gated).
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const grown = await page.locator('.product-base').count();
  await expect.poll(() => page.locator('.product-base[data-rmf-scanned="true"]').count(),
    { message: 'revealed cards scanned after scroll', timeout: 20_000 }).toBe(grown);

  console.log(`[e2e] after scroll: ${grown} cards, ${await page.locator('.rmf-badge').count()} badges`);
  await page.close();
});

test('viewport gating: off-screen cards are not scanned until revealed', async () => {
  const page = await context.newPage();
  // A small viewport so most of the initial grid sits below the fold.
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });

  // Some card gets scanned…
  await expect.poll(() => page.locator('.product-base[data-rmf-scanned="true"]').count(),
    { message: 'a visible card is scanned', timeout: 20_000 }).toBeGreaterThan(0);

  // …but NOT all of them — the off-screen ones are deferred (the whole point:
  // we don't call the model for images the user never looks at).
  const total = await page.locator('.product-base').count();
  const scannedEarly = await page.locator('.product-base[data-rmf-scanned="true"]').count();
  console.log(`\n[e2e] gating: ${scannedEarly}/${total} scanned before scrolling`);
  expect(scannedEarly, 'gating should defer off-screen cards').toBeLessThan(total);

  // Scrolling down reveals more cards, which then get scanned on demand.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.locator('.product-base[data-rmf-scanned="true"]').count(),
    { message: 'more cards scanned after scrolling', timeout: 20_000 }).toBeGreaterThan(scannedEarly);

  await page.close();
});
