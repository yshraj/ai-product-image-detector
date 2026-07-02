// test/unit/marketplace-url.test.cjs — listing vs product URL guards.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isMarketplaceProductUrl, isSafeCompareUrl } = require('../../utils/marketplace-url.js');

test('isMarketplaceProductUrl rejects category/listing pages', () => {
  assert.equal(isMarketplaceProductUrl('https://www.myntra.com/men-shirts'), false);
  assert.equal(isMarketplaceProductUrl('https://www.flipkart.com/search?q=shirt'), false);
  assert.equal(isMarketplaceProductUrl('https://www.meesho.com/search?q=shirt'), false);
});

test('isMarketplaceProductUrl accepts product pages', () => {
  assert.equal(isMarketplaceProductUrl('https://www.meesho.com/product/p123'), true);
  assert.equal(isMarketplaceProductUrl('https://www.nykaa.com/p/12345'), true);
});

test('isSafeCompareUrl allows marketplace product links', () => {
  assert.equal(isSafeCompareUrl('https://www.flipkart.com/p/x'), true);
  assert.equal(isSafeCompareUrl('https://www.amazon.in/dp/B123'), true);
});

test('isSafeCompareUrl blocks javascript and non-marketplace hosts', () => {
  assert.equal(isSafeCompareUrl('javascript:alert(1)'), false);
  assert.equal(isSafeCompareUrl('http://www.flipkart.com/p/x'), false);
  assert.equal(isSafeCompareUrl('https://evil.example/p/x'), false);
});

test('isSafeCompareUrl allows CDN image hosts when images=true', () => {
  assert.equal(isSafeCompareUrl('https://assets.myntassets.com/h.jpg', { images: true }), true);
  assert.equal(isSafeCompareUrl('https://assets.myntassets.com/h.jpg'), false);
});
