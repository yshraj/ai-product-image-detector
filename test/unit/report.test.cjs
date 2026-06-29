// test/unit/report.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../utils/report.js');

const report = {
  site: 'myntra',
  pageUrl: 'https://www.myntra.com/men-shirts',
  products: [
    { name: 'RARE RABBIT Shirt', price: '₹1,799', verdict: 'ai', confidence: 97, engine: 'huggingface', model: 'haywoodsloan/ai-image-detector-deploy', imageUrl: 'https://x/a.jpg' },
    { name: 'Plain, "quoted"\nproduct', price: null, verdict: 'real', confidence: 12, engine: 'preview', model: '', imageUrl: 'https://x/b.jpg' },
  ],
};

test('buildCsv emits a header + one row per product', () => {
  const lines = R.buildCsv(report).split('\r\n');
  assert.equal(lines[0], 'name,price,verdict,confidence,engine,model,imageUrl,site,pageUrl');
  assert.equal(lines.length, 3); // header + 2 products
  // price "₹1,799" has a comma so it is quoted; verdict/confidence/engine follow.
  assert.match(lines[1], /^RARE RABBIT Shirt,"₹1,799",ai,97,huggingface,/);
});

test('csvEscape quotes commas, quotes and newlines', () => {
  assert.equal(R.csvEscape('plain'), 'plain');
  assert.equal(R.csvEscape('a,b'), '"a,b"');
  assert.equal(R.csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(R.csvEscape('line1\nline2'), '"line1\nline2"');
  assert.equal(R.csvEscape(null), '');
});

test('buildCsv escapes a product name with comma/quote/newline', () => {
  const row = R.buildCsv(report).split('\r\n')[2];
  assert.ok(row.includes('"Plain, ""quoted""\nproduct"'), 'name field is CSV-escaped');
});

test('buildJson round-trips the report', () => {
  const parsed = JSON.parse(R.buildJson(report));
  assert.equal(parsed.products.length, 2);
  assert.equal(parsed.site, 'myntra');
});
