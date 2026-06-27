// test/unit/service-worker.test.cjs
// Unit tests for the service worker's pure helpers (no chrome runtime needed —
// the worker guards its listener registration so the file is require-safe).
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { isAllowedHttpUrl, parseHfResult, friendlyHfError } =
  require('../../background/service-worker.js');

test('isAllowedHttpUrl allows public http(s) image URLs', () => {
  assert.equal(isAllowedHttpUrl('https://assets.myntassets.com/x.jpg'), true);
  assert.equal(isAllowedHttpUrl('http://images.example.com/a.png'), true);
  assert.equal(isAllowedHttpUrl('https://1.2.3.4/pic.jpg'), true); // public IP
});

test('isAllowedHttpUrl blocks non-http schemes', () => {
  assert.equal(isAllowedHttpUrl('file:///etc/passwd'), false);
  assert.equal(isAllowedHttpUrl('data:image/png;base64,AAAA'), false);
  assert.equal(isAllowedHttpUrl('ftp://host/x'), false);
  assert.equal(isAllowedHttpUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedHttpUrl('not a url'), false);
});

test('isAllowedHttpUrl blocks loopback, private and link-local hosts (SSRF guard)', () => {
  assert.equal(isAllowedHttpUrl('http://localhost/x'), false);
  assert.equal(isAllowedHttpUrl('http://127.0.0.1/x'), false);
  assert.equal(isAllowedHttpUrl('http://10.0.0.5/x'), false);
  assert.equal(isAllowedHttpUrl('http://192.168.1.10/x'), false);
  assert.equal(isAllowedHttpUrl('http://172.16.0.1/x'), false);
  assert.equal(isAllowedHttpUrl('http://172.31.255.255/x'), false);
  assert.equal(isAllowedHttpUrl('http://169.254.169.254/latest/meta-data'), false); // cloud metadata
  assert.equal(isAllowedHttpUrl('http://[::1]/x'), false);
  assert.equal(isAllowedHttpUrl('http://0.0.0.0/x'), false);
});

test('isAllowedHttpUrl does not over-block adjacent public ranges', () => {
  assert.equal(isAllowedHttpUrl('http://172.15.0.1/x'), true);
  assert.equal(isAllowedHttpUrl('http://172.32.0.1/x'), true);
  assert.equal(isAllowedHttpUrl('http://11.0.0.1/x'), true);
});

test('parseHfResult reads AI label scores (flat array)', () => {
  const r = parseHfResult([
    { label: 'artificial', score: 0.97 },
    { label: 'human', score: 0.03 },
  ]);
  assert.equal(r.isAI, true);
  assert.equal(r.confidence, 97);
  assert.equal(r.source, 'huggingface');
});

test('parseHfResult handles nested arrays and real-only labels', () => {
  const nested = parseHfResult([[{ label: 'fake', score: 0.8 }, { label: 'real', score: 0.2 }]]);
  assert.equal(nested.confidence, 80);

  // Only a "real" label present → AI score is the complement.
  const realOnly = parseHfResult([{ label: 'real', score: 0.9 }]);
  assert.equal(realOnly.confidence, 10);
  assert.equal(realOnly.isAI, false);
});

test('parseHfResult maps a confident real photo to a LOW AI score (Organika labels)', () => {
  // Organika/sdxl-detector emits id2label {0:"artificial", 1:"human"}. A real
  // photo should come back human-dominant → low P(AI), NOT flagged. This guards
  // against any future label-direction regression.
  const realPhoto = parseHfResult([
    { label: 'human', score: 0.985 },
    { label: 'artificial', score: 0.015 },
  ]);
  assert.equal(realPhoto.confidence, 2); // round(0.015*100)
  assert.equal(realPhoto.isAI, false);
});

test('parseHfResult throws on unusable responses', () => {
  assert.throws(() => parseHfResult({ not: 'an array' }));
  assert.throws(() => parseHfResult([{ label: 'cat', score: 0.9 }]));
});

test('friendlyHfError maps HTTP statuses to human messages', () => {
  assert.match(friendlyHfError(401), /token/i);
  assert.match(friendlyHfError(410), /no longer served/i);
  assert.match(friendlyHfError(429), /rate limit/i);
  assert.match(friendlyHfError(503), /warming up/i);
  assert.match(friendlyHfError(500), /issues/i);
});
