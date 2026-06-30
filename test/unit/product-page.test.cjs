// test/unit/product-page.test.cjs — product URL detection via shared marketplace-url util.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isMarketplaceProductUrl } = require('../../utils/marketplace-url.js');

test('isMarketplaceProductUrl detects Flipkart product pages', () => {
  assert.equal(
    isMarketplaceProductUrl('https://www.flipkart.com/rare-rabbit-shirt/p/itm123'),
    true,
  );
  assert.equal(isMarketplaceProductUrl('https://www.flipkart.com/search?q=shirt'), false);
});

test('isMarketplaceProductUrl detects Myntra product pages', () => {
  assert.equal(isMarketplaceProductUrl('https://www.myntra.com/shirts/12345678/buy'), true);
  assert.equal(isMarketplaceProductUrl('https://www.myntra.com/shirts'), false);
});
