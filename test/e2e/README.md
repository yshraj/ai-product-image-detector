# Extension E2E Tests (Playwright)

End-to-end tests for the Chrome extension using Playwright with a real Chromium profile and the unpacked extension loaded.

## Quick start

```bash
npm ci
npx playwright install --with-deps chromium   # first time only
npm run validate       # manifest + syntax (fast sanity check)
npm run test:unit      # Node unit tests
npm test               # Playwright E2E specs (offline mocks)
npm run test:compare-real  # Live marketplace compare suite (network)
npm run test:compare-regression  # Attribute-matching regression on 5 live pages (network)
npm run test:headed    # E2E with visible browser (HEADLESS=0)
```

## Architecture

```
test/e2e/
├── fixtures/
│   ├── extension.fixture.cjs       # Default — offline mocks, storage reset per test
│   └── extension-real.fixture.cjs  # Live network — no marketplace mocks (compare-real)
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
└── *.spec.cjs                  # Test suites (incl. regression.spec.cjs, compare-real-products)
```

### Live compare tests (`compare-real-products.spec.cjs`)

Exercises **real** Amazon, Myntra, and Flipkart pages (no `mock-routes`). Run separately — not part of CI by default:

```bash
npx playwright install chromium   # first time
npm run test:compare-real
node scripts/generate-compare-real-report.cjs   # markdown tables from evidence JSON
```

Evidence is written to `test-results/compare-real-products/` (per-brand JSON, screenshots, tier summaries). See [TODO_price_compare.md](../../TODO_price_compare.md) for latest run notes.

### Compare regression (`compare-regression.spec.cjs`)

Exercises five live pages covering exact-match, brand/pattern discrimination, search pages, and listing pages:

```bash
npm run test:compare-regression
```

Evidence: `test-results/compare-regression/` (per-case JSON, screenshots, HTML failure tables, `summary.json`). Uses the real extension fixture with `compareUseTabs` and attribute-based scoring debug output.

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
