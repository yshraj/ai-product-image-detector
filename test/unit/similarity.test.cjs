// test/unit/similarity.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Similarity = require('../../compare/similarity.js');
const ScoreConfig = require('../../compare/score-config.js');

test('score config exposes named weight constants', () => {
  assert.equal(ScoreConfig.IMAGE_WEIGHT, 0.55);
  assert.equal(ScoreConfig.TEXT_WEIGHT, 0.45);
  assert.equal(ScoreConfig.MIN_FALLBACK_SCORE, 0.06);
  assert.equal(Similarity.IMAGE_WEIGHT, 0.55);
  assert.equal(Similarity.TEXT_WEIGHT, 0.45);
});

test('textSimilarity ranks related titles higher than unrelated', () => {
  const query = 'roadster men blue cotton t shirt';
  const related = 'Roadster Men Blue Cotton T-Shirt Regular Fit';
  const unrelated = 'Samsung Galaxy M14 5G Smartphone Blue';
  assert.ok(Similarity.textSimilarity(query, related) > Similarity.textSimilarity(query, unrelated));
});

test('combinedScore uses IMAGE_WEIGHT and TEXT_WEIGHT', () => {
  const score = Similarity.combinedScore(1, 0);
  assert.ok(Math.abs(score - ScoreConfig.IMAGE_WEIGHT) < 0.001);
  const score2 = Similarity.combinedScore(0, 1);
  assert.ok(Math.abs(score2 - ScoreConfig.TEXT_WEIGHT) < 0.001);
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

test('rankCandidates assigns finalScore from text when no image scores', () => {
  const ranked = Similarity.rankCandidates(
    'roadster blue shirt',
    [{ title: 'Roadster Blue Cotton Shirt', url: 'https://x' }],
  );
  assert.ok(ranked[0].textScore > 0.3);
  assert.ok(ranked[0].finalScore > 0);
});
