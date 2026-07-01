// test/unit/service-worker-compare.test.cjs — guard compare module wiring in the service worker.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SW = fs.readFileSync(path.join(__dirname, '../../background/service-worker.js'), 'utf8');

test('service worker loads similarity modules before compare search', () => {
  const scoreIdx = SW.indexOf("'../compare/score-config.js'");
  const attrIdx = SW.indexOf("'../compare/attribute-parser.js'");
  const simIdx = SW.indexOf("'../compare/similarity.js'");
  const searchIdx = SW.indexOf("'../compare/search.js'");
  assert.ok(scoreIdx > 0 && attrIdx > 0 && simIdx > 0 && searchIdx > 0, 'expected compare imports in service worker');
  assert.ok(scoreIdx < searchIdx, 'score-config must load before search.js');
  assert.ok(attrIdx < simIdx, 'attribute-parser must load before similarity.js');
  assert.ok(simIdx < searchIdx, 'similarity must load before search.js');
});
