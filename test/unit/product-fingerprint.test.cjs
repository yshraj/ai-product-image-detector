const { test } = require('node:test');
const assert = require('node:assert/strict');
const { productFingerprint, extractProductId } = require('../../utils/product-fingerprint.js');

test('extractProductId reads Flipkart and Myntra IDs from URLs', () => {
  assert.equal(
    extractProductId('https://www.flipkart.com/foo/p/itmABC123', 'flipkart'),
    'itmABC123',
  );
  assert.equal(
    extractProductId('https://www.flipkart.com/foo/p/itmABC123?pid=SHIRT999', 'flipkart'),
    'SHIRT999',
  );
  assert.equal(
    extractProductId('https://www.myntra.com/shirts/roadster/1234567/buy', 'myntra'),
    '1234567',
  );
});

test('productFingerprint is stable for same product and differs across products', () => {
  const a = productFingerprint({
    site: 'myntra',
    url: 'https://www.myntra.com/shirts/roadster/1234567/buy',
    title: 'Roadster Blue Shirt',
    image: 'https://assets.myntassets.com/a.jpg',
  });
  const a2 = productFingerprint({
    site: 'myntra',
    url: 'https://www.myntra.com/shirts/roadster/1234567/buy',
    title: 'Roadster Blue Shirt (size M)',
    image: 'https://assets.myntassets.com/a.jpg',
  });
  const b = productFingerprint({
    site: 'myntra',
    url: 'https://www.myntra.com/shirts/highlander/7654321/buy',
    title: 'Highlander Shirt',
    image: 'https://assets.myntassets.com/b.jpg',
  });
  assert.equal(a, a2);
  assert.notEqual(a, b);
});
