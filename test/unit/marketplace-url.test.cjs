// test/unit/marketplace-url.test.cjs — listing vs product URL guards.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isMarketplaceProductUrl, isSupportedMarketplaceUrl } = require('../../utils/marketplace-url.js');

test('isMarketplaceProductUrl rejects category/listing pages', () => {
  assert.equal(isMarketplaceProductUrl('https://www.myntra.com/men-shirts'), false);
  assert.equal(isMarketplaceProductUrl('https://www.flipkart.com/search?q=shirt'), false);
  assert.equal(isMarketplaceProductUrl('https://www.meesho.com/search?q=shirt'), false);
});

test('isMarketplaceProductUrl accepts product pages', () => {
  assert.equal(isMarketplaceProductUrl('https://www.meesho.com/product/p123'), true);
  assert.equal(isMarketplaceProductUrl('https://www.nykaa.com/p/12345'), true);
});

test('isSupportedMarketplaceUrl accepts supported hosts', () => {
  assert.equal(isSupportedMarketplaceUrl('https://www.myntra.com/men-shirts'), true);
  assert.equal(isSupportedMarketplaceUrl('https://www.flipkart.com/search?q=x'), true);
  assert.equal(isSupportedMarketplaceUrl('https://www.aliexpress.com/wholesale?SearchText=x'), true);
  assert.equal(isSupportedMarketplaceUrl('https://www.temu.com/search_result.html'), true);
  assert.equal(isSupportedMarketplaceUrl('https://www.shein.com/pdsearch/dress'), true);
  assert.equal(isSupportedMarketplaceUrl('https://www.amazon.in/dp/B123'), true);
  assert.equal(isSupportedMarketplaceUrl('https://www.amazon.com/dp/B123'), true);
  assert.equal(isSupportedMarketplaceUrl('https://www.amazon.co.uk/s?k=x'), true);
  assert.equal(isSupportedMarketplaceUrl('https://example.com/'), false);
});

test('isMarketplaceProductUrl accepts global product pages', () => {
  assert.equal(isMarketplaceProductUrl('https://www.amazon.com/dp/B0123'), true);
  assert.equal(isMarketplaceProductUrl('https://www.amazon.co.uk/gp/product/B0123'), true);
  assert.equal(isMarketplaceProductUrl('https://www.aliexpress.com/item/100500.html'), true);
  assert.equal(isMarketplaceProductUrl('https://www.amazon.com/s?k=shirt'), false);
});
