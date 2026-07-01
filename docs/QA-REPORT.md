# TrueKart QA Report

**Date:** 2026-06-30  
**Version:** 1.6.0  
**Status:** Production-ready

## Test summary

| Suite | Passed | Failed |
|-------|--------|--------|
| Playwright E2E | 78 | 0 |
| Node unit tests | 32 | 0 |
| `npm run validate` | PASS | — |

## Testing strategy validation

- **Local HTML fixtures** for Myntra, Flipkart, Meesho, and Nykaa (`test/e2e/helpers/marketplace-fixture.cjs` + `mock-routes.cjs`)
- **No live marketplace pages** loaded during automated tests — all `*.com` routes intercepted
- **SerpApi / compare** mocked via Playwright `context.route('https://serpapi.com/**')` — zero real API quota
- **Hugging Face** mocked via route interception on `router.huggingface.co`
- **Context menu** tested by invoking `RMF_runImageCheck` directly in the service worker (no native OS menu)
- **Internal marketplace JSON APIs** return empty JSON stubs in tests

## Bugs fixed during QA

1. **Onboarding overlay** blocked popup clicks in E2E — storage reset now sets `rmf_onboarding_done`
2. **Notifications never fired** — `notifyAI()` required `STRINGS` in the service worker; session record now written regardless
3. **Options page version** stuck at v1.3.0 — now reads from `chrome.runtime.getManifest()`
4. **Badge tier tests** updated for 90% AI Generated / 70–89% Likely AI thresholds
5. **Compare manual-link tests** updated for post-search UX (filter chips + SerpApi results)
6. **Context menu registration** — `setupContextMenu()` runs on service worker startup; handler exposed as `RMF_runImageCheck`

## Screenshots

Captured in [`qa-screenshots/`](qa-screenshots/) via `npm run test:qa-screenshots`:

| File | Workflow |
|------|----------|
| `01-popup-scan-tab` | Extension popup — Scan tab |
| `02-popup-compare-tab-empty` | Compare tab empty state |
| `03-popup-compare-product-loaded` | Compare with product extracted |
| `04-popup-compare-results-success` | Compare results with match scores |
| `05-popup-tools-tab` | Tools tab |
| `06-popup-settings-tab` | Settings tab |
| `07-myntra-listing-badges` | Product page badges on listing |
| `08-myntra-product-page` | Product detail page |
| `09-compare-search-in-progress-or-partial` | Compare search state |

## Files modified (QA pass)

- `background/service-worker.js` — notifications, context menu, image check handler
- `options/options.js` — dynamic version
- `test/e2e/helpers/*` — fixtures, mocks, storage reset, messaging
- `test/e2e/*.spec.cjs` — compare, context-menu, marketplace-fixtures, shopping-assistant, labels
- `test/unit/serp-search.test.cjs` — new unit coverage
- `scripts/capture-qa-screenshots.cjs` — screenshot automation

## Performance observations

- Full E2E suite completes in ~1.3 minutes (78 tests, worker-scoped extension context)
- Compare search via mocked SerpApi resolves in <3s per product
- Tab-scrape fallback not exercised in CI (mocked SerpApi path is primary in tests)

## Remaining risks

- **SerpApi in production** requires user-provided API key; without it, direct/tab scraping may fail on bot-protected sites
- **`chrome.contextMenus.getAll`** may be unavailable in some Chromium builds — menu creation is verified via handler exposure + permission test
- **Context-menu image check** on arbitrary non-marketplace pages depends on `scripting` + host permissions / activeTab grant

## Production readiness checklist

- [x] All tests pass
- [x] No TODO/FIXME in source
- [x] Validate script passes
- [x] Offline fixture-based E2E
- [x] SerpApi mocked in tests
- [x] QA screenshots captured
- [x] Logical git commits prepared
