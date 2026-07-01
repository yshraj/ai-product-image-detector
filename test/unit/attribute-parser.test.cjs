// test/unit/attribute-parser.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseAttributes,
  normalizeColor,
  colorsMatch,
  attributeQueryTokens,
} = require('../../compare/attribute-parser.js');

test('parseAttributes extracts brand, color, pattern, fit from fashion title', () => {
  const attrs = parseAttributes({
    title: 'Rare Rabbit Men Regular Fit Solid Casual Pink Shirt',
    brand: 'Rare Rabbit',
  });
  assert.equal(attrs.brand, 'Rare Rabbit');
  assert.equal(attrs.color, 'pink');
  assert.equal(attrs.pattern, 'solid');
  assert.equal(attrs.fit, 'regular');
  assert.equal(attrs.gender, 'men');
  assert.match(attrs.category, /shirt/i);
});

test('normalizeColor maps pink synonyms to pink', () => {
  assert.equal(normalizeColor('rose pink'), 'pink');
  assert.equal(normalizeColor('dusty pink'), 'pink');
  assert.equal(normalizeColor('blush'), 'pink');
});

test('colorsMatch treats pink variants as equal', () => {
  assert.equal(colorsMatch('rose pink', 'pink'), true);
  assert.equal(colorsMatch('dusty pink', 'blush'), true);
  assert.equal(colorsMatch('pink', 'brown'), false);
});

test('attributeQueryTokens prioritizes brand color pattern fit', () => {
  const attrs = parseAttributes({
    title: 'Roadster Men Blue Cotton Regular Fit Solid T-Shirt',
    brand: 'Roadster',
    color: 'blue',
  });
  const tokens = attributeQueryTokens(attrs);
  assert.ok(tokens.includes('roadster'));
  assert.ok(tokens.includes('blue'));
  assert.ok(tokens.some((t) => t.includes('solid') || t === 'solid'));
});

test('normalizedTitle strips marketing noise', () => {
  const attrs = parseAttributes({
    title: 'RARE RABBIT Men Regular Fit Solid Casual Shirt For Men Premium Collection',
    brand: 'Rare Rabbit',
    color: 'pink',
  });
  assert.ok(!attrs.normalizedTitle.includes('premium'));
  assert.ok(!attrs.normalizedTitle.includes('collection'));
  assert.ok(!attrs.normalizedTitle.includes('casual'));
});
