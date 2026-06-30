// Network mocks for offline, deterministic extension tests.
const fs = require('fs');
const path = require('path');
const { ASSET_DIR } = require('./constants.cjs');
const { listingHtml, productHtml } = require('./marketplace-fixture.cjs');

/**
 * Register default routes: Myntra fixture pages, CDN images, Hugging Face whoami.
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{ whoami?: (auth: string) => { status: number, body: object } }} [opts]
 */
async function registerDefaultRoutes(context, opts = {}) {
  await context.route('https://www.myntra.com/**', (route) => {
    const url = route.request().url();
    const isProduct = /\/buy$|\/p\//.test(url) || url.includes('/1234567/');
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: isProduct ? productHtml() : listingHtml(),
    });
  });

  await context.route('https://huggingface.co/api/whoami-v2', (route) => {
    const auth = route.request().headers().authorization || '';
    if (opts.whoami) {
      const r = opts.whoami(auth);
      return route.fulfill({
        status: r.status,
        contentType: 'application/json',
        body: JSON.stringify(r.body),
      });
    }
    if (/bad/i.test(auth)) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Invalid"}' });
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'testuser', fullname: 'Test User' }),
    });
  });

  await context.route('https://assets.myntassets.com/**', (route) => {
    const name = route.request().url().split('/').pop().split('?')[0];
    const file = path.join(ASSET_DIR, name);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    route.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(file) });
  });
}

/**
 * Mock Hugging Face inference router — call `onRequest` to observe invocations.
 * @param {import('@playwright/test').BrowserContext} context
 * @param {(url: string) => object[]} [responseFn]
 * @returns {{ getCallCount: () => number }}
 */
async function registerHfInferenceMock(context, responseFn) {
  let calls = 0;
  const defaultResponse = () => [
    { label: 'artificial', score: 0.97 },
    { label: 'human', score: 0.03 },
  ];
  await context.route('https://router.huggingface.co/**', (route) => {
    calls++;
    const body = (responseFn || defaultResponse)(route.request().url());
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return { getCallCount: () => calls };
}

module.exports = { registerDefaultRoutes, registerHfInferenceMock };
