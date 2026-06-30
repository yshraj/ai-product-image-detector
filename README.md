# ShopShield — Chrome Extension

> **Shop smarter. Spot AI. Compare better.**

ShopShield is a **shopping assistant** for Indian e-commerce (Myntra, Flipkart, Meesho, Nykaa).
AI image detection is one tool in the kit — alongside price comparison, product utilities, and
export — so the extension stays useful even if you never scan for AI.

Manifest V3 · vanilla JS · no build step · runs fully client-side · _formerly RealModel Filter_.

## What it does

| Tab | Purpose |
|-----|---------|
| **Scan** | Scan product images on the page, show AI / Likely AI / Normal breakdown, confidence threshold, rescan, export |
| **Compare** | Search the current product on Amazon, Flipkart, Myntra, Meesho, Nykaa (opens marketplace search) |
| **Tools** | Google Lens & Bing visual search, copy title/details/URL, download image, share |
| **Settings** | AI detection engine, display mode, compare marketplace toggles, links to full settings |

The popup uses **bottom navigation** so scanning, comparing, and utilities are one click away.

## Features at a glance

### Shopping assistant
- **Compare** — one-tap search for the same product across marketplaces (from the product title).
- **Tools** — reverse image search, copy product details (title, brand, price, rating, seller, URL),
  copy/download image, native share sheet.
- **Compare marketplace toggles** — choose which sites appear in Compare (Settings tab).

### AI detection (one feature, not the whole product)
- **Inline badges** on product grids: ≥95% AI Generated · 70–94% Likely AI · `·preview` for heuristic.
- **"Why flagged?"** — click a badge for engine, model, confidence, plus Lens/Bing and search handoffs.
- **Toolbar badge counter** — AI-flagged count on the extension icon for the current tab.
- **Scan summary + rescan** in the Scan tab.
- **Export page report** — JSON or CSV of scanned products (name, price, verdict, confidence, engine, image URL).

### Settings & privacy
- **Full settings page** — detection prefs, per-site toggles, history, cache, import/export, legal text.
- **Activity history** — local log of flagged items (Settings page).
- **Opt-in notifications** — one quiet OS nudge per page when AI is found (off by default).
- **Two engines** — Hugging Face (accurate, free token) + on-device Preview; `Alt+Shift+R` shortcut.
- **Private by design** — no backend, no accounts, no tracking.

## Load it (developer mode)

1. Open Chrome → `chrome://extensions`
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked** → select this project folder
4. Pin the extension, then visit a category or product page on myntra.com / flipkart.com /
   meesho.com / nykaa.com
5. Open DevTools console and run `localStorage.RMF_DEBUG = '1'` then reload to see
   `[RMF]` debug logs.

## How detection works

Detection is **API-first** (`detection/pipeline.js`). Confidence = P(AI) on 0–100.

| Priority | Engine | File | Key | Accuracy |
|---|---|---|---|---|
| 1 | **Hugging Face** model (recommended) | `remote.js` + worker | free token | accurate |
| 2 | EXIF camera metadata | `exif-check.js` | none | decisive "real" only |
| 3 | On-device heuristic (**preview**) | `tfjs-detector.js` | none | low — fast & private |

When a Hugging Face token is connected it is **authoritative**. With no token, detection falls
back to the on-device heuristic, labelled **preview** in the badge and popup.

### Badge tiers

| Confidence | Badge | Colour |
|---|---|---|
| **≥ 95%** | 🤖 AI Generated | red |
| **70–94%** | ⚠️ Likely AI | amber |
| **< 70%** (default floor) | _no badge_ | — |

Raise **minimum confidence** in Settings for stricter, fewer flags.

### Connect Hugging Face (free)

Settings tab → Hugging Face → follow the 3-step stepper:

1. Create a free account at <https://huggingface.co/join>
2. **Read** token at <https://huggingface.co/settings/tokens>
3. Paste `hf_…` and press **Connect** (live `whoami` validation)

Default model: `haywoodsloan/ai-image-detector-deploy` (change under *Advanced → Model*).

> Detection uses `https://router.huggingface.co/hf-inference/models/<model>` (the legacy
> `api-inference` host returns HTTP 410).

