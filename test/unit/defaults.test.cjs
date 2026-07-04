// test/unit/defaults.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const defaults = require('../../utils/defaults.js');

test('SYNC_DEFAULTS has the expected detection + notification keys', () => {
  const d = defaults.SYNC_DEFAULTS;
  assert.equal(d.enabled, true);
  assert.equal(d.minConfidence, 70);
  assert.equal(d.notifyOnAI, false);
  assert.equal(d.provider, 'heuristic');
  assert.equal(d.ondeviceModelUrl, '');
  assert.equal(d.hfEnsemble, true);
  // Parked Compare settings must not linger in shipped defaults.
  assert.equal('compareSites' in d, false);
  assert.equal('serpApiKey' in d, false);
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
