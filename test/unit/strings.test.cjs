// test/unit/strings.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../utils/strings.js');

test('strings module exposes the feature namespaces', () => {
  for (const k of ['badge', 'summary', 'notify', 'details', 'history']) {
    assert.ok(S[k], `missing strings.${k}`);
  }
});

test('summary.result formats count + percentage', () => {
  assert.equal(S.summary.result(3, 12), '3 of 12 look AI (25%)');
  assert.equal(S.summary.result(0, 0), '0 of 0 look AI');
});

test('badge.title pluralises and falls back', () => {
  assert.match(S.badge.title(1, 1), /1 of 1 image look AI/);
  assert.match(S.badge.title(2, 5), /2 of 5 images look AI/);
  assert.equal(S.badge.title(0, 0), 'TrueKart');
});

test('notify.body pluralises', () => {
  assert.match(S.notify.body(1), /1 AI-looking image /);
  assert.match(S.notify.body(3), /3 AI-looking images /);
});
