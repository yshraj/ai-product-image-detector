// test/e2e/badge.spec.cjs
// The toolbar action badge reflects the AI count found on the current tab.
const { test, expect } = require('@playwright/test');
const { launch, serviceWorker } = require('./_setup.cjs');

let context;
test.beforeAll(async () => { context = await launch(); });
test.afterAll(async () => { await context?.close(); });

async function badgeText(ctx) {
  const sw = await serviceWorker(ctx);
  return sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: 'https://www.myntra.com/*' });
    if (!tabs[0]) return null;
    return chrome.action.getBadgeText({ tabId: tabs[0].id });
  });
}

async function openFixture(ctx) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 1400 }); // all cards in view
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });
  return page;
}

const onPageCount = (page) => page.locator('.rmf-badge').count();

// Poll until the toolbar badge and the on-page flagged count agree and are > 0.
async function badgeMatchesPage(page) {
  const n = await onPageCount(page);
  const b = Number(await badgeText(context));
  return n > 0 && b === n;
}

test('badge equals the number of AI-flagged images on the page', async () => {
  const page = await openFixture(context);
  await expect.poll(() => badgeMatchesPage(page), {
    message: 'toolbar badge converges to the on-page flagged count', timeout: 20_000,
  }).toBe(true);
  console.log(`\n[e2e] toolbar badge = "${await badgeText(context)}" (on-page = ${await onPageCount(page)})`);
  await page.close();
});

test('RESCAN re-detects the page and keeps the badge consistent', async () => {
  const page = await openFixture(context);
  await expect.poll(() => badgeMatchesPage(page), { timeout: 20_000 }).toBe(true);

  const sw = await serviceWorker(context);
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://www.myntra.com/*' });
    await chrome.tabs.sendMessage(tab.id, { type: 'RESCAN' });
  });

  await expect.poll(() => badgeMatchesPage(page), {
    message: 'badge + page re-converge after rescan', timeout: 15_000,
  }).toBe(true);
  await page.close();
});

test('disabling detection clears the badge', async () => {
  const page = await openFixture(context);
  await expect.poll(() => onPageCount(page), { timeout: 20_000 }).toBeGreaterThan(0);

  const sw = await serviceWorker(context);
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://www.myntra.com/*' });
    await chrome.tabs.sendMessage(tab.id, { type: 'SET_ENABLED', enabled: false });
  });

  await expect.poll(() => badgeText(context), {
    message: 'badge clears when paused', timeout: 10_000,
  }).toBe('');
  await page.close();
});
