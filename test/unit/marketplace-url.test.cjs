// test/unit/marketplace-url.test.cjs — listing vs product URL guards.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isMarketplaceProductUrl } = require('../../utils/marketplace-url.js');

test('isMarketplaceProductUrl rejects category/listing pages', () => {
  assert.equal(isMarketplaceProductUrl('https://www.myntra.com/men-shirts'), false);
  assert.equal(isMarketplaceProductUrl('https://www.flipkart.com/search?q=shirt'), false);
  assert.equal(isMarketplaceProductUrl('https://www.meesho.com/search?q=shirt'), false);
});

test('isMarketplaceProductUrl accepts product pages', () => {
  assert.equal(isMarketplaceProductUrl('https://www.meesho.com/product/p123'), true);
  assert.equal(isMarketplaceProductUrl('https://www.nykaa.com/p/12345'), true);
});
