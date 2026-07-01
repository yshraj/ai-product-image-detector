// test/unit/clean-query.test.cjs — cleanQueryFromProduct on real messy titles
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanQueryFromProduct } = require('../../utils/product-query.js');

const MESSY_TITLES = [
  {
    title: 'Nike Men\'s Air Max 2026 Running Shoes, Black, Size 9, Pack of 1',
    attributes: { brand: 'Nike', color: 'black' },
    expect: ['nike', 'air', 'max', '2026', 'running', 'shoes', 'black'],
    maxLen: 60,
    minLen: 12,
  },
  {
    title: 'Roadster Men Blue Cotton T-Shirt Regular Fit (M) | Best Seller',
    attributes: { brand: 'Roadster' },
    expect: ['roadster', 'blue', 'cotton', 'shirt', 'regular', 'fit'],
    maxLen: 55,
    minLen: 10,
  },
  {
    title: 'Samsung Galaxy M14 5G (Sapphire Blue, 4GB, 128GB Storage) | Free Shipping',
    attributes: { brand: 'Samsung', color: 'blue' },
    expect: ['samsung', 'galaxy', 'm14', '5g', 'blue'],
    maxLen: 55,
    minLen: 10,
  },
  {
    title: 'Puma Unisex Running Shoes - White/Grey, UK 8, 100% Genuine',
    attributes: { brand: 'Puma' },
    expect: ['puma', 'running', 'shoes', 'white', 'grey'],
    maxLen: 50,
    minLen: 10,
  },
  {
    title: 'Allen Solly Men\'s Slim Fit Formal Shirt, Navy Blue, Size 40',
    attributes: { brand: 'Allen Solly', color: 'navy' },
    expect: ['allen', 'solly', 'slim', 'fit', 'formal', 'shirt'],
    maxLen: 55,
    minLen: 10,
  },
  {
    title: 'boAt Rockerz 450 Bluetooth On Ear Headphones with Mic (Luscious Black)',
    attributes: { brand: 'boAt' },
    expect: ['boat', 'rockerz', '450', 'bluetooth', 'ear', 'headphones'],
    maxLen: 60,
    minLen: 12,
  },
  {
    title: 'Levi\'s 511 Slim Fit Men\'s Jeans - Dark Blue - Waist 32',
    attributes: { brand: "Levi's" },
    expect: ['levi', '511', 'slim', 'fit', 'jeans', 'dark', 'blue'],
    maxLen: 50,
    minLen: 10,
  },
  {
    title: 'Mamaearth Vitamin C Face Wash with Vitamin C and Turmeric for Skin Illumination - 100 ml',
    attributes: { brand: 'Mamaearth' },
    expect: ['mamaearth', 'vitamin', 'face', 'wash', 'turmeric', 'skin'],
    maxLen: 65,
    minLen: 12,
  },
  {
    title: 'Bata Men COMFIT Formal Derby Shoes For Men (Black, 9)',
    attributes: { brand: 'Bata', color: 'black' },
    expect: ['bata', 'comfit', 'formal', 'derby', 'shoes', 'black'],
    maxLen: 50,
    minLen: 10,
  },
  {
    title: 'HP 15s Ryzen 5 Laptop 16GB RAM 512GB SSD Windows 11 Home',
    attributes: { brand: 'HP', model: '15s' },
    expect: ['hp', '15s', 'ryzen', 'laptop', '16gb', '512gb'],
    maxLen: 60,
    minLen: 12,
  },
];

for (const [i, case_] of MESSY_TITLES.entries()) {
  test(`cleanQueryFromProduct #${i + 1}: ${case_.title.slice(0, 40)}…`, () => {
    const q = cleanQueryFromProduct(case_.title, case_.attributes);
    const lower = q.toLowerCase();
    assert.ok(q.length >= case_.minLen, `too short: "${q}"`);
    assert.ok(q.length <= case_.maxLen, `too long: "${q}"`);
    assert.ok(q.length < case_.title.length, 'should be shorter than full title');
    for (const word of case_.expect) {
      assert.ok(lower.includes(word), `missing "${word}" in "${q}"`);
    }
  });
}

test('cleanQueryFromProduct output length is reasonable across messy titles', () => {
  for (const case_ of MESSY_TITLES) {
    const q = cleanQueryFromProduct(case_.title, case_.attributes);
    const words = q.split(/\s+/).filter(Boolean);
    assert.ok(words.length >= 3 && words.length <= 8, `word count for "${q}"`);
    assert.ok(q.length >= 10 && q.length <= 70, `char length for "${q}"`);
    assert.ok(q.length < case_.title.length * 0.85, `not shortened enough: "${q}"`);
  }
});

test('cleanQueryFromProduct rejects empty noise-only input gracefully', () => {
  const q = cleanQueryFromProduct('Buy Online India Free Shipping', {});
  assert.ok(q.length <= 40);
});
