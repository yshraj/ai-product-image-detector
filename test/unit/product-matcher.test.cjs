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

test('pickBest chooses highest scoring candidate', () => {
  const best = pickBest(source, [
    { title: 'Random Jeans', price: '₹999' },
    { title: 'Roadster Men Blue Cotton T-Shirt', price: '₹519' },
    { title: 'Roadster Blue Shirt', price: '₹450' },
  ]);
  assert.match(best.title, /Blue Cotton T-Shirt/i);
  assert.ok(best.match.score >= 70);
});
