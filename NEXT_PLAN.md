# TrueKart — Next Plan

**Version:** 1.7.0 · **Updated:** 2026-07-01  
**Status:** Beta-ready for AI scan; Similar products needs quality pass before public launch.

Single planning doc for current state, gaps, and what to build next. See [FEATURES.md](FEATURES.md) for a short feature reference.

---

## 1. Project snapshot

| Area | State |
|------|--------|
| **Product** | Chrome MV3 extension — AI image scan + cross-marketplace similar-product search for India (Myntra, Flipkart, Meesho, Nykaa) |
| **Architecture** | Vanilla JS, no build step, service worker + content scripts + offscreen CLIP |
| **Privacy** | No backend, no accounts, no telemetry |
| **Tests** | 89 unit · 28 E2E specs · CI on push/PR |
| **Store zip** | ~11 MB (ONNX WASM for CLIP; was ~110 KB pre-CLIP) |
| **Branch** | `main` |

**Launch readiness**

| Stage | Ready? |
|-------|--------|
| Internal / dev testing | ✅ Yes |
| Beta (unlisted CWS, 50–200 users) | ⚠️ After P0 items below |
| Public Chrome Web Store | ❌ Not yet |
| Enterprise | ❌ Not applicable |

---

## 2. Completed work

### Core extension (v1.0–1.7)

- [x] MV3 extension with content scripts on 4 Indian marketplaces
- [x] AI detection pipeline: Hugging Face → EXIF → preview heuristic
- [x] Inline badges, “Why flagged?” popover, cache, throttle, viewport gating
- [x] Popup: Scan tab (breakdown, rescan, export JSON/CSV, history)
- [x] Options page (full settings, history, import/export, legal)
- [x] Context-menu image check on any page
- [x] SSRF guard, XSS-safe DOM in popup, gated debug logging
- [x] Playwright E2E suite + GitHub Actions CI
- [x] Privacy/terms copy; keyboard shortcut (Alt+Shift+R)

### Similar products / compare (v1.4–1.7)

- [x] Product extraction (OG + JSON-LD + DOM color on Myntra)
- [x] SerpApi path + direct scrape + hidden-tab scrape (Nykaa)
- [x] Attribute-based text scoring (`attribute-parser.js`, weighted penalties)
- [x] CLIP image scoring via offscreen document + local ONNX WASM
- [x] Cross-platform top-10 ranking, match breakdown UI (✔/✖/—)
- [x] Stale-result handling, refresh, product fingerprint watcher
- [x] Compare hardening E2E + live regression suite (`test:compare-regression`)

### Recent (post–1.7 baseline)

- [x] **3-tab popup** — Scan · Similar products · Settings (Tools removed)
- [x] **Lazy-loaded image scan** — scroll-triggered rescan without page refresh
- [x] **UI de-AI** — less detector-centric copy in scan UI
- [x] **Optional HF ensemble** — max-score across two models for higher recall
- [x] **FEATURES.md** — concise current-behavior reference
- [x] **Research harness** — labeled image sets + heuristic/HF accuracy tests (`research/accuracy-test/`)

---

## 3. Known issues

| Issue | Severity | Notes |
|-------|----------|-------|
| **Similar products unreliable on live PDPs** | 🔴 Critical | Wrong/empty matches reported (e.g. Snitch shirt); user renamed tab from “Compare” |
| **11 MB store zip** | 🔴 Critical | ONNX bundle hurts install conversion; CWS perception |
| **HF token required for accurate scan** | 🟠 High | Default is preview heuristic; onboarding friction |
| **Docs drift** | 🟠 High | README, ARCHITECTURE, ROADMAP still mention 4 tabs / Tools |
| **Fragile site selectors** | 🟠 High | CSS-module hashes break silently on marketplace redesigns |
| **Amazon.in** | 🟡 Medium | Compare host permission only; no content script / scan |
| **SerpApi optional** | 🟡 Medium | Without key, direct scrape is slower and less reliable |
| **No analytics** | 🟡 Medium | Cannot measure activation, compare success, or drop-off |
| **PRODUCTION-AUDIT.md outdated** | 🟡 Low | Claims 110 KB zip, 4-tab UI |
| **Tools tab removed** | 🟡 Low | Lens/copy/share gone; power-user gap |

---

## 4. Technical debt

| Item | Priority | Action |
|------|----------|--------|
| Bundle size (37 MB ONNX in repo) | P0 | Lazy-download CLIP on first compare; ship single WASM file |
| Live compare tests excluded from CI | P1 | Weekly scheduled job with `RUN_LIVE_COMPARE=1` |
| Monolithic `popup.js` / `service-worker.js` | P2 | Split when adding features |
| No ESLint / TypeScript | P3 | Acceptable at current size; JSDoc + validate sufficient |
| `tab-parser.test.cjs` uses Playwright in unit suite | P2 | Requires Chromium installed for full unit run |
| Stale CHANGELOG [Unreleased] | P1 | Fold recent commits into 1.7.1 or 1.8.0 release notes |

---

