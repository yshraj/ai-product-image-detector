# ShopShield — Chrome Extension

> **Shop smarter. Spot AI. Compare better.**

ShopShield is a **shopping assistant** for Indian e-commerce (Myntra, Flipkart, Meesho, Nykaa). AI image detection is one tool in the kit — alongside price comparison, product utilities, and export.

Manifest V3 · vanilla JavaScript · no build step · runs fully client-side · _formerly RealModel Filter_.

---

## Table of contents

- [What it does](#what-it-does)
- [Quick start (users)](#quick-start-users)
- [Developer guide](#developer-guide)
  - [Prerequisites](#prerequisites)
  - [Clone and install](#clone-and-install)
  - [Load the extension](#load-the-extension)
  - [Development workflow](#development-workflow)
  - [Debugging](#debugging)
  - [Project structure](#project-structure)
- [Architecture](#architecture)
- [Testing](#testing)
- [Build and release](#build-and-release)
- [Security and privacy](#security-and-privacy)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## What it does

| Tab | Purpose |
|-----|---------|
| **Scan** | Scan product images, show AI / Likely AI breakdown, confidence threshold, rescan, export |
| **Compare** | Search the current product across Amazon, Flipkart, Myntra, Meesho, Nykaa |
| **Tools** | Google Lens & Bing visual search, copy title/details/URL, download image, share |
| **Settings** | AI engine, display mode, compare toggles, links to full settings |

### AI detection highlights

- **Inline badges** on product grids: ≥90% AI Generated · 70–94% Likely AI · `·preview` for heuristic mode
- **Two engines** — Hugging Face (accurate, free token) + on-device Preview heuristic
- **Private by design** — no backend, no accounts, no tracking

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

## Quick start (users)

1. Install from the Chrome Web Store _(when published)_ **or** load unpacked (developers — see below).
2. Pin the extension in the toolbar.
3. Visit a category or product page on [myntra.com](https://www.myntra.com), [flipkart.com](https://www.flipkart.com), [meesho.com](https://www.meesho.com), or [nykaa.com](https://www.nykaa.com).
4. Open the popup — use **Scan**, **Compare**, or **Tools** as needed.

**Connect Hugging Face (recommended for accurate detection):** Settings tab → paste a free Read token from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) → Connect.

**Keyboard shortcut:** `Alt+Shift+R` toggles scanning (rebind at `chrome://extensions/shortcuts`).

---

## Developer guide

Everything below is what you need to clone the repo, run the extension locally, and execute the full test suite — no other docs required.

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 20+ | Matches CI (`.github/workflows/ci.yml`) |
| **npm** | 9+ | Ships with Node |
| **Google Chrome** | Recent stable | For loading unpacked extension and E2E tests |

### Clone and install

```bash
git clone https://github.com/yshraj/ai-product-image-detector.git
cd ai-product-image-detector
npm ci
```

`npm ci` installs **dev dependencies only** (`@playwright/test`, `@axe-core/playwright`, `web-ext`). There are no runtime npm packages — the extension runs from source files in the repo root.

**First-time E2E setup** — install the Playwright Chromium browser:

```bash
npx playwright install --with-deps chromium
```

### Load the extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** → select the **repository root folder** (the one containing `manifest.json`)
4. Confirm ShopShield appears with version **1.7.0**

**Alternative — auto-reload during development:**

```bash
npm start
```

This runs `web-ext run --target chromium`, which opens Chrome with the extension loaded and reloads on file changes.

### Development workflow

1. Edit source files directly (no compile step).
2. After changes to **content scripts** or **service worker**, click the reload icon on `chrome://extensions` (or use `npm start` for automatic reload).
3. Run validation and tests before pushing:

```bash
npm run validate      # manifest, file refs, JS syntax, version sync
npm run test:unit     # 37 Node unit tests
npm test              # 78 Playwright E2E tests
```

4. Smoke-test on a real marketplace page with the unpacked extension.

**Updating a marketplace selector** (badges stop appearing after a site redesign):

Edit the matching file under `content/sites/` (e.g. `myntra.js`) — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#content-script-content).

**Refreshing the vendored EXIF library:**

```bash
npm run refresh-exifr
```

### Debugging

| Context | How to debug |
|---------|--------------|
| **Content script** | DevTools on the marketplace tab → Console. Filter `[RMF]` |
| **Service worker** | `chrome://extensions` → ShopShield → "Service worker" link |
| **Popup** | Right-click popup → Inspect |
| **Verbose logs** | On a marketplace tab console: `localStorage.RMF_DEBUG = '1'` then reload |

Debug logging is gated in `utils/logger.js` — production users see no `info`/`warn`/`debug` output unless they opt in.

### Project structure

```
manifest.json                 MV3 manifest (permissions, content scripts, CSP)
background/service-worker.js  HF detection, compare, badge, history, image fetch
content/
  content.js                  Scan orchestration, badges, popup messaging
  sites/*.js                  Per-marketplace DOM selectors
  check-image.js              Context-menu image check
detection/                    Pipeline: remote → EXIF → heuristic
compare/                      Cross-marketplace search (loaded in service worker)
popup/                        Four-tab UI (Scan / Compare / Tools / Settings)
options/                      Full settings page
utils/                        Shared modules (defaults, cache, strings, price, …)
libs/exifr.min.js             Vendored EXIF parser
icons/                        16 / 48 / 128 px icons
scripts/validate.js           Manifest + syntax validation
test/unit/                    Node unit tests
test/e2e/                     Playwright extension tests
web-ext-config.cjs            Files excluded from store zip
```

---

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

**Detection priority** (`detection/pipeline.js`):

| Priority | Engine | When |
|----------|--------|------|
| 1 | Hugging Face | User connected a token — authoritative |
| 2 | EXIF metadata | Decisive "real" when camera EXIF present |
| 3 | Canvas heuristic | Preview mode when no HF token; tagged `preview: true` |

**Badge tiers:** ≥90% AI Generated (red) · 70–94% Likely AI (amber) · below user floor: no badge.

Full module reference, message protocol, and storage model: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

Design rationale: **[docs/DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md)**

---

## Testing

### Commands

```bash
npm run validate        # manifest + file refs + JS syntax + version + no debugger
npm run lint            # alias for validate
npm run test:unit       # Node unit tests (compare, matcher, SSRF, strings, …)
npm test                # all Playwright E2E tests (78 specs)
npm run test:e2e        # same as npm test
npm run test:headed     # E2E with visible browser (HEADLESS=0)
npm run test:report     # open HTML report after a failed run
```

### What the tests cover

| Suite | Count | Scope |
|-------|-------|-------|
| Unit | 37 | Compare search, product matcher, SSRF guard, HF parsing, defaults, URLs |
| E2E | 78 | Extension load, popup (4 tabs), options, scanning, badges, HF (mocked), compare, a11y, workflow |

E2E tests load the **real unpacked extension** in Chromium. Marketplace pages and Hugging Face are **mocked offline** — no API keys or network required.

Test architecture details: **[test/e2e/README.md](test/e2e/README.md)**

### CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR to `main`:

```
npm ci → validate → test:unit → playwright install → test:e2e
```

---

## Build and release

### Create a store zip

```bash
npm run build
```

Output: `dist/shopshield_shopping_assistant-1.7.0.zip` (~110 KB, 54 files).

`web-ext-config.cjs` excludes dev files (`test/`, `docs/`, `node_modules/`, etc.) from the package.

### Pre-release checklist

```bash
npm ci
npm run validate
npm run test:unit
npm test
npm run build
```

Before bumping version, update **both** `package.json` and `manifest.json` — `npm run validate` fails if they diverge.

Full release audit: **[docs/PRODUCTION-AUDIT.md](docs/PRODUCTION-AUDIT.md)**

Upload the zip to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## Security and privacy

- **No backend, no telemetry.** Outbound calls: Hugging Face (if connected), marketplace CDNs, optional SerpApi.
- **Permissions:** `activeTab`, `storage`, `scripting`, `tabs`, `notifications`, `contextMenus` — scoped host permissions per marketplace.
- **HF token** stored in `chrome.storage.sync` (Chrome profile only); never exported.
- **SSRF guard** on image fetches in the service worker.
- **CSP** on extension pages: `script-src 'self'`.

Legal copy: [docs/PRIVACY.md](docs/PRIVACY.md) · [docs/TERMS.md](docs/TERMS.md)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No badges on a site | Site DOM changed — update `content/sites/<site>.js` |
| Compare/Tools empty | Open a **product page**, not a category listing |
| Popup shows "unsupported" | Switch to a supported marketplace tab first |
| HF "warming up" | Wait ~20s and rescan (model cold start) |
| Token rejected | Create a new **Read** token at huggingface.co/settings/tokens |
| Stale badges after model change | **Clear cache** in Settings |
| E2E tests fail locally | Run `npx playwright install --with-deps chromium` |
| `validate` version error | Sync `version` in `package.json` and `manifest.json` |

Failure modes and recovery: **[docs/EDGE-CASES.md](docs/EDGE-CASES.md)**

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Module map, message protocol, detection pipeline, storage |
| [docs/DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md) | Why vanilla JS, HF in worker, preview fallback, etc. |
| [docs/EDGE-CASES.md](docs/EDGE-CASES.md) | Invalid inputs, network failures, extension reloads |
| [docs/PRODUCTION-AUDIT.md](docs/PRODUCTION-AUDIT.md) | Release readiness checklist |
| [test/e2e/README.md](test/e2e/README.md) | Playwright test architecture |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [docs/PRIVACY.md](docs/PRIVACY.md) / [docs/TERMS.md](docs/TERMS.md) | In-app legal text |

---

## Contributing

1. Fork and clone the repo.
2. `npm ci && npx playwright install --with-deps chromium`
3. Make changes in vanilla JS — match existing patterns (UMD modules, `RMF_` prefixes).
4. `npm run validate && npm run test:unit && npm test` must pass.
5. Load unpacked at `chrome://extensions` and smoke-test on a marketplace page.
6. Open a pull request against `main`.

**Code conventions:**
- Shared settings and storage keys live in `utils/defaults.js`
- User-facing strings live in `utils/strings.js`
- Per-marketplace DOM selectors live in `content/sites/<name>.js`
- No `console.log` in shipped code — use `RMF_Log` (gated) or remove before merge

See [docs/ROADMAP.md](docs/ROADMAP.md) for planned work.
