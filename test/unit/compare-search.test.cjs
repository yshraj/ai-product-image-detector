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

  const result = await searchAll(product, ['amazon', 'flipkart'], { fetchFn: mockFetch });
  assert.equal(result.ok, true);
  assert.ok(result.ranked.length >= 1, 'expected cross-platform ranked results');
  assert.ok(result.ranked[0].match.score >= 20);
  assert.ok(result.matches.length >= 1);
});

test('searchAll ranked list is capped at top 10 cross-platform', async () => {
  const Similarity = require('../../compare/similarity.js');
  const many = Array.from({ length: 15 }, (_, i) => ({
    site: i % 2 ? 'amazon' : 'flipkart',
    ok: true,
    candidates: [{ title: `Roadster Blue Shirt Variant ${i}`, price: '₹499', url: `https://x/${i}`, image: '' }],
  }));
  const ranked = await require('../../compare/search.js').rankCrossPlatform(
    { title: 'Roadster Men Blue Cotton T-Shirt', brand: 'Roadster' },
    many,
    { similarity: Similarity },
  );
  assert.ok(ranked.length <= 10);
});

test('rankCrossPlatform surfaces brand match when source brand is missing', async () => {
  const Similarity = require('../../compare/similarity.js');
  const { rankCrossPlatform } = require('../../compare/search.js');
  const product = { title: "Allen Solly Men's Solid Polo T-Shirt", price: '₹799' };
  const siteResults = [{
    site: 'flipkart',
    ok: true,
    candidates: [
      { title: 'Allen Solly Men Solid Polo T-Shirt', price: '₹849', url: 'https://fk/1', image: '' },
      { title: 'Generic Cotton Polo Shirt', price: '₹399', url: 'https://fk/2', image: '' },
    ],
  }];
  const ranked = await rankCrossPlatform(product, siteResults, { similarity: Similarity });
  assert.ok(ranked.length >= 1, 'expected ranked match for Allen Solly polo');
  assert.match(ranked[0].title, /Allen Solly/i);
});

test('rankCrossPlatform fallback returns best candidate when none pass strict threshold', async () => {
  const Similarity = require('../../compare/similarity.js');
  const { rankCrossPlatform } = require('../../compare/search.js');
  const product = { title: 'Obscure Brand Widget X200', brand: 'Obscure' };
  const siteResults = [{
    site: 'amazon',
    ok: true,
    candidates: [
      { title: 'Obscure Widget X200 Replacement Part', price: '₹999', url: 'https://a/1', image: '' },
    ],
  }];
  const ranked = await rankCrossPlatform(product, siteResults, {
    similarity: Similarity,
    minFinalScore: 0.99,
    minFallbackScore: 0.01,
  });
  assert.equal(ranked.length, 1);
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

test('searchAll uses tab scrape for Nykaa when fetch returns 403', async () => {
  const amazonHtml = fs.readFileSync(path.join(FIXTURES, 'amazon-search.html'), 'utf8');
  const nykaaItems = [{ title: 'Maybelline Lipstick', price: '₹549', url: 'https://www.nykaa.com/x/p/12345', image: '' }];

  const mockFetch = async (url) => {
    if (url.includes('nykaa.com')) throw new Error('HTTP 403');
    if (url.includes('amazon.in')) return amazonHtml;
    return '<html></html>';
  };
  const mockTabFetch = async (url, site) => (site === 'nykaa' ? nykaaItems : []);

  const product = {
    site: 'myntra',
    title: 'Maybelline Fit Me Foundation',
    brand: 'Maybelline',
    price: '₹549',
  };

  const result = await searchAll(product, ['amazon', 'nykaa'], {
    fetchFn: mockFetch,
    tabFetchFn: mockTabFetch,
  });
  const nykaa = result.results.find((r) => r.site === 'nykaa');
  assert.ok(nykaa?.ok, nykaa?.error || 'nykaa should succeed via tab scrape');
  assert.ok((nykaa?.candidates?.length || 0) >= 1);
});

test('parseSearchResults extracts Nykaa products from fixture HTML', () => {
  const html = fs.readFileSync(path.join(FIXTURES, 'nykaa-search.html'), 'utf8');
  const items = parseSearchResults('nykaa', html, 'https://www.nykaa.com');
  assert.ok(items.length >= 1);
  assert.match(items[0].title, /Maybelline/i);
  assert.match(items[0].url, /\/p\/\d+/);
});

test('rankCrossPlatform limits results per site', async () => {
  const Similarity = require('../../compare/similarity.js');
  const { rankCrossPlatform } = require('../../compare/search.js');
  const product = { title: 'Roadster Men Blue Cotton T-Shirt', brand: 'Roadster' };
  const siteResults = [{
    site: 'nykaa',
    ok: true,
    candidates: [
      { title: 'Roadster Men Blue Cotton T-Shirt', price: '₹499', url: 'https://nykaa.com/a/p/1', image: '' },
      { title: 'Roadster Men Blue Cotton T-Shirt Regular', price: '₹519', url: 'https://nykaa.com/b/p/2', image: '' },
      { title: 'Roadster Men Blue Cotton T-Shirt Slim', price: '₹529', url: 'https://nykaa.com/c/p/3', image: '' },
    ],
  }];
  const ranked = await rankCrossPlatform(product, siteResults, { similarity: Similarity, maxPerSite: 2 });
  assert.ok(ranked.length <= 2);
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
