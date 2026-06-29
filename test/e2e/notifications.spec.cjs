// test/e2e/notifications.spec.cjs
// Opt-in notifications: when enabled, a page with AI fires one notification
// (observed via the worker's rmf_lastNotify record); when off, nothing fires.
const { test, expect } = require('@playwright/test');
const { launch, setSyncStorage, serviceWorker } = require('./_setup.cjs');

async function lastNotify(ctx) {
  const sw = await serviceWorker(ctx);
  return sw.evaluate(() =>
    chrome.storage.session.get('rmf_lastNotify').then((r) => r.rmf_lastNotify || null));
}

async function loadFlagged(ctx) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto('https://www.myntra.com/men-shirts', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.locator('.rmf-badge').count(), { timeout: 20_000 }).toBeGreaterThan(0);
  return page;
}

test('notifies once when enabled and a page has AI', async () => {
  const context = await launch();
  try {
    await setSyncStorage(context, {
      provider: 'heuristic', enabled: true, notifyOnAI: true, minConfidence: 70, disabledSites: [],
    });
    await loadFlagged(context);
    await expect.poll(() => lastNotify(context).then((r) => r && r.ai > 0), {
      message: 'a notification should be recorded', timeout: 10_000,
    }).toBe(true);
  } finally { await context.close(); }
});

test('does not notify when the toggle is off (default)', async () => {
  const context = await launch();
  try {
    await setSyncStorage(context, {
      provider: 'heuristic', enabled: true, notifyOnAI: false, minConfidence: 70, disabledSites: [],
    });
    const page = await loadFlagged(context);
    await page.waitForTimeout(1500); // give any (wrong) notification time to fire
    expect(await lastNotify(context), 'no notification when opted out').toBeNull();
  } finally { await context.close(); }
});
