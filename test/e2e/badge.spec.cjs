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

test('badge shows the number of AI-flagged images on the page', async () => {
  const page = await context.newPage();
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });

  // 4 AI fixtures flag at ~92% (>= 70% floor).
  await expect.poll(() => page.locator('.rmf-badge').count(), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect.poll(() => badgeText(context), {
    message: 'badge text should equal the AI count', timeout: 10_000,
  }).toBe('4');

  console.log(`\n[e2e] toolbar badge = "${await badgeText(context)}"`);
  await page.close();
});

test('disabling detection clears the badge', async () => {
  const page = await context.newPage();
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => badgeText(context), { timeout: 15_000 }).toBe('4');

  // Toggle detection off via the content script's message channel.
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
