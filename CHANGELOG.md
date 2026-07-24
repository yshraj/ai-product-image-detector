# Changelog

All notable changes to TrueKart (formerly ShopShield / RealModel Filter) are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.9.0] — 2026-07-25

### Changed
- **Relicensed from proprietary to MIT.** The project can now actually
  function as open source — `LICENSE`, `package.json`.
- Reframed preview-mode copy across the popup, strings module, and store
  listing docs — the free, zero-setup detection path now leads with what it
  does well (local, private, free) before the accuracy tradeoff, instead of
  leading with "not accurate."
- `docs/TERMS.md` no longer describes the product as a "shopping assistant"
  (pre-1.8.0 positioning, dropped when Compare/Tools were removed).

### Added
- `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, GitHub issue
  templates (bug / false-positive / new-marketplace-request), and a PR
  template — the standard open-source trust surface, previously entirely
  missing.
- A persistent "❤️ Support us" link in the popup and options page, pointing
  at a Razorpay payment page (repointed the existing config-driven support
  footer rather than adding a second one).
- `forced-colors` (Windows High Contrast) support and a light-theme variant
  for the injected "Why flagged?" popover, which was previously dark-only.
- `docs/ACCURACY.md` — real, independently-reproducible detection accuracy
  numbers (precision/recall/F1 for preview, Hugging Face default model, and
  on-device ONNX) from the existing `research/accuracy-test/` benchmark,
  instead of no accuracy page at all.
- README badges, a real screenshots section, and `scripts/capture-screenshots.cjs`.
- Chrome Web Store promotional assets generated from the real extension UI
  and brand tokens: small promo tile, marquee/feature graphic, and 2 of 3
  required listing screenshots (`scripts/generate-promo-assets.cjs`,
  `scripts/generate-store-screenshot.cjs`).

### Fixed
- **Flipkart selectors** — live-verified against a real search page; every
  previously hardcoded hashed class had gone dead. Replaced with a
  class-agnostic CDN-image primary selector, the same pattern already
  working for AliExpress/Meesho/Temu/Shein. Myntra and Nykaa hardened the
  same way defensively.
- Removed `gridSelector`/`observeSelector` from all 8 marketplace site
  configs — confirmed via repo-wide search they were never read anywhere;
  the content script's `MutationObserver` always watches `document.body`.
- A stale "connect Hugging Face for real detection" line in `options.js`
  that undersold preview mode, missed in an earlier copy pass.
- `research/accuracy-test/README.md`'s heuristic-detector precision claim
  (was "—", actually 0% — one false-positive flag on a real photo at the
  extension's real default threshold, independently re-verified).

### Security
- Hardened the SSRF guard (`isAllowedHttpUrl`) to also block private/
  link-local/multicast **IPv6** hosts (previously only `::1` was checked),
  including `fc00::/7` unique-local and IPv4-mapped `::ffff:a.b.c.d`.
- Briefly narrowed, then **restored**, the `tabs` permission — removing it
  broke `chrome.tabs.query({url: ...})` calls the popup genuinely needs for
  multi-tab routing. Caught by a full E2E run before shipping; see the git
  history for the full root-cause writeup.

### Removed
- Archived `docs/PRODUCTION-AUDIT.md`, `docs/PRODUCTION-AUDIT-2026.md`,
  `docs/EDGE-CASES.md`, `docs/EXTENSION-PLAYBOOK.md`, `docs/SAAS-PLAYBOOK.md`,
  and `docs/skills-run/` to `docs/archive/` — all pre-1.8.0 or internal
  AI-tooling artifacts that were confusing to read as current guidance.

## [1.8.0] — 2026-07-04

### Removed
- **Cross-marketplace "Similar products / Compare" feature** — unshipped, unreliable, and heavy. Deleted `compare/`, the CLIP `offscreen/offscreen.*`, `popup/compare-panel.js`, compare-only utils (`price`, `product-query`, `product-matcher`, `product-fingerprint`, `trust-storage`, `storage-local`), their tests/fixtures, and all compare settings/strings. The extension is now single-purpose: AI/fake product-photo detection. Content script no longer extracts product metadata or records seller/price stats nothing consumed.

### Added
- **Global marketplaces** — AliExpress, Temu, Shein, and Amazon (10 regional TLDs) now scanned, alongside the existing Myntra/Flipkart/Meesho/Nykaa. New selector modules in `content/sites/`.
- **On-device AI detector (opt-in)** — complete local ONNX inference engine: lazy + resumable model download, versioned IndexedDB cache with invalidation, offscreen ONNX Runtime session, preprocessing/postprocessing matching the research parity pipeline, progress UI, retry/timeout, memory cleanup, and graceful fallback. Ships inert by default; see [docs/ONDEVICE.md](docs/ONDEVICE.md).
- **SPA navigation handling** — content script re-scans on `pushState`/`replaceState`/`popstate` path changes (AliExpress/Temu/Amazon are single-page apps).
- **On-device model management UI** — Options page card (URL, download/cancel/delete, live progress).
- **Docs** — [docs/ONDEVICE.md](docs/ONDEVICE.md), [docs/SELECTORS.md](docs/SELECTORS.md), [docs/STORE-ASSETS.md](docs/STORE-ASSETS.md); unit test `test/unit/ondevice.test.cjs`.

### Changed
- **Repositioned** from "Indian fashion" to spotting AI-generated & fake product photos on scam-prone global marketplaces. New name, description, and taglines.
- **Store package trimmed ~11 MB → ~120 KB** — parked Compare feature assets (ONNX WASM, transformers.js, `compare/`, `offscreen/`, `popup/compare-panel.js`) excluded from the zip; large vendored binaries removed from the repo (re-fetch via `npm run refresh-*`).
- **Permissions deduped** — removed redundant `www.`/`*.` host pairs; narrower, cleaner host list.

### Security
- **On-device model URL** must be https (defense-in-depth against pointing the worker fetch at http/loopback/internal hosts).

### Fixed
- Stale ARIA test now targets `.bottom-nav-tabs` (the tablist), matching the a11y-correct markup.

## [Unreleased-1.4–1.7] — historical, never split into dated versions

> This section predates 1.8.0 and describes the Compare/Tools-tab era, all of
> which was removed in 1.8.0 (see above). Kept for history; if you're looking
> for what's true today, start at [1.9.0](#190--2026-07-25) or newer.

### Added
- **Cross-platform ranked compare** — `compare/search.js` merges site candidates, scores with TF-IDF + optional CLIP, returns flat top-10 `ranked` list; Compare tab renders unified cards.
- **Compare hardening E2E** — `test/e2e/compare-hardening.spec.cjs` (stale navigation, refresh, partial SerpApi failure).
- **Live compare Playwright suite** — `npm run test:compare-real` (Tier A scraper mechanics + Tier B end-to-end on real marketplaces).
- **Compare refresh control** — manual rescan when results are stale after navigation.

### Changed
- **Rebranded to TrueKart** — new teal cart + verify icon, updated tagline ("Real photos. Best prices. Shop India."), and Chrome Web Store–friendly listing title.
- **Compare searches are always fresh** — removed `chrome.storage.local` compare cache and `RMF_COMPARE_CACHE` handler.
- **Nykaa compare** — always uses hidden background tabs (direct `fetch` blocked by Akamai).

### Fixed
- **Compare `ranked` always empty in extension** — service worker now loads `similarity.js` before `search.js`.
- **Compare tab stuck searching** — fixed `sites` ReferenceError in `runSearch`; SerpApi path no longer falls through to slow direct scrape.
- **Compare match scoring without brand** — infer leading brand tokens from product title when marketplace metadata omits `brand` (common on Amazon); used by `pickBest` and search query building.
- **Stale compare results** — popup waits until product URL matches active tab; invalidates UI on `RMF_PRODUCT_CHANGED`.
- **Nykaa tab parser** — resolves relative product URLs via site host fallback; improved `/p/` link parsing.

### Added
- **Four-tab shopping assistant popup** — **Scan**, **Compare**, **Tools**, and **Settings**
  with bottom navigation (AI detection is one feature among several).
- **Compare tab** — search the current product on Amazon, Flipkart, Myntra, Meesho, Nykaa;
  marketplace toggles in Settings.
- **Tools tab** — Google Lens, Bing Visual Search, copy product details (title, brand, price,
  rating, seller, URL), copy/download image, share.
- **Product extraction** (`GET_PRODUCT`) — Open Graph + JSON-LD heuristics for Compare/Tools
  on product pages.
- **Production Playwright E2E suite** — fixtures, helpers, page objects, 69 tests covering
  installation, popup, options, messaging, storage persistence, workflows, and accessibility.

### Changed
- Popup repositioned as a **shopping assistant** ("Shop smarter. Spot AI. Compare better.")
  rather than an AI-image detector UI.
- Popup falls back to the active marketplace tab when opened as a test/dev tab.
- CI runs E2E with `CI=true` headless Chromium; uploads screenshots/reports on failure.

## [1.3.0] — 2026-06-27

### Changed
- **Rebranded to ShopShield** (formerly RealModel Filter) — shopping trust assistant positioning.
- **New light, friendly UI** for the popup and settings page (indigo accent, shield logo).

### Added
- **Reverse image search + marketplace search** in the badge popover — Google Lens / Bing and
  Amazon / Flipkart / Google handoffs.
- **Export page report** — JSON or CSV from the popup.
- **Toolbar badge counter**, page scan summary, rescan.
- **"Why flagged?" popover**, activity history, opt-in notifications.
- Shared **strings module** (`utils/strings.js`).

### Fixed
- Default HF model migrated to `haywoodsloan/ai-image-detector-deploy` (from over-flagging
  `Organika/sdxl-detector`); model switch auto-clears cache.
- Badge tiers: **≥ 95% AI Generated**, **70–94% Likely AI**, default floor **70%**.

## [1.2.0] — 2026-06-27

### Changed
- Hugging Face–only engines (AI or Not removed); viewport-gated scanning.

## [1.1.0] — 2026-06-27

### Fixed
- Hugging Face endpoint migrated to `router.huggingface.co/hf-inference`.

### Added
- Live token validation, engine-health surfacing, SaaS popup redesign, axe + unit tests, CI,
  keyboard shortcut (`Alt+Shift+R`), SSRF allowlist.

## [1.0.0]

- Initial release: MV3 extension with badge overlays, EXIF + heuristic, Hugging Face wiring.
