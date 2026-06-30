# Architecture — ShopShield

ShopShield is a **Manifest V3 Chrome extension** written in **vanilla JavaScript**. There is no bundler, transpiler, or runtime npm dependency — the repository root is the extension source tree.

This document explains how the pieces fit together. For onboarding commands, see [README.md](../README.md). For rationale behind major choices, see [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md).

---

## High-level overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Extension contexts                                                     │
├─────────────────┬───────────────────────┬───────────────────────────────┤
│  popup/         │  content/             │  background/                  │
│  (user UI)      │  (page injection)     │  (service worker)             │
│                 │                       │                               │
│  Scan           │  Scan product grids   │  HF API calls (CORS bypass)   │
│  Compare        │  Inject badges        │  Image fetch (SSRF guard)     │
│  Tools          │  Extract product info │  Compare search orchestration │
│  Settings       │  Popup messaging      │  Badge, history, notifications│
└────────┬────────┴───────────┬───────────┴───────────────┬───────────────┘
         │                    │                           │
         │    chrome.runtime.sendMessage / onMessage      │
         └────────────────────┴───────────────────────────┘
                              │
                    chrome.storage.sync / .local
```

**Data flow for AI detection:**

1. Content script finds product images in the viewport.
2. `detection/pipeline.js` checks cache → remote (HF) → EXIF → heuristic.
3. Remote calls and image fetches go through the **service worker** (host permissions + auth headers).
4. Verdicts are cached in `chrome.storage.local`, badges rendered on cards.
5. Session stats flow to the popup and toolbar badge.

---

## Directory map

| Path | Role |
|------|------|
| `manifest.json` | MV3 entry point — permissions, content scripts, CSP |
| `background/service-worker.js` | Central message hub, HF detection, compare, badge, history |
| `content/content.js` | Main page orchestrator — scan, badges, observer, popup messages |
| `content/sites/*.js` | Per-marketplace DOM selectors (`window.RMF_SITE`) |
| `content/check-image.js` | Context-menu image check (injected on demand) |
| `detection/` | Detection pipeline modules (remote, EXIF, heuristic) |
| `compare/` | Cross-marketplace price compare (runs in service worker) |
| `popup/` | Four-tab shopping assistant UI |
| `options/` | Full settings page (history, import/export, legal) |
| `utils/` | Shared helpers (defaults, cache, strings, price, URLs) |
| `libs/exifr.min.js` | Vendored EXIF parser (lite UMD build) |
| `icons/` | Extension icons (16 / 48 / 128) |
| `scripts/validate.js` | Manifest + syntax + version validation |
| `test/unit/` | Node `node:test` unit tests |
| `test/e2e/` | Playwright extension tests |
| `web-ext-config.cjs` | Build ignore list for store zip |

---

## Extension contexts

### Popup (`popup/`)

Loaded when the user clicks the toolbar icon. Four tabs via bottom navigation:

| Tab | Primary files | Responsibility |
|-----|---------------|----------------|
| Scan | `popup.js` | Stats, rescan, export, HF connect, threshold |
| Compare | `compare-panel.js` | Cross-site search UI, sort/filter results |
| Tools | `popup.js` | Lens/Bing, copy details, share |
| Settings | `popup.js` | Quick prefs; links to full options page |

Scripts load in order defined by `popup.html`: shared utils → compare config → `compare-panel.js` → `popup.js`.

Popup talks to:
- **Content script** — `GET_STATS`, `GET_PRODUCT`, `RESCAN`, `SET_MODE`, etc. (routed to **active tab only** for tab-specific actions).
- **Service worker** — `RMF_VALIDATE`, `RMF_COMPARE_SEARCH`, `RMF_ENGINE_HEALTH`, `RMF_DETECT_DATA` (Tools drop zone).

### Content script (`content/`)

Injected on four marketplaces at `document_idle`. Load order in `manifest.json`:

1. `libs/exifr.min.js`
2. Shared utils (`defaults`, `marketplace-url`, `strings`, `logger`, `throttle`, `cache`)
3. Detection modules (`exif-check`, `tfjs-detector`, `remote`, `pipeline`)
4. Site configs (`content/sites/*.js`) — each sets `window.RMF_SITE` if hostname matches
5. `content/content.js` — exits immediately if `RMF_SITE` is unset

**Site config contract** (`window.RMF_SITE`):

```javascript
{
  name: 'myntra',              // used in stats, storage keys
  gridSelector: '.results-base',     // container for product cards
  cardSelector: '.product-base',     // individual product card
  imageSelector: 'img',              // image(s) within a card
  overlayTargetSelector: '...',      // where badges attach
  observeSelector: '.results-base',  // MutationObserver root
}
```

When a marketplace changes its DOM, update the matching file under `content/sites/`.

### Service worker (`background/service-worker.js`)

Long-lived (with MV3 sleep/wake). Uses `importScripts()` to load compare modules and shared utils — compare **must** run here because it performs cross-origin `fetch()` to marketplace search pages.

Responsibilities:
- Install/update defaults in `chrome.storage.sync`
- `RMF_FETCH_IMAGE` — fetch image bytes with SSRF guard
- `RMF_REMOTE_DETECT` / `RMF_DETECT_DATA` — Hugging Face inference
- `RMF_VALIDATE` — live HF token check via `whoami`
- `RMF_COMPARE_SEARCH` — orchestrate multi-site compare
- Toolbar badge, activity history, opt-in notifications
- Context menu → inject `check-image.js` on any page

### Options page (`options/`)

Full-page settings UI opened from popup or `chrome://extensions`. Shares the same storage keys as popup (`utils/defaults.js`).

---

## Message protocol

### Popup → content script (via `chrome.tabs.sendMessage`)

| Type | Purpose |
|------|---------|
| `GET_STATS` | Session scan counts for active tab |
| `GET_PRODUCT` | Extract title, price, brand, image from product page |
| `GET_PAGE_REPORT` | Exportable scan report for current page |
| `RESCAN` | Clear badges and re-run detection (uses cache) |
| `SET_MODE` | `all` / `badge` / `hide` display mode |
| `SET_ENABLED` | Toggle scanning on/off |
| `SET_MIN_CONFIDENCE` | User confidence floor |
| `HIGHLIGHT_FILTER` | Temporarily highlight AI cards |

### Any context → service worker (`chrome.runtime.sendMessage`)

| Type | Purpose |
|------|---------|
| `RMF_FETCH_IMAGE` | Fetch image URL → data URL (SSRF guarded) |
| `RMF_REMOTE_DETECT` | Run HF model on image URL |
| `RMF_DETECT_DATA` | Run HF on pasted/dropped data URL (Tools tab) |
| `RMF_VALIDATE` | Validate HF token |
| `RMF_ENGINE_HEALTH` | Provider status for popup UI |
| `RMF_BADGE` | Update toolbar badge count |
| `RMF_HISTORY_ADD` | Append flagged item to local history |
| `RMF_NOTIFY` | Trigger opt-in OS notification |
| `RMF_COMPARE_SEARCH` | Search product across marketplaces |
| `RMF_COMPARE_CACHE` | Load cached compare results |
| `RMF_GET_SELLERS` / `RMF_GET_CORRECTIONS` | Trust/correction data |
| `RMF_TOGGLE_ENABLED` | Keyboard shortcut handler |

Prefix `RMF_` is historical (RealModel Filter). New code should keep the prefix for consistency.

---

## Detection pipeline

File: `detection/pipeline.js` — entry point `window.RMF_Detect(imageUrl)`.

```
imageUrl
   │
   ├─ cache hit? ──────────────────────────────► return cached verdict
   │
   ├─ RMF_RemoteDetect (HF via service worker)
   │     ├─ success ───────────────────────────► cache 7d, return
   │     └─ error (token set but API failed) ───► cache 60s backoff, no badge
   │
   ├─ fetch image bytes (service worker)
   │
   ├─ RMF_ExifCheck
   │     └─ camera EXIF found ─────────────────► decisive "real", cache 7d
   │
   └─ RMF_TfjsDetector (canvas heuristic)
         └─ preview:true, flag only if ≥75% ──► cache 7d
```

**Badge tiers** (confidence = P(AI), 0–100):

| Range | Label |
|-------|-------|
| ≥ 90% (`AI_THRESHOLD`) | AI Generated (red) |
| `minConfidence`–89% | Likely AI (amber) |
| Below `minConfidence` | No badge |

Preview/heuristic results include `preview: true` in the result object.

---

## Compare module

Runs entirely in the service worker (`compare/search.js` orchestrates):

1. `utils/product-query.js` — build search query from product title/brand
2. Per-site search — SerpApi (if key set) or HTML scrape via `fetch`
3. `compare/parsers.js` — parse search result HTML
4. `utils/product-matcher.js` — score and rank candidates

Popup `compare-panel.js` sends `RMF_COMPARE_SEARCH` and renders results. Compare results cache in `chrome.storage.local` under `rmf_compare_*` keys.

---

## Storage model

| Store | Keys | Contents |
|-------|------|----------|
| `chrome.storage.sync` | Settings from `SYNC_DEFAULTS` | HF token, thresholds, site toggles, compare sites |
| `chrome.storage.local` | `rmf_cache_*` | Detection verdict cache (7-day TTL) |
| `chrome.storage.local` | `rmf_compare_*` | Compare search cache |
| `chrome.storage.local` | `rmf_history` | Activity history |
| `chrome.storage.local` | `rmf_corrections` | User "not AI" corrections |

Defaults and key names: `utils/defaults.js`.

---

## Module loading pattern

Shared modules use a **UMD-style IIFE** so the same file works in:

- Browser extension contexts (`window.RMF_*`)
- Node unit tests (`module.exports`)

Example from `utils/defaults.js`:

```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_Defaults = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  // ...
}));
```

Service worker modules use `importScripts()` instead of `<script>` tags.

---

## Testing architecture

| Layer | Location | Runner |
|-------|----------|--------|
| Validate | `scripts/validate.js` | `npm run validate` |
| Unit | `test/unit/*.test.cjs` | `npm run test:unit` (Node 20+) |
| E2E | `test/e2e/*.spec.cjs` | `npm test` (Playwright + real Chromium extension) |

E2E tests load the unpacked extension via `--load-extension`. Marketplace pages are mocked offline — see [test/e2e/README.md](../test/e2e/README.md).

---

## Build output

`npm run build` runs `web-ext build`, producing a zip in `dist/`. Dev-only paths are excluded via `web-ext-config.cjs` (tests, docs, `node_modules`, etc.).

---

## Related docs

- [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md) — why things are built this way
- [EDGE-CASES.md](EDGE-CASES.md) — failure modes and recovery
- [PRODUCTION-AUDIT.md](PRODUCTION-AUDIT.md) — release checklist
- [PRIVACY.md](PRIVACY.md) / [TERMS.md](TERMS.md) — legal copy shown in-app
