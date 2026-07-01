// test/unit/product-query.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSearchQuery, normalizeTitle, tokenize, parsePrice, extractColorFromProduct, inferBrandFromTitle } =
  require('../../utils/product-query.js');

test('normalizeTitle strips parens and extra whitespace', () => {
  assert.equal(normalizeTitle('Nike Shoes (Blue)  |  Men'), 'Nike Shoes Men');
});

test('buildSearchQuery prioritizes brand and drops noise', () => {
  const q = buildSearchQuery({
    title: 'Men Blue Cotton T-Shirt Regular Fit (M)',
    brand: 'Roadster',
  });
  assert.match(q, /roadster/i);
  assert.match(q, /blue/i);
  assert.doesNotMatch(q, /\bmen\b/i);
});

test('extractColorFromProduct reads color from title and parentheses', () => {
  assert.equal(extractColorFromProduct({ title: 'Nike Shoes (Blue)' }), 'blue');
  assert.equal(extractColorFromProduct({ title: 'Roadster Men Black Cotton T-Shirt' }), 'black');
  assert.equal(extractColorFromProduct({ title: 'Generic Product', color: 'navy' }), 'navy');
});

test('parsePrice extracts INR amounts', () => {
  assert.equal(parsePrice('₹1,299'), 1299);
  assert.equal(parsePrice('Rs. 499'), 499);
  assert.equal(parsePrice('no price'), null);
});

test('inferBrandFromTitle reads leading brand tokens before category words', () => {
  assert.equal(inferBrandFromTitle("Allen Solly Men's Solid Polo T-Shirt"), 'Allen Solly');
  assert.equal(inferBrandFromTitle('Van Heusen Men Regular Fit Shirt'), 'Van Heusen');
});

test('buildSearchQuery infers brand when metadata missing', () => {
  const q = buildSearchQuery({ title: "Allen Solly Men's Blue Polo T-Shirt" });
  assert.match(q, /allen/i);
  assert.match(q, /solly/i);
});

test('tokenize removes stop words', () => {
  const tokens = tokenize('Buy Online Best Nike Air Max Shoes');
  assert.ok(tokens.includes('nike'));
  assert.ok(!tokens.includes('buy'));
});
