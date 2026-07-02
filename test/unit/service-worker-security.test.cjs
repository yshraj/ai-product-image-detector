// test/unit/service-worker-security.test.cjs — message sender and payload guards.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isTrustedSender,
  MAX_DETECT_DATA_URL_LEN,
} = require('../../background/service-worker.js');

test('isTrustedSender accepts matching extension id', () => {
  const id = 'abcdefghijklmnopqrstuvwxyz123456';
  global.chrome = { runtime: { id } };
  assert.equal(isTrustedSender({ id }), true);
  delete global.chrome;
});

test('isTrustedSender rejects foreign or missing senders', () => {
  global.chrome = { runtime: { id: 'abc' } };
  assert.equal(isTrustedSender({ id: 'other-extension' }), false);
  assert.equal(isTrustedSender(null), false);
  assert.equal(isTrustedSender({}), false);
  delete global.chrome;
});

test('MAX_DETECT_DATA_URL_LEN caps oversized inline detect payloads', () => {
  assert.ok(MAX_DETECT_DATA_URL_LEN >= 8 * 1024 * 1024);
  assert.ok(MAX_DETECT_DATA_URL_LEN <= 16 * 1024 * 1024);
});
