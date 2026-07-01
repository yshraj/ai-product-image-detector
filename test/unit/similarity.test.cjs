// test/unit/similarity.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Similarity = require('../../compare/similarity.js');
const ScoreConfig = require('../../compare/score-config.js');

test('score config exposes attribute-based weight constants', () => {
  assert.equal(ScoreConfig.BRAND_WEIGHT, 0.25);
  assert.equal(ScoreConfig.TITLE_WEIGHT, 0.20);
  assert.equal(ScoreConfig.COLOR_WEIGHT, 0.15);
  assert.equal(ScoreConfig.IMAGE_WEIGHT, 0.10);
  assert.equal(ScoreConfig.BRAND_MISMATCH_CAP, 0.45);
  assert.equal(ScoreConfig.COLOR_MISMATCH_PENALTY, 0.20);
});

test('textSimilarity ranks related titles higher than unrelated', () => {
  const query = 'roadster men blue cotton t shirt';
  const related = 'Roadster Men Blue Cotton T-Shirt Regular Fit';
  const unrelated = 'Samsung Galaxy M14 5G Smartphone Blue';
  assert.ok(Similarity.textSimilarity(query, related) > Similarity.textSimilarity(query, unrelated));
});

test('scoreCandidateMatch caps score when brand mismatches', () => {
  const source = { title: 'Rare Rabbit Men Pink Solid Shirt', brand: 'Rare Rabbit', color: 'pink' };
  const candidate = { title: 'Nike Men Pink Solid Shirt', price: '₹999' };
  const scored = Similarity.scoreCandidateMatch(source, candidate, 0.9);
  assert.ok(scored.finalScore <= ScoreConfig.BRAND_MISMATCH_CAP + 0.001);
  assert.equal(scored.breakdown.brandCapApplied, true);
});

test('scoreCandidateMatch penalizes color mismatch', () => {
  const source = { title: 'Rare Rabbit Men Pink Solid Shirt', brand: 'Rare Rabbit', color: 'pink' };
  const sameColor = { title: 'Rare Rabbit Men Pink Solid Shirt', price: '₹999' };
  const diffColor = { title: 'Rare Rabbit Men Brown Solid Shirt', price: '₹999' };
  const good = Similarity.scoreCandidateMatch(source, sameColor, 0);
  const bad = Similarity.scoreCandidateMatch(source, diffColor, 0);
  assert.ok(good.finalScore > bad.finalScore);
  assert.ok(bad.penalties.some((p) => p.type === 'color'));
});

test('scoreCandidateMatch prefers same brand over similar title', () => {
  const source = { title: 'Allen Solly Men Solid Polo T-Shirt', brand: 'Allen Solly' };
  const match = { title: 'Allen Solly Men Solid Polo T-Shirt Blue', price: '₹799' };
  const generic = { title: 'Generic Cotton Polo Shirt Blue', price: '₹399' };
  const a = Similarity.scoreCandidateMatch(source, match, 0);
  const b = Similarity.scoreCandidateMatch(source, generic, 0);
  assert.ok(a.finalScore > b.finalScore);
});

test('cosineSimilarity returns 1 for identical vectors', () => {
  const v = [0.2, 0.5, -0.1, 0.9];
  assert.ok(Math.abs(Similarity.cosineSimilarity(v, v) - 1) < 0.001);
});

test('dedupCandidates keeps one item per near-duplicate cluster', () => {
  const candidates = [
    { title: 'Nike Air Max Black Shoes', url: 'https://a/1', image: 'https://img/1', finalScore: 0.95 },
    { title: 'Nike Air Max Black Shoes', url: 'https://a/2', image: 'https://img/1', finalScore: 0.9 },
    { title: 'Puma Running Shoes White', url: 'https://b/1', image: 'https://img/2', finalScore: 0.8 },
  ];
  const deduped = Similarity.dedupCandidates(candidates, 0.9);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].url, 'https://a/1');
});

test('scoreCandidateMatch penalizes textured vs solid pattern', () => {
  const source = { title: 'Snitch Textured Slim Fit Pure Cotton Casual Shirt', brand: 'Snitch' };
  const textured = { title: 'Snitch Men Textured Slim Fit Cotton Casual Shirt', price: '₹899' };
  const solid = { title: 'Snitch Men Solid Formal White Shirt', price: '₹499' };
  const a = Similarity.scoreCandidateMatch(source, textured, 0);
  const b = Similarity.scoreCandidateMatch(source, solid, 0);
  assert.ok(a.finalScore > b.finalScore);
  assert.equal(b.breakdown.pattern.ok, false);
});

test('breakdown color is unknown when source has no color', () => {
  const source = { title: 'Snitch Textured Slim Fit Shirt', brand: 'Snitch' };
  const candidate = { title: 'Snitch Men Solid White Shirt', price: '₹499' };
  const scored = Similarity.scoreCandidateMatch(source, candidate, 0);
  assert.equal(scored.breakdown.color.ok, null);
});

test('rankCandidates assigns breakdown and finalScore', () => {
  const ranked = Similarity.rankCandidates(
    { title: 'Roadster Blue Cotton Shirt', brand: 'Roadster', color: 'blue' },
    [{ title: 'Roadster Blue Cotton Shirt Regular', url: 'https://x', price: '₹499' }],
  );
  assert.ok(ranked[0].finalScore > 0);
  assert.ok(ranked[0].breakdown);
  assert.ok(ranked[0].breakdown.brand);
});
