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
- [ ] Integrate transformers.js CLIP model in offscreen document
- [ ] Image similarity function (cosine sim between embeddings)
- [ ] Text similarity function (TF-IDF or Jaccard, no external lib)
- [ ] Combined weighted score using named constants (IMAGE_WEIGHT=0.55, TEXT_WEIGHT=0.45)
- [ ] Dedup pass for near-identical candidates (similarity > 0.9)

## Phase 4 — Ranking & Display
- [ ] Merge + sort all platform candidates by finalScore, cross-platform (not grouped)
- [ ] Top-10 slice
- [ ] Compare tab UI: result cards (image, platform badge, price, title, score, link)

## Phase 5 — Stale Results Bug Fix
- [ ] Product-change detection (MutationObserver + pushState/popstate listener)
- [ ] Invalidate cached results on product change
- [ ] Auto-rescan when Compare tab visible + product changed
- [ ] Mark stale results when tab reopened after background product change
- [ ] Manual Refresh button — clears old UI state before rescanning

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
