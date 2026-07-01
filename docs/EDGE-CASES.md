# Edge Cases & Failure Scenarios — TrueKart v1.7

This document records edge cases analyzed across all user flows, what was wrong (or risky), and how each was resolved. All changes preserve existing behavior for happy paths; tests verify no regressions.

**Test status after fixes:** 80 unit + 93+ E2E passing (includes `compare-hardening.spec.cjs`).

---

## 1. Scan tab

| # | Scenario | Before | Risk | Resolution |
|---|----------|--------|------|------------|
| S1 | User on Google/unsupported tab, another Myntra tab open in background | Popup showed **another tab’s** scan stats | Misleading UX | `sendToActiveTab` now uses **active tab only** for `GET_STATS`, `RESCAN`, export, highlights, and settings messages (fallback to other tabs kept only when popup itself is opened as a `chrome-extension:` tab for E2E) |
| S2 | User on Myntra but content script not ready (fresh install, hard refresh) | Same message as truly unsupported page | Confusing | Distinct **“Scanner starting…”** hint when URL is a supported marketplace host |
| S3 | No active browser tab | Generic unsupported message | Unclear | **“No active tab”** copy when `tab.id` is missing |
| S4 | User on Amazon product page | Generic “open a product page” | Dead-end | **Amazon limited support** message in Scan/Tools (Amazon is not in content scripts) |
| S5 | `chrome.storage.sync` fails on popup open | Partial/broken UI, no feedback | Silent fail | Init wrapped in try/catch; falls back to defaults + error toast |
| S6 | Settings toggle/confidence/SerpApi save fails | UI showed saved state | Silent fail | Shared `saveSync()` with error toast and UI revert on failure |
| S7 | Rescan on large listing; fixed 800 ms refresh | Stale counts until popup reopened | Stale data | Polls `GET_STATS` until `pending === 0` (max ~10 s) |
| S8 | Seller trust list from storage | `innerHTML` with seller names | XSS if storage tampered | Built with `textContent` / `createElement` |

**Files:** `popup/popup.js`, `utils/strings.js`

---

## 2. Content script (page scan)

| # | Scenario | Before | Risk | Resolution |
|---|----------|--------|------|------------|
| C1 | Extension reloaded mid-scan; cards stuck `pending` | Inflated `pending`, progress never clears | Stale UI | `clearStalePending()` on init removes orphan `pending` markers before rescan |
| C2 | Product image never fires `load`/`error` | Throttle slot held forever | Scan stall | **12 s timeout** on image load wait; card released for retry |
| C3 | Corrupt `mode` via imported settings + `SET_MODE` message | Raw `msg.mode` applied | Misbehavior | `SET_MODE` now uses `cleanMode()` like storage listener |
| C4 | Compare/Tools on **category listing** (not product URL) | Category title used for cross-site search | Irrelevant compare | `getProduct()` returns `isProductPage: false` + empty title when URL fails `isMarketplaceProductUrl` |
| C5 | “Mark wrong” correction; storage write fails | Empty catch | User thinks correction saved | Inline **“Could not save — try again”** on button |

**Files:** `content/content.js`, `manifest.json` (loads `utils/marketplace-url.js`)

---

## 3. Compare tab

| # | Scenario | Before | Risk | Resolution |
|---|----------|--------|------|------------|
| M1 | All marketplace filter chips deselected | Empty search, generic “no matches” | Confusing | Blocks search with **“Select at least one marketplace”**; chip deselect requires ≥1 site |
| M2 | SerpApi key invalid / network error | Silent fallback to direct scrape | User unaware | `serpFailed` flag returned; status note **“SerpApi unavailable — searched marketplaces directly”** |
| M3 | Compare search hangs (many tab scrapes) | Skeleton indefinitely | Frozen UI | **120 s client timeout** with actionable message |
| M4 | Product meta (brand, price) from page | `innerHTML` with page strings | XSS in popup | Safe DOM construction with `textContent` |
| M5 | Listing page empty state | Generic hint only | Unclear | **“Open a product page (not a category listing)”** when `isProductPage === false` |
| M6 | Per-site scrape timeout | Only “✗” in status line | Opaque | Status line shows **(timeout)** / **(unreachable)** labels |
| M7 | `ranked` always empty in extension | Serp/direct scrape ran but UI showed no matches | Phase 4 appeared broken | **Root cause:** `importScripts` loaded `search.js` before `similarity.js`; fixed load order in service worker |
| M8 | Compare tab stuck on “Searching…” | `showSearchingStatus(sites)` referenced `sites` before declaration | Frozen UI, no `sendResponse` | Moved site list init before status line; added `try/finally` on `runSearch` |
| M9 | SerpApi key set but slow direct scrape ran | `matched === 0` fell through to tab scrape; MV3 SW could die mid-scrape | 30–120s hangs | Serp path now always returns when SerpApi succeeds; popup passes `serpApiKey` in message |

