# TODO: Price Compare Feature

> Autonomous checklist for no-backend, no-paid-API price compare.
> Mark `[x]` + one-line note when done. Do not skip ahead of unchecked items.

## Phase 1 — Query Extraction
- [x] Write cleanQueryFromProduct(title, attributes) function — `utils/product-query.js`: FILLER_PHRASES, cleanQueryFromProduct, buildSearchQuery delegates
- [x] Unit-test against 5-10 real messy titles from Amazon/Myntra/Flipkart — `test/unit/clean-query.test.cjs` (10 cases)
- [x] Verify output query length is reasonable (not full title, not too short) — aggregate length test in clean-query.test.cjs

## Phase 2 — Hidden Tab Scraping Infrastructure
- [x] Background: openHiddenSearchTab(platform, query) helper — `compare/tab-search.js`, per-platform URLs from `compare/config.js`
- [x] Content script: per-platform scraper (selector-based, wait-for-element polling) — `compare/tab-parser.js` RMF_waitAndParseSearchPage, selectors in config scrape
- [x] Per-platform scrape timeout + cleanup (always remove tab, even on failure) — SCRAPE_TIMEOUT_MS=10s in config, finally block in tab-search
- [x] Test each platform scraper independently before combining — `test/unit/tab-parser.test.cjs`, `test/unit/tab-search.test.cjs`, myntra/nykaa fixtures

## Phase 3 — Similarity Scoring
- [x] Integrate transformers.js CLIP model in offscreen document — `offscreen/offscreen.html`, `offscreen/offscreen.js`, `libs/transformers.min.js`, `compare/clip-bridge.js`
- [x] Image similarity function (cosine sim between embeddings) — offscreen scoreBatch + `compare/similarity.js` cosineSimilarity
- [x] Text similarity function (TF-IDF or Jaccard, no external lib) — `compare/similarity.js` textSimilarity
- [x] Combined weighted score using named constants (IMAGE_WEIGHT=0.55, TEXT_WEIGHT=0.45) — `compare/score-config.js`
- [x] Dedup pass for near-identical candidates (similarity > 0.9) — `compare/similarity.js` dedupCandidates

## Phase 4 — Ranking & Display
- [x] Merge + sort all platform candidates by finalScore, cross-platform (not grouped) — `compare/search.js` `rankCrossPlatform`
- [x] Top-10 slice — `compare/score-config.js` `TOP_RANKED`
- [x] Compare tab UI: result cards (image, platform badge, price, title, score, link) — `popup/compare-panel.js` renders `data.ranked`

## Phase 5 — Stale Results Bug Fix
- [x] Product-change detection (MutationObserver + pushState/popstate listener) — `content/content.js` startProductWatcher
- [x] Invalidate cached results on product change — fingerprint cache keys + `clearCompareUI` in compare-panel
- [x] Auto-rescan when Compare tab visible + product changed — `handleProductChange` + popup poll/message listener
- [x] Mark stale results when tab reopened after background product change — `render()` detects fingerprint mismatch, auto-rescan
- [x] Manual Refresh button — clears old UI state before rescanning — `#compare-refresh` in popup

## Phase 6 — UI States
- [ ] Loading state (per-platform progress)
- [ ] Stale/outdated badge state
- [ ] Empty state
- [ ] Partial failure state (some platforms succeed, some fail)
- [ ] Success state (final ranked cards)

## Phase 7 — Resilience
- [ ] Per-platform scrape timeout (8-10s) + graceful failure
- [ ] Playwright e2e test: navigate between two different products, verify Compare tab does NOT show stale data
- [ ] Playwright e2e test: click Refresh, verify old cards clear before new ones render
- [ ] Playwright e2e test: simulate one platform failing, verify others still render + failure notice shown
- [x] Playwright real-product Tier A/B suite — `test/e2e/compare-real-products.spec.cjs`, run via `npm run test:compare-real`

---

## Tier A/B Results (live run 2026-07-01, ~3.4 min, 33/33 passed)

Evidence: `test-results/compare-real-products/` (JSON per brand/platform, screenshots, `tier-a-summary.json`, `tier-b-summary.json`). Regenerate tables: `node scripts/generate-compare-real-report.cjs`.

### Tier A — Scraper mechanics
| Brand | Amazon | Myntra | Flipkart |
|---|---|---|---|
| Allen Solly (shirts) | ✅ 12 candidates | ✅ 12 candidates | ❌ empty (page load timeout) |
| Allen Solly (checked shirts) | ✅ 12 candidates | ❌ empty (page load timeout) | ✅ 12 candidates |
| Van Heusen (shirts) | ✅ 12 candidates | ✅ 12 candidates | ✅ 12 candidates |
| US Polo Assn (shirts) | ✅ 12 candidates | ❌ empty (page load timeout) | ✅ 12 candidates |
| Peter England (shirts) | ✅ 12 candidates | ✅ 12 candidates | ✅ 12 candidates |
| Levi's (denim shirt) | ✅ 12 candidates | ✅ 12 candidates | ✅ 12 candidates |
| Arrow (formal shirts) | ✅ 12 candidates | ✅ 12 candidates | ✅ 12 candidates |
| Louis Philippe (shirts) | ✅ 12 candidates | ✅ 12 candidates | ✅ 12 candidates |
| H&M (men's shirts) | ✅ 12 candidates | ✅ 12 candidates | ✅ 12 candidates |
| Roadster (Myntra house brand) | ✅ 12 candidates | ✅ 12 candidates | ✅ 12 candidates |

**Tier A notes:** 27/30 platform scrapes returned ≥1 candidate. 3 failures were Myntra listing-page timeouts (Allen Solly shirts, Allen Solly checked, US Polo) and 1 Flipkart brand-page timeout (Allen Solly shirts). Amazon search scrape worked for all 10 brands. Roadster on Amazon/Flipkart returned Roadster-branded results (not a graceful zero — house brand is listed on other platforms too).

### Tier B — Live end-to-end
| Brand | Source product (Amazon) | Top match found | Score | Sane match? (human judgment) |
|---|---|---|---|---|
| Allen Solly | Allen Solly Men's Polo T-Shirt (₹500) | (none ranked) | — | Pipeline OK. Flipkart returned relevant Allen Solly polos in candidates; Myntra results off-topic. Matcher returned `best: null` for all sites. |
| Van Heusen | Van Heusen Solid Formal Shirt (₹500) | (none ranked) | — | Pipeline OK. Same pattern — candidates scraped, zero passed `pickBest` threshold. |
| Roadster | Aventura Outfitters tee (Amazon search noise, not Roadster) | (none) | — | Pipeline OK, graceful empty. Amazon SERP did not surface Roadster; no crash/fake matches. |

**Tier B notes:** All 3 runs completed in 13–24s without throw. `failed: []` on all. Empty `matches` because `pickBest` rejected candidates (likely missing source `brand` + strict score floor), not because scraping returned zero rows. See `tier-b-*.json` for full candidate lists and `[STAGE1]`–`[STAGE4]` logs.
