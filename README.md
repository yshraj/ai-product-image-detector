# TrueKart — Chrome Extension

[![CI](https://github.com/yshraj/ai-product-image-detector/actions/workflows/ci.yml/badge.svg)](https://github.com/yshraj/ai-product-image-detector/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/github/package-json/v/yshraj/ai-product-image-detector)](CHANGELOG.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> **Spot AI & fake product photos before you buy.**

TrueKart is a **Chrome extension** that flags AI-generated and fake-looking product photos while you shop — on **AliExpress, Temu, Shein, Amazon** (global), plus **Myntra, Flipkart, Meesho, Nykaa**. It's most useful on scam-prone, dropshipping-heavy marketplaces where "hero" photos are often synthetic or stolen. TrueKart is a *signal*, not a verdict — use it alongside reviews and ratings.

Manifest V3 · vanilla JavaScript · no build step · runs fully client-side · _formerly ShopShield / RealModel Filter_.

---

## Table of contents

- [Screenshots](#screenshots)
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
- [License](#license)

---

## Screenshots

<table>
<tr>
<td width="50%">

**Popup — Scan tab, zero setup**<br/>
Works immediately with the built-in on-device Preview engine.

<img src="docs/screenshots/03-popup-scan-preview.png" width="320" alt="TrueKart popup Scan tab in preview mode, showing the flag threshold slider and cached results" />

</td>
<td width="50%">

**"Why flagged?" — full transparency**<br/>
Confidence %, engine used, and a per-layer breakdown on every flagged image.

<img src="docs/screenshots/02-why-flagged-popover.png" width="320" alt="Why flagged popover showing 92% AI confidence, engine breakdown, and reverse image search actions" />

</td>
</tr>
</table>

**Options — full settings, all local**

<img src="docs/screenshots/05-options-page.png" width="640" alt="TrueKart options page showing detection engine status, preferences, active marketplaces, and data & privacy controls" />

> Screenshots are captured from the real extension against the same offline
> test fixtures the E2E suite uses (`npm run capture-screenshots` to
> regenerate after a UI change) — see [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md)
> for the live-marketplace screenshots used in the actual store listing.

---

## What it does

| Tab | Purpose |
|-----|---------|
| **Scan** | Scan product images, show AI / Likely AI breakdown, confidence threshold, rescan, **scan whole page**, export |
| **Settings** | AI engine (Hugging Face / Preview), display mode, notifications, links to full settings |

> Right-click any image on a supported page and choose **Check this image** for a one-off AI verdict (context menu).

### AI detection highlights

- **Inline badges** on product grids: ≥90% AI Generated · 70–94% Likely AI · `·preview` for heuristic mode
- **Three engines** — Hugging Face (accurate, free token) · on-device Preview heuristic (fast, low-accuracy) · optional fully local ONNX model ([docs/ONDEVICE.md](docs/ONDEVICE.md), no token, nothing leaves your device)
- **Private by design** — no backend, no accounts, no tracking
- **Supported sites** — AliExpress, Temu, Shein, Amazon (global), Myntra, Flipkart, Meesho, Nykaa ([docs/SELECTORS.md](docs/SELECTORS.md))

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

## Quick start (users)

1. Install from the Chrome Web Store _(when published)_ **or** load unpacked (developers — see below).
2. Pin the extension in the toolbar.
3. Visit a category or product page on a supported store — [aliexpress.com](https://www.aliexpress.com), [temu.com](https://www.temu.com), [shein.com](https://www.shein.com), [amazon.com](https://www.amazon.com) (and other Amazon regions), [myntra.com](https://www.myntra.com), [flipkart.com](https://www.flipkart.com), [meesho.com](https://www.meesho.com), or [nykaa.com](https://www.nykaa.com).
4. Open the popup — use **Scan** or **Settings** as needed.

**Connect Hugging Face (recommended for accurate detection):** Settings tab → paste a free Read token from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) → Connect.

**Keyboard shortcut:** `Alt+Shift+R` toggles scanning (rebind at `chrome://extensions/shortcuts`).

---

## Developer guide

Everything below is what you need to clone the repo, run the extension locally, and execute the full test suite — no other docs required.

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 22+ | Matches CI (`.github/workflows/ci.yml`) |
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
4. Confirm TrueKart appears with version **1.9.0**

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
npm run lint          # ESLint + validate (manifest, file refs, JS syntax, version sync)
npm run test:unit     # Node unit tests
npm test              # Playwright E2E tests (offline mocks)
```

4. Smoke-test on a real marketplace page with the unpacked extension.

**Updating a marketplace selector** (badges stop appearing after a site redesign):

Edit the matching file under `content/sites/` (e.g. `myntra.js`) — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#content-script-content).

**Refreshing the vendored EXIF library:**

```bash
npm run refresh-exifr
```

**Regenerating README/docs screenshots** (after a popup/options/badge UI change):

```bash
npm run capture-screenshots      # → docs/screenshots/*.png
```

Runs against the same offline E2E fixtures as the test suite — no live network,
no real marketplace needed. See [scripts/capture-screenshots.cjs](scripts/capture-screenshots.cjs).

### Debugging

| Context | How to debug |
|---------|--------------|
| **Content script** | DevTools on the marketplace tab → Console. Filter `[RMF]` |
| **Service worker** | `chrome://extensions` → TrueKart → "Service worker" link |
| **Popup** | Right-click popup → Inspect |
| **Verbose logs** | On a marketplace tab console: `localStorage.RMF_DEBUG = '1'` then reload |

Debug logging is gated in `utils/logger.js` — production users see no `info`/`warn`/`debug` output unless they opt in.

### Project structure

```
manifest.json                 MV3 manifest (permissions, content scripts, CSP)
background/service-worker.js  HF/on-device detection, badge, history, image fetch
content/
  content.js                  Scan orchestration, badges, popup messaging
  sites/*.js                  Per-marketplace DOM selectors
  check-image.js              Context-menu image check
detection/                    Pipeline: remote → EXIF → heuristic
detection/ondevice/           Opt-in local ONNX engine (download, cache, engine)
offscreen/detector.*          Offscreen ONNX Runtime session (opt-in)
popup/                        Two-tab UI (Scan / Settings)
options/                      Full settings page
utils/                        Shared modules (defaults, cache, strings, …)
libs/exifr.min.js             Vendored EXIF parser
icons/                        16 / 48 / 128 px icons
scripts/validate.js           Manifest + syntax validation
test/unit/                    Node unit tests
test/e2e/                     Playwright extension tests
web-ext-config.mjs            Files excluded from store zip
```

---

## Architecture

```
popup (2 tabs) ──messages──▶ service worker ──fetch──▶ Hugging Face / on-device ONNX
   │ GET_STATS / RESCAN          │  (CORS bypass, SSRF guard)
   ▼                               ▼
content script ──scan grid, badges, "why flagged?"
   ▼
detection/pipeline.js  →  remote → EXIF → heuristic (preview)
utils: cache · throttle · strings · report
```

**Detection priority** (`detection/pipeline.js`):

| Priority | Engine | When |
|----------|--------|------|
| 1 | Hugging Face **or** on-device ONNX | User's selected `provider` — authoritative ([docs/ONDEVICE.md](docs/ONDEVICE.md)) |
| 2 | EXIF metadata | Decisive "real" when camera EXIF present |
| 3 | Canvas heuristic | Preview mode when no engine configured; tagged `preview: true` |

**Badge tiers:** ≥90% AI Generated (red) · 70–94% Likely AI (amber) · below user floor: no badge.

Full module reference, message protocol, and storage model: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

Design rationale: **[docs/DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md)**

---

## Testing

### Commands

```bash
npm run validate        # manifest + file refs + JS syntax + version + no debugger
npm run eslint          # ESLint (flat config)
npm run lint            # ESLint + validate
npm run test:unit       # Node unit tests (defaults, cache, marketplace-url, ondevice, SSRF, HF parsing, …)
npm test                # Playwright E2E tests (offline mocks)
npm run test:e2e        # same as npm test
npm run test:headed     # E2E with visible browser (HEADLESS=0)
npm run test:report     # open HTML report after a failed run
```

### What the tests cover

| Suite | Scope |
|-------|-------|
| **Unit** (`test:unit`) | Defaults, cache, marketplace-url guards, on-device config + sha-256, service-worker SSRF guard + HF parsing, strings |
| **E2E** (`npm test`) | Extension load, popup, options, scanning, badges, "why flagged?", export, history, SPA re-scan, permissions, storage, a11y — **offline** |

Default E2E tests load the **real unpacked extension** in Chromium. Marketplace pages and Hugging Face are **mocked offline** — no API keys required.

Test architecture details: **[test/e2e/README.md](test/e2e/README.md)**.

### CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR to `main`:

```
npm ci → eslint → validate → test:unit → playwright install → test:e2e
```

---

## Build and release

### Create a store zip

```bash
npm run build
```

Output: `dist/truekart_ai_fake_photo_check-1.9.0.zip` (~120 KB). The optional on-device engine's ONNX Runtime (`libs/onnx/`, `offscreen/`) is excluded from the default lean build via `web-ext-config.mjs`; enabling on-device detection includes it — see [docs/ONDEVICE.md](docs/ONDEVICE.md).

`web-ext-config.mjs` excludes dev files (`test/`, `docs/`, `node_modules/`, etc.) from the package.

### Pre-release checklist

```bash
npm ci
npm run validate
npm run test:unit
npm test
npm run build
```

Before bumping version, update **both** `package.json` and `manifest.json` — `npm run validate` fails if they diverge.

Upload the zip to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Permission justifications and store listing copy: [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md).

---

## Security and privacy

- **No backend, no telemetry.** Outbound calls: Hugging Face (only if connected), marketplace image CDNs, and — only if on-device is enabled — the model-weights download URL you configure.
- **Permissions:** `activeTab`, `storage`, `scripting`, `tabs`, `notifications`, `contextMenus` — scoped host permissions per marketplace. See [SECURITY.md](SECURITY.md) for the full threat model and [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md) for the per-permission justification.
- **HF token** stored in `chrome.storage.sync` (your Chrome account only, never sent to TrueKart); always excluded from settings export.
- **SSRF guard** on image fetches in the service worker; the on-device model URL must be https.
- **CSP** on extension pages: `script-src 'self' 'wasm-unsafe-eval'`.

Legal copy: [docs/PRIVACY.md](docs/PRIVACY.md) · [docs/TERMS.md](docs/TERMS.md)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No badges on a site | Site DOM changed — update `content/sites/<site>.js` (see [docs/SELECTORS.md](docs/SELECTORS.md)) |
| Popup shows "unsupported" | Switch to a supported marketplace tab first |
| HF "warming up" | Wait ~20s and rescan (model cold start) |
| Token rejected | Create a new **Read** token at huggingface.co/settings/tokens |
| Stale badges after model change | **Clear cache** in Settings |
| E2E tests fail locally | Run `npx playwright install --with-deps chromium` |
| `validate` version error | Sync `version` in `package.json` and `manifest.json` |

---

## Documentation

| Document | Description |
|----------|-------------|
| [FEATURES.md](FEATURES.md) | Short reference for current popup tabs and logic |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Module map, message protocol, detection pipeline, storage |
| [docs/ONDEVICE.md](docs/ONDEVICE.md) | On-device ONNX engine: architecture, activation, validation |
| [docs/SELECTORS.md](docs/SELECTORS.md) | Per-marketplace selector contract + live verification protocol |
| [docs/STORE-ASSETS.md](docs/STORE-ASSETS.md) | Chrome Web Store listing copy + asset specs |
| [docs/DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md) | Why vanilla JS, HF in worker, preview fallback, etc. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Current state and near-term plans |
| [docs/ACCURACY.md](docs/ACCURACY.md) | Real, reproducible detection accuracy numbers and methodology |
| [SECURITY.md](SECURITY.md) | Threat model and vulnerability disclosure |
| [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) | Licenses of redistributed third-party components |
| [test/e2e/README.md](test/e2e/README.md) | Playwright test architecture |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [docs/PRIVACY.md](docs/PRIVACY.md) / [docs/TERMS.md](docs/TERMS.md) | In-app legal text |
| [docs/archive/](docs/archive/) | Historical audits from earlier versions (not current) |

---

## Contributing

Contributions are welcome — see **[CONTRIBUTING.md](CONTRIBUTING.md)** for setup, code
conventions, and how to add or fix a marketplace (the most common contribution). Please
also read the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues go to
[SECURITY.md](SECURITY.md), not a public issue.

See [docs/ROADMAP.md](docs/ROADMAP.md) for planned work. Issues labelled
[`good first issue`](https://github.com/yshraj/ai-product-image-detector/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
are the easiest place to start — verifying and fixing a marketplace's selectors
needs no machine-learning background, just a browser and a real shopping page.

---

## License

TrueKart is released under the **[MIT License](LICENSE)** — free to use, modify,
distribute and sell, including commercially, with attribution.

By contributing you agree your contributions are licensed under the same terms
(see [CONTRIBUTING.md](CONTRIBUTING.md#license)). There is no CLA and no
copyright assignment: contributors keep copyright in their own work, and the
project stays MIT.

Third-party components redistributed with the extension are listed with their
licenses in **[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)**.
