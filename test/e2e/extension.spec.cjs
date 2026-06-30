// Heuristic-preview detection + infinite-scroll on cross-origin images.
const { test, expect } = require('./fixtures/extension.fixture.cjs');

test('preview engine: discriminates AI vs real and handles infinite scroll', async ({ contentPage }) => {
  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await contentPage.waitForBadges();

  const initialCards = await contentPage.productCards.count();
  const scores = await contentPage.page.$$eval('.product-base', (cards) =>
    cards.map((c) => {
      const s = c.querySelector('.rmf-score');
      return { img: c.getAttribute('data-testimg'), score: s ? parseInt(s.textContent) : null };
    }));
  const aiFlagged = scores.filter((s) => s.img?.startsWith('ai') && s.score != null).length;
  const realFlagged = scores.filter((s) => s.img?.startsWith('real') && s.score != null).length;

  expect(aiFlagged).toBeGreaterThan(0);
  expect(aiFlagged).toBeGreaterThan(realFlagged);
  expect(await contentPage.page.locator('.rmf-badge[data-preview="true"]').count()).toBeGreaterThan(0);

  const firstBadge = contentPage.badges.first();
  await expect(firstBadge).toHaveAttribute('role', 'button');
  await expect(firstBadge).toHaveAttribute('aria-label', /(ShopSmart|ShopShield):.*confidence/);

  await contentPage.scrollToBottom();
  await expect.poll(() => contentPage.productCards.count(), { timeout: 10_000 }).toBeGreaterThan(initialCards);

  await contentPage.scrollToBottom();
  const grown = await contentPage.productCards.count();
  await expect.poll(() => contentPage.scannedCards.count(), { timeout: 20_000 }).toBe(grown);
});

test('viewport gating: off-screen cards are not scanned until revealed', async ({ contentPage }) => {
  await contentPage.page.setViewportSize({ width: 360, height: 600 });
  await contentPage.gotoListing();
  await contentPage.waitForScan(1);

  const total = await contentPage.productCards.count();
  const scannedEarly = await contentPage.scannedCards.count();
  expect(scannedEarly).toBeLessThan(total);

  await contentPage.scrollToBottom();
  await expect.poll(() => contentPage.scannedCards.count(), { timeout: 20_000 }).toBeGreaterThan(scannedEarly);
});