**Files:** `popup/compare-panel.js`, `compare/search.js`, `utils/strings.js`

---

## 4. Tools tab

| # | Scenario | Before | Risk | Resolution |
|---|----------|--------|------|------------|
| T1 | Image drop: FileReader or detect throws | Unhandled rejection; “Checking…” stuck | Silent fail | Full try/catch; resets result with **checkFailed** message |
| T2 | Web Share API fails (not user cancel) | Silent return | No feedback | Toast + fallback copy to clipboard |
| T3 | Amazon / non-product page | Generic no-product | Unclear | Amazon-specific and listing-aware messages (via Scan/Compare guards) |

**Files:** `popup/popup.js`, `utils/strings.js`

**Known limitation (not changed):** Image drop in **Preview/heuristic** mode still requires Hugging Face in the worker (`RMF_DETECT_DATA`). Preview on-page heuristic would need a larger architectural change.

---

## 5. Options page

| # | Scenario | Before | Risk | Resolution |
|---|----------|--------|------|------------|
| O1 | `chrome.storage.sync.set` fails | “Saved” flash anyway | Silent fail | `save()` try/catch reverts state + error toast + `renderPrefs()` |
| O2 | Settings import: unreadable file | No `onerror` handler | Silent fail | `reader.onerror` → toast |
| O3 | Corrupt JSON import | Already handled | — | Uses shared `importInvalid` string |
| O4 | Init storage read fails | Uncaught | Broken page | try/catch + defaults |

**Files:** `options/options.js`, `utils/strings.js`

**Known limitation:** “Reset all” still resets sync settings only; local cache/history require separate “Clear cache” / “Clear history” (intentional to avoid accidental data loss).

---

## 6. Service worker & context menu

| # | Scenario | Before | Risk | Resolution |
|---|----------|--------|------|------------|
| W1 | Context menu on blocked URL (SSRF) | No user feedback | Silent fail | Injects on-page **alert badge** explaining block |
| W2 | `executeScript` denied / throws | `console.warn` only | Silent fail | Injects **“Image check failed”** badge |
| W3 | `RMF_Detect` missing on page | Script exited silently | Silent fail | `check-image.js` shows **“could not load”** badge |
| W4 | Detection throws in context check | Unhandled | Silent fail | try/catch → **“Image check failed”** badge |
| W5 | SW killed mid-HF request | Content timeouts (8 s / 25 s) → no badge | Acceptable | Existing pipeline timeouts; no change (documented) |
| W6 | Compare modules fail `importScripts` | Error only at search time | OK | Existing explicit error message retained |

**Files:** `background/service-worker.js`, `content/check-image.js`

---

## 7. Network & detection pipeline

| # | Scenario | Before | Risk | Resolution |
|---|----------|--------|------|------------|
| N1 | Slow CDN image fetch (>8 s) | Inconclusive, no badge | Silent | Existing timeout; card released after image load timeout (C2) |
| N2 | HF remote error | `remote-error`, no badge | Silent on page | Unchanged — health surfaced in popup Settings; full per-card error UI deferred |
| N3 | Blocked private/loopback URL | Worker returns `blocked URL` | Silent on page | Context menu now surfaces message (W1); in-page scan unchanged |

---

## 8. Extension lifecycle

| Scenario | Behavior after fixes |
|----------|---------------------|
| **Page refresh** | Content script reinjects; fresh session; scan restarts |
| **Extension reload** | Stale `pending` markers cleared on init (C1); user may need one page reload for full rescan |
| **Service worker restart** | MV3 worker restarts on idle; message handlers re-register; in-flight requests rely on client timeouts |
| **Popup reopen** | Re-reads storage; `updateScan` queries active tab only |

---

## 9. Test coverage notes

| Area | Coverage |
|------|----------|
| Unsupported URL / SSRF | `permissions.spec.cjs`, `service-worker.test.cjs` |
| Corrupt imported settings | `preferences.spec.cjs` |
| Context menu | `context-menu.spec.cjs` |
| Compare mocked failures | `compare.spec.cjs`, `shopping-assistant.spec.cjs` |
| Storage persistence | `storage-persistence.spec.cjs` |
| Product URL detection | `product-page.test.cjs`, `product.spec.cjs` |

New edge-case behaviors (active-tab-only stats, listing page guard, SerpApi fallback note) are covered indirectly by existing E2E flows on product fixtures.

---

## 10. Deferred (documented, not implemented)

| Item | Reason |
|------|--------|
| Image drop using on-device heuristic without HF | Requires detection scripts in popup or worker heuristic path |
| Full Amazon content-script support | Manifest + site adapter scope |
| Reset-all clears local cache/history | Risk of accidental data loss; separate actions exist |
| Per-card “scan failed” badge on listing pages | UX noise; health card + popup status preferred |
| Compare search cancellation on popup close | MV3 message cancellation non-trivial |
| Parallel compare site searches | Behavior change + rate-limit risk |

---

*Generated as part of the v1.7 edge-case hardening pass.*
