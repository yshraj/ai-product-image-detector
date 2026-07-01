// Network mocks for offline, deterministic extension tests.
const fs = require('fs');
const path = require('path');
const { ASSET_DIR } = require('./constants.cjs');
const {
  listingHtml,
  flipkartListingHtml,
  meeshoListingHtml,
  nykaaListingHtml,
  productHtml,
  serpShoppingResponse,
  PRODUCT_META_2,
} = require('./marketplace-fixture.cjs');

function isProductUrl(url) {
  return /\/buy$|\/p\/|\/product\//.test(url) || url.includes('/1234567/') || url.includes('/9876543/');
}

function marketplaceBody(url) {
  if (isProductUrl(url)) {
    const site = url.includes('flipkart') ? 'flipkart' : 'myntra';
    if (url.includes('9876543')) return productHtml(site, PRODUCT_META_2);
    return productHtml(site);
  }
  if (url.includes('flipkart.com')) return flipkartListingHtml();
  if (url.includes('meesho.com')) return meeshoListingHtml();
  if (url.includes('nykaa.com')) return nykaaListingHtml();
  return listingHtml();
}

/**
 * Register default routes: marketplace fixtures, CDN images, Hugging Face whoami, SerpApi.
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{ whoami?: (auth: string) => { status: number, body: object }, serp?: boolean }} [opts]
 */
async function registerDefaultRoutes(context, opts = {}) {
  const hosts = [
    'https://www.myntra.com/**',
    'https://www.flipkart.com/**',
    'https://www.meesho.com/**',
    'https://www.nykaa.com/**',
    'https://www.amazon.in/**',
  ];
  for (const pattern of hosts) {
    await context.route(pattern, (route) => {
      const url = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: marketplaceBody(url),
      });
    });
  }

  // Internal JSON APIs used by compare fallback — return empty so tests stay offline.
  await context.route('https://www.myntra.com/gateway/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"products":[]}' }));
  await context.route('https://www.meesho.com/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"catalogs":[]}' }));

  if (opts.serp !== false) {
    await registerSerpApiMock(context);
  }

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

/** Mock SerpApi Google Shopping — no real API quota consumed. */
async function registerSerpApiMock(context, responseFn) {
  await context.route('https://serpapi.com/**', (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get('q') || '';
    const body = responseFn ? responseFn(q) : serpShoppingResponse(q);
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
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

module.exports = { registerDefaultRoutes, registerSerpApiMock, registerHfInferenceMock };