### Keeping HF usage low

| Technique | Effect |
|---|---|
| **Viewport gating** | Only images scrolled into view are sent |
| **Per-URL cache** (7-day TTL) | Same image URL never sent twice |
| **Concurrency cap = 3** | No burst traffic |
| **Error backoff (60s)** | Rate limits don't hammer the API |

## Keyboard shortcut

**Alt+Shift+R** toggles AI scanning on/off (re-bindable at `chrome://extensions/shortcuts`).

## Settings page

Popup → **Settings** tab → **All settings & history**, or the extension Options page:

- Detection preferences (enable, display mode, confidence floor, per-marketplace toggles)
- Compare marketplace toggles (popup Settings tab)
- Activity history, cache stats, export/import settings, clear cache, reset
- Privacy Policy & Terms (also in [docs/PRIVACY.md](docs/PRIVACY.md) and [docs/TERMS.md](docs/TERMS.md))

## Layout

```
manifest.json
background/service-worker.js   remote detection, validation, badge, history, notifications
content/content.js             scan, overlays, GET_PRODUCT, messaging
content/sites/*.js             per-site selectors
detection/                     pipeline, remote, exif, heuristic
popup/                         four-tab shopping assistant UI
options/                       full settings page
utils/                         strings, cache, throttle, logger, report
test/e2e/                      Playwright extension tests (fixtures, helpers, POM)
scripts/validate.js            manifest + syntax check
```

## Tests

```bash
npm ci
npx playwright install --with-deps chromium   # first time

npm run validate      # manifest + file refs + JS syntax
npm run test:unit     # node:test (service worker, strings, report)
npm run test:e2e      # 69 Playwright specs (extension loaded in Chromium)
npm run test:headed   # watch E2E in a visible browser
npm run test:report   # open HTML report after a run
```

E2E tests load the unpacked extension, mock Myntra with a fixture, and cover:

- Installation, service worker, permissions, messaging between popup/content/background
- Popup (4-tab nav, HF connect), options page, shopping assistant (Compare/Tools)
- Content-script scanning, badges, labels, Hugging Face (mocked), error handling
- Storage persistence, keyboard shortcut, full user workflow, accessibility (axe-core)

See [test/e2e/README.md](test/e2e/README.md) for the test architecture.

CI (`.github/workflows/ci.yml`) runs validate + unit + e2e on every push/PR.

## Architecture

```
popup (4 tabs) ──messages──▶ service worker ──fetch──▶ Hugging Face
   │ GET_PRODUCT / GET_STATS     │  (CORS bypass, SSRF guard)
   ▼                               ▼
content script ──scan grid, badges, product extraction
   ▼
detection/pipeline.js  →  remote → EXIF → heuristic (preview)
utils: cache · throttle · strings · report
```

## Security & privacy

- **No backend, no telemetry.** Outbound calls: Hugging Face (if connected) and marketplace image CDNs.
- **Minimal permissions:** `activeTab`, `storage`, `scripting`, `notifications`.
- **Token stays on device** in `chrome.storage.sync` (your Chrome profile only).
- **SSRF hardening:** worker refuses loopback/private URLs.
- **Strict CSP** on extension pages (`script-src 'self'`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| No badges | Site CSS changed — update `content/sites/<site>.js` |
| Compare/Tools empty | Open a **product page** (not just a category grid) |
| Popup scan shows "unsupported" | Visit a supported marketplace tab first |
| HF "warming up" | Wait ~20s and rescan |
| Token rejected | New **Read** token at huggingface.co/settings/tokens |
| Stale badges after model change | **Clear cache** in Settings |

## Contributing

1. `npm ci && npx playwright install chromium`
2. Vanilla JS only — no build step.
3. `npm run validate && npm run test:unit && npm run test:e2e` before pushing.
4. Load unpacked at `chrome://extensions` to smoke-test on a real page.

## Updating exifr

```
curl -sL -o libs/exifr.min.js https://cdn.jsdelivr.net/npm/exifr/dist/lite.umd.js
```

See [docs/ROADMAP.md](docs/ROADMAP.md) for status and [CHANGELOG.md](CHANGELOG.md) for release notes.
