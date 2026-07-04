// test/unit/ondevice.test.cjs — pure-logic checks for the on-device engine.
// Browser/IndexedDB/ORT paths are validated manually (see docs/ONDEVICE.md).
const { test } = require('node:test');
const assert = require('node:assert/strict');

const CFG = require('../../utils/ondevice-config.js');
const { sha256Hex } = require('../../detection/ondevice/download-manager.js');

test('ondevice config matches the research preprocessing pipeline', () => {
  assert.equal(CFG.INPUT_SIZE, 256);
  assert.deepEqual(CFG.MEAN, [0.485, 0.456, 0.406]);
  assert.deepEqual(CFG.STD, [0.229, 0.224, 0.225]);
  assert.equal(CFG.AI_CLASS_INDEX, 0); // index 0 = "artificial" (parity.py)
  assert.ok(Number.isInteger(CFG.MODEL_VERSION) && CFG.MODEL_VERSION >= 1);
  assert.ok(CFG.DOWNLOAD_RETRIES >= 1);
  assert.ok(CFG.DOWNLOAD_TIMEOUT_MS >= 10_000);
});

test('sha256Hex produces the correct digest (NIST "abc" vector)', async () => {
  const abc = new Uint8Array([0x61, 0x62, 0x63]);
  const hex = await sha256Hex(abc);
  assert.equal(hex, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
