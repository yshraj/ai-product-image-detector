// GET_PRODUCT powers Compare + Tools tabs.
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { getProduct } = require('./helpers/chrome-messaging.cjs');
const { MYNTRA_PRODUCT_URL } = require('./helpers/constants.cjs');

test('GET_PRODUCT returns a usable product for the current page', async ({ extensionContext, contentPage }) => {
  await contentPage.gotoProduct(MYNTRA_PRODUCT_URL);
  await expect.poll(
    () => getProduct(extensionContext, 'https://www.myntra.com/*', MYNTRA_PRODUCT_URL),
    { timeout: 10_000 },
  ).toMatchObject({ site: 'myntra' });

  const product = await getProduct(extensionContext, 'https://www.myntra.com/*', MYNTRA_PRODUCT_URL);
  expect(product.title.length).toBeGreaterThan(0);
  expect(product.url).toMatch(/myntra\.com/);
  expect(product.image).toMatch(/^https?:\/\//);
});
