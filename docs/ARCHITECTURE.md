# Architecture — TrueKart

TrueKart is a **Manifest V3 Chrome extension** written in **vanilla JavaScript**. There is no bundler, transpiler, or runtime npm dependency — the repository root is the extension source tree.

**Architectural invariant:** No TrueKart backend. All logic runs in the user's browser. Optional BYOK (Hugging Face, SerpApi) sends traffic directly from the extension to those third parties.

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
│  Settings       │  Inject badges        │  Image fetch (SSRF guard)     │
│                 │  Extract product info │  Badge, history, notifications│
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
| `background/service-worker.js` | Central message hub, HF detection, badge, history |
| `content/content.js` | Main page orchestrator — scan, badges, observer, popup messages |
| `content/sites/*.js` | Per-marketplace DOM selectors (`window.RMF_SITE`) |
| `content/check-image.js` | Context-menu image check (injected on demand) |
| `detection/` | Detection pipeline modules (remote, EXIF, heuristic) |
| `detection/ondevice/` | Opt-in local ONNX engine (download, cache, engine) — see [ONDEVICE.md](ONDEVICE.md) |
| `offscreen/detector.*` | Offscreen ONNX Runtime session (opt-in) |
| `popup/` | Two-tab UI (Scan + Settings) |
| `options/` | Full settings page (history, import/export, legal) |
| `utils/` | Shared helpers (defaults, cache, strings, URLs) |
| `libs/exifr.min.js` | Vendored EXIF parser (lite UMD build) |
| `icons/` | Extension icons (16 / 48 / 128) |
| `scripts/validate.js` | Manifest + syntax + version validation |
| `test/unit/` | Node `node:test` unit tests |
| `test/e2e/` | Playwright extension tests |
| `web-ext-config.cjs` | Build ignore list for store zip |

---

## Extension contexts

### Popup (`popup/`)

Loaded when the user clicks the toolbar icon. Two tabs via bottom navigation:

| Tab | Primary files | Responsibility |
|-----|---------------|----------------|
| Scan | `popup.js` | Stats, rescan, export, HF connect, threshold |
| Settings | `popup.js` | Quick prefs; links to full options page |

Scripts load in order defined by `popup.html`: shared utils → `popup.js`.

Popup talks to:
- **Content script** — `GET_STATS`, `RESCAN`, `SET_MODE`, `SCAN_PAGE`, etc. (routed to **active tab only** for tab-specific actions).
- **Service worker** — `RMF_VALIDATE`, `RMF_ENGINE_HEALTH`, `RMF_ONDEVICE_*` (on-device model control).

### Content script (`content/`)

Injected on four marketplaces at `document_idle`. Load order in `manifest.json`:

1. `libs/exifr.min.js`
2. Shared utils (`defaults`, `strings`, `logger`, `throttle`, `cache`)
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

Long-lived (with MV3 sleep/wake). Uses `importScripts()` for shared utils
(`defaults`) and the opt-in on-device engine (`ondevice-config`, `model-store`,
`download-manager`, `engine`).

Responsibilities:
- Install/update defaults in `chrome.storage.sync`
- `RMF_FETCH_IMAGE` — fetch image bytes with SSRF guard
- `RMF_REMOTE_DETECT` / `RMF_DETECT_DATA` — Hugging Face **or** on-device inference (payload size capped)
- `RMF_VALIDATE` — live HF token check via `whoami`
- `RMF_ONDEVICE_*` — on-device model download/status/delete (see [ONDEVICE.md](ONDEVICE.md))
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
| `GET_PAGE_REPORT` | Exportable scan report for current page |
| `RESCAN` | Clear badges and re-run detection (uses cache) |
| `SCAN_PAGE` | Scan the whole page — scrolls to load lazy images and force-scans off-screen cards past the viewport gate |
| `SET_MODE` | `all` / `badge` / `hide` display mode |
| `SET_ENABLED` | Toggle scanning on/off |
| `SET_MIN_CONFIDENCE` | User confidence floor |
| `HIGHLIGHT_FILTER` | Temporarily highlight AI cards |

### Any context → service worker (`chrome.runtime.sendMessage`)

| Type | Purpose |
|------|---------|
| `RMF_FETCH_IMAGE` | Fetch image URL → data URL (SSRF guarded) |
| `RMF_REMOTE_DETECT` | Run HF model on image URL |
| `RMF_DETECT_DATA` | Run HF on a data URL (context-menu image check) |
| `RMF_VALIDATE` | Validate HF token |
| `RMF_ENGINE_HEALTH` | Provider status for popup UI |
| `RMF_BADGE` | Update toolbar badge count |
| `RMF_HISTORY_ADD` | Append flagged item to local history |
| `RMF_NOTIFY` | Trigger opt-in OS notification |
| `RMF_ONDEVICE_STATUS` / `RMF_ONDEVICE_START` / `RMF_ONDEVICE_CANCEL` / `RMF_ONDEVICE_DELETE` | On-device model control |
| `RMF_TOGGLE_ENABLED` | Keyboard shortcut handler |

All worker handlers reject messages where `sender.id !== chrome.runtime.id`.

Prefix `RMF_` is historical (RealModel Filter). New code should keep the prefix for consistency.

---

## Detection pipeline

File: `detection/pipeline.js` — entry point `window.RMF_Detect(imageUrl)`.

> The "remote" step is provider-aware: with `provider: 'huggingface'` it calls
> Hugging Face; with `provider: 'ondevice'` the service worker fetches the image
> bytes and delegates to the local ONNX engine (`detection/ondevice/*` +
> `offscreen/detector.js`). If the on-device model/runtime isn't available it
> returns `noProvider`, so the pipeline falls through to EXIF/heuristic exactly
> as below. See [ONDEVICE.md](ONDEVICE.md). Marketplace selectors:
> [SELECTORS.md](SELECTORS.md).

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

## On-device engine (opt-in)

When `provider: 'ondevice'`, the service worker fetches the image bytes and
delegates classification to a local ONNX model running in an offscreen document.
Weights are downloaded once (resumable) and cached in IndexedDB; the ONNX Runtime
WASM is bundled. Full design, activation, and validation: **[ONDEVICE.md](ONDEVICE.md)**.

---

## Storage model

| Store | Keys | Contents |
|-------|------|----------|
| `chrome.storage.sync` | Settings from `SYNC_DEFAULTS` | HF token, thresholds, site toggles, on-device model URL |
| `chrome.storage.local` | `rmf_cache_*` | Detection verdict cache (7-day TTL) |
| `chrome.storage.local` | `rmf_history` | Activity history |
| `chrome.storage.local` | `rmf_corrections` | User "not AI" corrections |
| IndexedDB `rmf_ondevice` | `models` / `partials` | On-device model weights + resumable download state |

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
