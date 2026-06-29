# RealModel Filter — Chrome Extension

Detects AI-generated product images on Indian e-commerce sites (Myntra, Flipkart,
Meesho, Nykaa) and overlays a confidence badge on each detected image.

Manifest V3 · vanilla JS · no build step · runs fully client-side.

## Features at a glance

- **Inline badges** on product grids with tiers (≥95% AI · 70–94% Likely AI · `·preview`).
- **Toolbar badge counter** — glanceable count of AI-flagged items on the current tab.
- **Page scan summary + rescan** in the popup ("N of M look AI (P%)").
- **Export page report** — download all scanned products (name, price, verdict, confidence,
  engine, model, image) as **JSON or CSV**, fully on-device.
- **"Why flagged?" details** — click any badge for engine, model, confidence and a plain
  explanation (radical transparency, keyboard/screen-reader accessible), plus one-tap
  **reverse image search** (Google Lens / Bing) and **"search elsewhere"** (Amazon / Flipkart /
  Google) handoffs.
- **Activity history** — a local, on-device log of flagged items (Settings page).
- **Opt-in notifications** — one quiet OS nudge per page when AI is found (off by default).
- **Two engines** — Hugging Face (accurate, free token) + on-device Preview; per-site toggles,
  confidence threshold, `Alt+Shift+R` shortcut.
- **Private by design** — no backend, no accounts, no tracking; minimal permissions.

## Load it (developer mode)

1. Open Chrome → `chrome://extensions`
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked** → select this project folder
4. Pin the extension, then visit a category page on myntra.com / flipkart.com /
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

Two engines: **Hugging Face** (accurate, free token) and **Preview** (on-device
heuristic, no key). When a Hugging Face token is connected it is **authoritative**.
With no token, detection falls back to the on-device heuristic, which is clearly
labelled **preview** in the badge and popup — fast and private but **not accurate**
(false positives + misses).

### Badge tiers

A card is badged based on its AI confidence (P(AI), 0–100), with the flag floor
tunable in Settings:

| Confidence | Badge | Colour |
|---|---|---|
| **≥ 95%** | 🤖 AI Generated | red |
| **70–94%** | ⚠️ Likely AI | amber |
| **< 70%** (default floor) | _no badge_ | — |

Raise the **minimum confidence** in Settings for stricter, fewer flags. Preview
(heuristic) badges are additionally marked `·preview` so they're never mistaken for
a real model verdict.

### Why the heuristic alone is not enough

Real catalog photos and AI renders both tend to have flat studio backgrounds, so a
pixel heuristic can't reliably separate them. The accurate path is a trained model —
which is exactly what the Hugging Face engine provides.

### Connect Hugging Face (free, in-extension)

The popup walks you through it ("How to get a free key"):

1. Create a free account at <https://huggingface.co/join>
2. Open <https://huggingface.co/settings/tokens> → **New token**, role **Read**
3. Copy the `hf_…` token, paste it in the popup, press **Connect**. The token is
   **validated live** against Hugging Face (`whoami`) — you'll see ✅ *Connected as
   <user>* or a clear error (invalid token, rate-limited, etc.) immediately.
4. Default model is `haywoodsloan/ai-image-detector-deploy` (changeable under
   *Advanced → Model*). The first scan can take ~20s while the model warms up (HF
   returns 503 + ETA; the worker retries automatically).

> **Endpoint note:** detection calls go to the current Hugging Face inference
> router — `https://router.huggingface.co/hf-inference/models/<model>`. The legacy
> `api-inference.huggingface.co` host was retired (returns HTTP 410) and is no
> longer used.

### Optimizing Hugging Face usage (keeping calls low)

The hf-inference *image-classification* endpoint takes **one image per request** —
there is no multi-image batch for this task, so the lever is *how many requests we
make*, not batching. We minimise calls without touching detection accuracy:

