// test/unit/product-matcher.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scoreMatch, pickBest } = require('../../utils/product-matcher.js');

const source = {
  title: 'Roadster Men Blue Cotton T-Shirt',
  brand: 'Roadster',
  price: '₹499',
};

test('scoreMatch returns high score for near-identical title', () => {
  const r = scoreMatch(source, {
    title: 'Roadster Men Blue Cotton T-Shirt Regular Fit',
    price: '₹499',
  });
  assert.ok(r.score >= 85);
  assert.equal(r.label, 'same');
});

test('scoreMatch returns lower score for unrelated product', () => {
  const r = scoreMatch(source, {
    title: 'Samsung Galaxy M14 5G Smartphone',
    price: '₹12,999',
  });
  assert.ok(r.score < 50);
});

test('pickBest filters below minimum match threshold', () => {
  const best = pickBest(source, [
    { title: 'Unrelated Shoes', price: '₹999' },
    { title: 'Roadster Men Blue Cotton T-Shirt', price: '₹519' },
  ], 40);
  assert.match(best.title, /Blue Cotton T-Shirt/i);
});

test('pickBest returns null when all candidates below threshold', () => {
  const best = pickBest(source, [
    { title: 'Samsung Galaxy M14 5G Smartphone', price: '₹12,999' },
  ], 40);
  assert.equal(best, null);
});

test('pickBest infers brand from title when source brand is missing', () => {
  const src = { title: "Allen Solly Men's Solid Polo T-Shirt", price: '₹799' };
  const best = pickBest(src, [
    { title: 'Generic Cotton Polo Shirt', price: '₹399' },
    { title: 'Allen Solly Men Solid Polo T-Shirt', price: '₹849' },
  ]);
  assert.ok(best);
  assert.match(best.title, /Allen Solly/i);
});

test('colorMatch prefers same-color variant over different color', () => {
  const mismatch = scoreMatch(
    { title: 'Nike Air Max White', brand: 'Nike', price: '₹4,999', color: 'white' },
    { title: 'Nike Air Max Black Running Shoes', price: '₹4,999' },
  );
  const match = scoreMatch(
    { title: 'Nike Air Max White', brand: 'Nike', price: '₹4,999', color: 'white' },
    { title: 'Nike Air Max White Running Shoes', price: '₹4,999' },
  );
  assert.ok(match.score > mismatch.score);
});