## 5. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bad compare results → uninstalls | High | Critical | Golden PDP set; manual-first UX; beta label |
| Marketplace blocks scraping | Medium | High | SerpApi path; reduce scrape frequency |
| Selector breakage post-launch | High | High | Live selector check on startup; fast patch playbook |
| CWS rejection (size / permissions) | Medium | High | Shrink zip; document `tabs` + `offscreen` need |
| HF API limits / model deprecation | Medium | Medium | Ensemble + cache; monitor HF changelog |
| Legal (scraping ToS) | Low–Medium | High | Prefer SerpApi for production scale |

---

## 6. Prioritized backlog

### P0 — Before public launch

| # | Task | Effort | Owner hint |
|---|------|--------|------------|
| 1 | **Similar products quality sprint** — 20 golden PDPs, tune scoring until ≥70% acceptable | 1–2 wk | compare/* |
| 2 | **Honest compare UX** — disable auto-search; add Cancel; show “Beta” label | 2–3 d | popup/compare-panel.js |
| 3 | **Shrink install size** — lazy-load ONNX/CLIP; target zip <5 MB | 3–5 d | offscreen/, manifest |
| 4 | **Sync docs** — README, ARCHITECTURE, ROADMAP, PRODUCTION-AUDIT → 3-tab + 11 MB | 1 d | docs/ |
| 5 | **Re-validate live selectors** on all 4 marketplaces | 2–3 d | content/sites/ |
| 6 | **CWS listing assets** — 5 screenshots, demo GIF, updated description | 2–3 d | marketing |
| 7 | **CI green + build gate** — add `npm run build` + max zip size check to CI | 0.5 d | .github/workflows/ |

### P1 — First month post-beta

| # | Task | Effort |
|---|------|--------|
| 8 | HF onboarding funnel in first-run overlay | 3 d |
| 9 | Opt-in anonymous telemetry (feature usage, compare success rate) | 1 wk |
| 10 | Weekly live compare regression in CI | 2 d |
| 11 | In-app “Report wrong match” | 2 d |
| 12 | Settings UI toggles for `compareUseClip`, debug mode | 1 d |
| 13 | Manual-search-first as default; auto-search as opt-in | 1 d |

### P2 — Medium term

| # | Task |
|---|------|
| 14 | Amazon.in content script (scan only) |
| 15 | Composite trust score (AI + seller history) |
| 16 | Restore lightweight Tools (Lens, copy URL) in overflow menu |
| 17 | Hindi UI strings |
| 18 | Selector health check on extension startup |

### P3 — Future

Price history · hosted HF proxy · Ajio/Tata Cliq · generator labeling · mobile browsers

---

## 7. Next sprint (2 weeks)

**Goal:** Trustworthy beta — fix compare UX honesty, start quality sprint, unblock launch prep.

| Day | Task |
|-----|------|
| 1 | Golden PDP list (20 products) + acceptance criteria |
| 1–2 | Disable auto-search; add Cancel; beta label on Similar products |
| 2–3 | Doc sync (README, ARCHITECTURE, link FEATURES.md + NEXT_PLAN.md) |
| 3–5 | Scoring fixes on golden set (brand/color false positives) |
| 5–7 | Lazy ONNX POC; measure zip size |
| 7–8 | Live selector validation on 4 sites |
| 8–9 | HF onboarding step in onboarding overlay |
| 9–10 | CI build + size gate; store screenshots |

**Defer:** Amazon CS, trust score, Hindi, full Tools tab, price history.

---

## 8. Success metrics (need opt-in telemetry for most)

| KPI | Target (90 days) | Why |
|-----|------------------|-----|
| Install → first scan (24h) | ≥60% | Activation |
| HF connect rate (7d) | ≥25% | Real AI value |
| Similar products try rate | ≥15% of PDP sessions | Discovery |
| Compare success rate | ≥50% with ≥1 result ≥60% match | Core loop |
| Compare P95 latency | <20s | UX |
| 7-day retention | ≥20% | Stickiness |
| Scrape success per site | ≥85% | Ops health |

---

## 9. Recommended positioning

**Launch as:** “Real photo checker for Indian fashion e-commerce” (Myntra, Flipkart, Meesho, Nykaa).

**Hold back:** Leading with “price compare” until golden-set pass rate ≥70%.

**Highest-impact single change:** Stop auto-searching Similar products until match quality is proven; keep strong manual marketplace links.

---

## 10. Key commands

```bash
npm run validate          # manifest + syntax + version
npm run test:unit         # 89 unit tests
npm test                  # E2E (offline mocks)
npm run test:compare-regression   # live compare (network, RUN_LIVE_COMPARE=1)
npm run build             # → dist/truekart_*.zip (~11 MB)
```

---

## 11. Doc map

| Doc | Purpose |
|-----|---------|
| [FEATURES.md](FEATURES.md) | Short current-feature reference |
| [NEXT_PLAN.md](NEXT_PLAN.md) | This file — status + roadmap |
| [README.md](README.md) | Dev setup (needs sync) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Module map (needs sync) |
| [docs/EDGE-CASES.md](docs/EDGE-CASES.md) | Failure scenarios |
| [docs/PRODUCTION-AUDIT.md](docs/PRODUCTION-AUDIT.md) | Release checklist (needs sync) |
| [TODO_price_compare.md](TODO_price_compare.md) | Compare phase checklist (complete) |

---

*Review cadence: update this file when a P0 item ships or launch stage changes.*
