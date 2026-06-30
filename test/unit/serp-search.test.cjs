// test/unit/serp-search.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { siteFromUrl, DOMAIN_TO_SITE } = require('../../compare/serp-search.js');

test('siteFromUrl maps Indian marketplace domains', () => {
  assert.equal(siteFromUrl('https://www.flipkart.com/p/itm123'), 'flipkart');
  assert.equal(siteFromUrl('https://www.amazon.in/dp/B00'), 'amazon');
  assert.equal(siteFromUrl('https://example.com/x'), null);
});

test('DOMAIN_TO_SITE includes primary hosts', () => {
  assert.ok(DOMAIN_TO_SITE['www.myntra.com']);
  assert.ok(DOMAIN_TO_SITE['www.meesho.com']);
  assert.ok(DOMAIN_TO_SITE['www.nykaa.com']);
});
