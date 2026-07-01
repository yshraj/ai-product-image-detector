// test/unit/compare-search.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSearchResults } = require('../../compare/parsers.js');
const { searchAll } = require('../../compare/search.js');
const fs = require('fs');
const path = require('path');

const FIXTURES = path.join(__dirname, '../fixtures');

test('parseSearchResults extracts Amazon products from fixture HTML', () => {
  const html = fs.readFileSync(path.join(FIXTURES, 'amazon-search.html'), 'utf8');
  const items = parseSearchResults('amazon', html, 'https://www.amazon.in');
  assert.ok(items.length >= 2);
  assert.match(items[0].title, /Roadster/i);
  assert.ok(items[0].url.includes('/dp/'));
});

test('parseSearchResults extracts Flipkart products from fixture HTML', () => {
  const html = fs.readFileSync(path.join(FIXTURES, 'flipkart-search.html'), 'utf8');
  const items = parseSearchResults('flipkart', html, 'https://www.flipkart.com');
  assert.ok(items.length >= 1);
  assert.ok(items[0].title.length > 5);
});

test('searchAll ranks matches using mocked fetch', async () => {
  const amazonHtml = fs.readFileSync(path.join(FIXTURES, 'amazon-search.html'), 'utf8');
  const flipkartHtml = fs.readFileSync(path.join(FIXTURES, 'flipkart-search.html'), 'utf8');

  const mockFetch = async (url) => {
    if (url.includes('amazon.in')) return amazonHtml;
    if (url.includes('flipkart.com')) return flipkartHtml;
    return '<html></html>';
  };

  const product = {
    site: 'myntra',
    title: 'Roadster Men Blue Cotton T-Shirt',
    brand: 'Roadster',
    price: '₹499',
  };

  const result = await searchAll(product, ['amazon', 'flipkart'], mockFetch);
  assert.equal(result.ok, true);
  assert.ok(result.matches.length >= 1);
  assert.ok(result.matches[0].best.match.score >= 50);
});

test('searchAll runs marketplace fetches in parallel', async () => {
  const amazonHtml = fs.readFileSync(path.join(FIXTURES, 'amazon-search.html'), 'utf8');
  const flipkartHtml = fs.readFileSync(path.join(FIXTURES, 'flipkart-search.html'), 'utf8');
  let concurrent = 0;
  let maxConcurrent = 0;

  const mockFetch = async (url) => {
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise((r) => setTimeout(r, 40));
    concurrent--;
    if (url.includes('amazon.in')) return amazonHtml;
    if (url.includes('flipkart.com')) return flipkartHtml;
    return '<html></html>';
  };

  const product = {
    site: 'myntra',
    title: 'Roadster Men Blue Cotton T-Shirt',
    brand: 'Roadster',
    price: '₹499',
    color: 'blue',
  };

  const result = await searchAll(product, ['amazon', 'flipkart', 'nykaa'], { fetchFn: mockFetch });
  assert.equal(result.ok, true);
  assert.ok(maxConcurrent >= 2, `expected parallel fetches, got maxConcurrent=${maxConcurrent}`);
});

test('buildSearchQuery includes color for color-aware compare', async () => {
  const { buildSearchQuery } = require('../../utils/product-query.js');
  const q = buildSearchQuery({
    title: 'Roadster Men Blue Cotton T-Shirt',
    brand: 'Roadster',
    color: 'blue',
  });
  assert.match(q, /blue/i);
});