| Technique | Effect |
|---|---|
| **Viewport gating** (`content.js`) | Only images you actually scroll into view are sent. Off-screen cards are deferred — the biggest reduction in call volume. |
| **Per-URL cache** (`utils/cache.js`, 7-day TTL) | The same image URL is never sent twice (scroll-back, revisits, re-renders are free). |
| **Concurrency cap = 3** | At most 3 detections in flight, so a page never bursts. |
| **Error backoff (60s)** | On a 429/503/5xx we cache "inconclusive" for only 60s — we don't hammer a rate-limited model but recover quickly. |
| **Cold-start retry** | A warming model (HTTP 503) is retried up to 3× with the ETA HF returns. |

**Config:** model is `haywoodsloan/ai-image-detector-deploy` by default (change under
*Advanced → Model* in the popup; stored as `hfModel`). Free-tier limits are
credits-based and not a fixed req/hour; the techniques above keep a normal browsing
session well within them. HF **PRO** ($9/mo) raises the ceiling for power users.

### Choosing a model & accuracy reality

**Free detectors are imperfect on studio e-commerce photos.** Catalog images (clean
seamless backgrounds, even lighting, heavy retouching) share visual statistics with
AI renders, so detectors trained on "photos vs diffusion art" over-flag them.
Independent benchmarks put the old default `Organika/sdxl-detector` at **~60% accuracy
with a ~17% false-positive rate** — on professional studio shots it can flag almost
everything.

> **Important:** a model only works here if it's **served by the free hf-inference
> tier** (`inference: warm` on its HF page). Many strong detectors (SigLIP/DINOv2,
> FSD, OmniAID) are custom checkpoints that are *not* served and will just error.

The model picker (*Advanced → Model*) lists **served** classifiers you can A/B:

| Model | Notes |
|---|---|
| `haywoodsloan/ai-image-detector-deploy` | **New default.** Swinv2, most-used served detector, built for deployment. |
| `Nahrawy/AIorNot` | Swin classifier, served. |
| `Organika/sdxl-detector` | Old default; over-flags studio photography. |
| `umm-maybe/AI-image-detector` | Older baseline. |

