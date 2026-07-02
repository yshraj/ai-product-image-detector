// test/unit/service-worker-compare.test.cjs — compare feature removed from shipped extension.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SW = fs.readFileSync(path.join(__dirname, '../../background/service-worker.js'), 'utf8');

test('service worker does not wire compare search', () => {
  assert.equal(SW.includes("'../compare/search.js'"), false, 'compare/search.js must not be imported');
  assert.equal(SW.includes('RMF_COMPARE_SEARCH'), false, 'compare message handler must be removed');
  assert.equal(SW.includes('handleCompareSearch'), false, 'handleCompareSearch must be removed');
});
