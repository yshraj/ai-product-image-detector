# Extension E2E Tests (Playwright)

End-to-end tests for the Chrome extension using Playwright with a real Chromium profile and the unpacked extension loaded.

## Quick start

```bash
npm ci
npx playwright install --with-deps chromium   # first time only
npm run validate       # manifest + syntax (fast sanity check)
npm run test:unit      # 37 Node unit tests
npm test               # 90 Playwright E2E specs
npm run test:headed    # E2E with visible browser (HEADLESS=0)
```

## Architecture

```
test/e2e/
├── fixtures/
│   └── extension.fixture.cjs   # Playwright test.extend — isolated context per test
├── helpers/
│   ├── constants.cjs           # Paths, manifest, defaults
│   ├── extension-launcher.cjs  # launchPersistentContext + --load-extension
│   ├── mock-routes.cjs         # Offline Myntra/HF/CDN mocks
│   ├── marketplace-fixture.cjs # Deterministic listing + product HTML
│   ├── chrome-api.cjs          # Service worker & extension ID helpers
│   ├── chrome-storage.cjs      # chrome.storage sync/local/session
│   └── chrome-messaging.cjs    # popup ↔ background ↔ content messages
├── pages/                      # Page Object Model
│   ├── PopupPage.cjs
│   ├── OptionsPage.cjs
│   └── ContentPage.cjs
└── *.spec.cjs                  # Test suites (incl. regression.spec.cjs)
```

## Writing tests

Prefer the shared fixture over manual `launch()`:

```javascript
const { test, expect } = require('./fixtures/extension.fixture.cjs');

test('my scenario', async ({ extensionContext, popupUrl, contentPage }) => {
  await contentPage.setViewportAllVisible();
  await contentPage.gotoListing();
  await contentPage.waitForBadges();
  // ...
});
```

Storage is reset to defaults before each test (`_storageReset` auto-fixture). Override with `setSyncStorage(extensionContext, { ... })` inside the test.

## CI

GitHub Actions runs `npx playwright install --with-deps chromium` then `npm test`. On failure, `test-results/` and `playwright-report/` are uploaded as artifacts.

## Test assets

Place PNG fixtures in `test/assets/` (`ai0.png`, `real1.png`, …). The CDN mock serves these for cross-origin image detection tests.

## Offline guarantees

- Marketplace pages (Myntra, Flipkart, Meesho, Nykaa, Amazon) are served from `test/e2e/helpers/marketplace-fixture.cjs`
- SerpApi compare requests are intercepted in `mock-routes.cjs` — no real API quota consumed
- Context-menu image checks invoke `RMF_runImageCheck` in the service worker (no native OS menu)

## QA screenshots

```bash
npm run test:qa-screenshots   # writes to qa-screenshots/
```
