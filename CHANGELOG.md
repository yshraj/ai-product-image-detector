# Changelog

All notable changes to TrueKart (formerly ShopShield / RealModel Filter) are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Cross-platform ranked compare** — `compare/search.js` merges site candidates, scores with TF-IDF + optional CLIP, returns flat top-10 `ranked` list; Compare tab renders unified cards.
- **Live compare Playwright suite** — `npm run test:compare-real` (Tier A scraper mechanics + Tier B end-to-end on real marketplaces).
- **Compare refresh control** — manual rescan when results are stale after navigation.

### Changed
- **Rebranded to TrueKart** — new teal cart + verify icon, updated tagline ("Real photos. Best prices. Shop India."), and Chrome Web Store–friendly listing title.
- **Compare searches are always fresh** — removed `chrome.storage.local` compare cache and `RMF_COMPARE_CACHE` handler.
- **Nykaa compare** — always uses hidden background tabs (direct `fetch` blocked by Akamai).

### Fixed
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
