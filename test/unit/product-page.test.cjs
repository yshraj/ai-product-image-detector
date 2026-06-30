// test/unit/product-page.test.cjs — product URL detection (mirrors popup helpers).
const { test } = require('node:test');
const assert = require('node:assert/strict');

function isMarketplaceProductUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'flipkart.com') return /\/p\//.test(u.pathname);
    if (host === 'myntra.com') return /\/buy$/.test(u.pathname) || /\d{6,}/.test(u.pathname);
    if (host === 'meesho.com') return /\/product\//.test(u.pathname);
    if (host.includes('nykaa.com')) return /\/p\//.test(u.pathname);
  } catch { /* ignore */ }
  return false;
}

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
