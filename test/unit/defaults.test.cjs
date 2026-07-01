// test/unit/defaults.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const defaults = require('../../utils/defaults.js');

test('SYNC_DEFAULTS includes compare and notification keys', () => {
  assert.equal(defaults.SYNC_DEFAULTS.enabled, true);
  assert.equal(defaults.SYNC_DEFAULTS.minConfidence, 70);
  assert.deepEqual(defaults.SYNC_DEFAULTS.compareSites, defaults.ALL_COMPARE_SITES);
  assert.equal(defaults.SYNC_DEFAULTS.notifyOnAI, false);
  assert.equal(defaults.SYNC_DEFAULTS.compareUseTabs, false);
});

test('CONTENT_PREF_DEFAULTS is a subset of sync settings', () => {
  const { CONTENT_PREF_DEFAULTS, SYNC_DEFAULTS } = defaults;
  assert.equal(CONTENT_PREF_DEFAULTS.mode, SYNC_DEFAULTS.mode);
  assert.equal(CONTENT_PREF_DEFAULTS.enabled, SYNC_DEFAULTS.enabled);
  assert.equal(CONTENT_PREF_DEFAULTS.minConfidence, SYNC_DEFAULTS.minConfidence);
});

test('storage keys and AI threshold are stable', () => {
  assert.equal(defaults.CACHE_PREFIX, 'rmf_cache_');
  assert.equal(defaults.HISTORY_KEY, 'rmf_history');
  assert.equal(defaults.AI_THRESHOLD, 90);
});