Switching a model **auto-clears the detection cache** (cached verdicts are keyed by
image URL and would otherwise replay the old model's results) — just press **Connect**
and reload. Even the best *free* model has a few-percent false-positive rate on
professional studio photography; for trustworthy accuracy the roadmap's premium engine
(Hive-class, ~94%) is the real answer.

### API keys / `.env`

Still **no `.env` file** — keys are entered in the popup and stored in
`chrome.storage.sync`, never hard-coded or shipped. All authenticated API calls run
in the **service worker** (it has `host_permissions`, so it bypasses page CORS).

## Display modes (popup)

- **Show All** / **Badge Only** — keep AI cards visible with their badge
- **Hide AI** — remove AI-flagged cards from the grid

**Keyboard shortcut:** press **Alt+Shift+R** to toggle detection on/off without
opening the popup (re-bindable at `chrome://extensions/shortcuts`).

## Settings page

A full settings surface (popup → **Settings**, or the extension's *Options*) adds:

- **Detection preferences** (autosave, applied live): master enable, display mode,
  **minimum confidence to flag** (50–95%, default **70%** — raise it for stricter,
  fewer badges), and **per-marketplace toggles** (run only on the sites you want).
- **Opt-in notifications:** one quiet OS notification per page when AI is found (off by default).
- **Activity history:** a local, on-device log of recently flagged items (thumbnail, verdict,
  score, site, time, page link) with a clear action.
- **Data & privacy:** local cache stats, **export/import settings** (JSON, token never
  included), **clear cache**, and **reset all settings**.
- **About & help:** version, keyboard shortcut, links to Help/Changelog/Feedback/Source,
  and the in-app **Privacy Policy** and **Terms of Use** (also in
  [docs/PRIVACY.md](docs/PRIVACY.md) and [docs/TERMS.md](docs/TERMS.md)).

All preferences live in `chrome.storage.sync`; the content script reacts to changes
instantly via `chrome.storage.onChanged` (no page reload needed).

## Layout

```
manifest.json
background/service-worker.js   defaults, remote detection, validation, health, migration
content/
  content.js                  scan, viewport-gate, overlay, MutationObserver, prefs sync
  content.css                 badge + bar styles
  sites/*.js                  per-site selectors (each guards on hostname)
detection/
  exif-check.js  tfjs-detector.js  remote.js  pipeline.js
popup/
  popup.html  popup.css  popup.js   toolbar UI: engine connect, modes, stats
options/
  options.html  options.css  options.js   full settings page (prefs, data, legal)
utils/
  strings.js  logger.js  throttle.js  cache.js   (strings = shared UI copy)
scripts/validate.js           build/lint check (manifest refs + JS syntax)
test/  e2e/*.spec.cjs  unit/*.test.cjs
libs/exifr.min.js             vendored EXIF parser
icons/                        16 / 48 / 128
docs/  PRIVACY.md  TERMS.md  ROADMAP.md  realmodel-filter-dev-guide.md
research/  competitor-analysis.md  feature-plan.md
```

## Tests

Playwright e2e loads the unpacked extension into Chromium, intercepts `myntra.com`
with a fixture, and serves images **cross-origin with no CORS header** (production-like).

```
npm run validate    # manifest + referenced files + JS syntax
npm run test:unit   # node:test units for pure service-worker helpers
npm test            # all e2e specs (headless)
npm run test:headed # watch in a real browser
```

- `extension.spec` — preview engine discriminates AI vs real; viewport gating defers
  off-screen cards; infinite scroll scans revealed cards; badges expose `role`/`aria-label`
- `huggingface.spec` — with a token set, the **HF model verdict** is used (mocked at the
  `router.huggingface.co` endpoint, asserts 97% → "AI Generated", not the heuristic's 92%)
- `huggingface-error.spec` — a failing engine shows **no** preview badge and records the error
- `labels.spec` — badge tiers: 97% → AI Generated, 92% → Likely AI, 60% → no badge
- `preferences.spec` — confidence threshold, per-site disable, live updates, and that
  corrupt/malformed stored settings never break detection
- `popup.spec` — SaaS UI: engine-status pill, provider tabs, onboarding stepper,
  **live token validation** (success + rejection), AI-or-Not removed, ARIA roles; saves
  `popup-*.png` to `test-results/`
- `options.spec` — settings page: preferences autosave/persist, data controls, reset, legal
- `badge.spec` — toolbar badge equals the on-page AI count; rescan keeps it consistent;
  pausing clears it
- `history.spec` — flagged items are logged to the activity history and can be cleared
- `notifications.spec` — opt-in notification fires when enabled, stays silent when off
- `details.spec` — badge-click "why flagged?" popover opens/closes; one at a time; Escape closes
- `labels.spec` — badge tiers: 97% → AI Generated, 92% → Likely AI, 60% → no badge
- `a11y.spec` — axe-core audit (WCAG 2 A/AA) of the **popup and options page**
- `test/unit/service-worker.test.cjs` — URL SSRF allowlist, HF response parsing (incl.
  real-photo → low-score direction), error mapping
- `test/unit/strings.test.cjs` — shared user-facing strings (formatting/pluralisation)

CI runs `validate` + unit + e2e on every push/PR (`.github/workflows/ci.yml`).

## Notes & limitations

- **The on-device heuristic is preview-grade and will misclassify** — it is a fallback,
  not the product. Accuracy comes from connecting Hugging Face.
- Site selectors use hashed CSS-module classes that change over time — re-identify in
  DevTools and update `content/sites/<site>.js` if badges stop appearing.
- A local TF.js model can be wired via the `window.RMF_LOAD_TFJS_MODEL(tf)` hook in
  `tfjs-detector.js` if you want fully on-device accurate inference later.

## Architecture

```
popup (UI) ──messages──▶ service worker ──fetch──▶ Hugging Face
   ▲                          │  (Authorization headers; bypasses page CORS)
   │ chrome.storage.sync      │
   │ (prefs, token)           ▼
content script ──messages──▶ image bytes / remote verdict
   │  scan grid, MutationObserver, inject badge overlay
   ▼
detection/pipeline.js  →  remote model → EXIF → on-device heuristic (preview)
utils: cache (storage.local, TTL + eviction) · throttle · logger
```

- **Detection is API-first.** A configured remote model is authoritative; EXIF gives a
  decisive "real" only when real camera metadata is present; the on-device heuristic is a
  clearly-labelled *preview* fallback used only when no engine is connected.
- **All authenticated network calls run in the service worker** (it holds `host_permissions`,
  so it isn't subject to page CORS). Content scripts never see the token.
- **Results are cached per image URL** in `chrome.storage.local` (7-day TTL, size-capped).
  A transient remote failure is cached for only 60s so a connected engine recovers cleanly
  instead of being pinned to a stale preview verdict.

See [docs/realmodel-filter-dev-guide.md](docs/realmodel-filter-dev-guide.md) for the full spec
and [docs/ROADMAP.md](docs/ROADMAP.md) for status & competitor research.

## Security & privacy

- **No backend, no telemetry.** Everything runs client-side. The only outbound calls are to the
  detection provider you connect (Hugging Face) and the images on the page you're
  browsing. Permissions are minimal (`activeTab`, `storage`, `scripting`, `notifications`) with
  host access limited to the four marketplaces, their image CDNs, and the Hugging Face API —
  no `cookies`, no `webRequest`, no all-sites access (unlike most shopping extensions).
- **Your token stays on your machine** in `chrome.storage.sync` (it syncs across your own Chrome
  profile only). It is never hard-coded, bundled, or sent anywhere except the provider's API as a
  bearer token. We deliberately do **not** ship a shared key (it would be scraped and banned).
- **SSRF/proxy hardening:** the worker only fetches public `http(s)` URLs and refuses
  loopback/private/link-local addresses (e.g. `127.0.0.1`, `10.x`, `192.168.x`, `169.254.169.254`).
- **No `innerHTML`/`eval`:** injected badges are built with `createElement`/`textContent`, and the
  extension pages run under a strict CSP (`script-src 'self'`).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No badges on a category page | Site changed its CSS-module class names | Re-identify selectors in DevTools, update `content/sites/<site>.js` |
| Popup shows **Error** with "warming up" | HF model cold start (first scan ~20s) | Wait and rescan/scroll — it retries automatically |
| Popup shows "Token rejected" | Token lacks Inference access, or is wrong | Recreate a **Read** token at huggingface.co/settings/tokens |
| Everything is **Preview** despite a token | Token not verified (older saved state) | Re-open popup → **Connect** to re-validate |
| Badges look stale after fixing the model | Old verdicts cached | **Clear cache** in the popup footer |
| Debug logs | — | In the page console: `localStorage.RMF_DEBUG = '1'`, then reload |

## Contributing

1. `npm ci` then `npx playwright install chromium`.
2. Make changes; keep it vanilla JS with **no build step**.
3. Run the gates locally before pushing: `npm run validate && npm run test:unit && npm test`.
4. Add/adjust tests for any behaviour change (unit for pure logic, Playwright for UI/flows).
5. Load the unpacked extension (`chrome://extensions` → *Load unpacked*) to smoke-test on a real
   marketplace page. CI must be green to merge.

## Updating exifr

The vendored copy is `exifr/dist/lite.umd.js`. To refresh:

```
curl -sL -o libs/exifr.min.js https://cdn.jsdelivr.net/npm/exifr/dist/lite.umd.js
```
