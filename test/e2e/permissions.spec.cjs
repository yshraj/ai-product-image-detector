// Permission and security guards (SSRF, blocked schemes).
const { test, expect } = require('./fixtures/extension.fixture.cjs');
const { fetchImageViaWorker, remoteDetectViaWorker } = require('./helpers/chrome-messaging.cjs');

const BLOCKED = [
  'http://127.0.0.1/img.png',
  'http://localhost/secret',
  'http://192.168.1.1/img.png',
  'file:///etc/passwd',
  'javascript:alert(1)',
];

test.describe('Permissions & security', () => {
  for (const url of BLOCKED) {
    test(`blocks disallowed URL: ${url}`, async ({ extensionContext }) => {
      const res = await fetchImageViaWorker(extensionContext, url);
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/blocked/i);
    });
  }

  test('remote detect rejects blocked URLs before any network call', async ({ extensionContext }) => {
    const res = await remoteDetectViaWorker(extensionContext, 'http://169.254.169.254/latest/meta-data');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/blocked/i);
  });

  test('context menus permission is declared for image checks', () => {
    const { MANIFEST } = require('./helpers/constants.cjs');
    expect(MANIFEST.permissions).toContain('contextMenus');
  });
});
