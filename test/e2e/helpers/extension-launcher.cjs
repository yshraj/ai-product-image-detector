// Launch Chromium with the unpacked extension loaded (Manifest V3).
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EXT_DIR } = require('./constants.cjs');
const { registerDefaultRoutes } = require('./mock-routes.cjs');

/**
 * Wait until the extension's MV3 service worker is available.
 * @param {import('@playwright/test').BrowserContext} context
 * @param {number} [timeout]
 */
async function waitForServiceWorker(context, timeout = 30_000) {
  const existing = context.serviceWorkers();
  if (existing.length) return existing[0];

  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const workers = context.serviceWorkers();
    if (workers.length) return workers[0];

    const remaining = Math.max(500, deadline - Date.now());
    try {
      return await context.waitForEvent('serviceworker', { timeout: Math.min(remaining, 5000) });
    } catch {
      // Nudge Chrome to spin up the worker by opening a transient tab.
      const page = await context.newPage();
      try { await page.goto('about:blank', { timeout: 3000 }); } catch { /* ignore */ }
      await page.close().catch(() => {});
    }
  }
  throw new Error('Extension service worker did not register — is the extension valid?');
}
async function launchExtensionContext(opts = {}) {
  const userDataDir = opts.userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'pw-chrome-ext-'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: process.env.CI === 'true',
    channel: 'chromium',
    args: [
      ...(process.env.CI === 'true' ? ['--headless=new'] : []),
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  await context.addInitScript(() => {
    try { localStorage.setItem('RMF_DEBUG', '1'); } catch { /* noop */ }
  });

  if (!opts.skipRoutes) {
    await registerDefaultRoutes(context, opts.routeOpts);
  }

  await waitForServiceWorker(context, 30_000);

  context.__userDataDir = userDataDir;
  context.__ownsUserDataDir = !opts.userDataDir;
  return context;
}

async function closeExtensionContext(context) {
  const dir = context.__userDataDir;
  const owns = context.__ownsUserDataDir;
  await context.close();
  if (owns && dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

module.exports = { launchExtensionContext, closeExtensionContext, waitForServiceWorker };
