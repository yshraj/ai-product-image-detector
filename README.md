# RealModel Filter — Chrome Extension

Detects AI-generated product images on Indian e-commerce sites (Myntra, Flipkart,
Meesho, Nykaa) and overlays a confidence badge on each detected image.

Manifest V3 · vanilla JS · no build step · runs fully client-side.

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
| 1 | **AI or Not** API | `remote.js` + worker | paid (small free tier) | accurate |
| 2 | EXIF camera metadata | `exif-check.js` | none | decisive "real" only |
| 3 | On-device heuristic (**preview**) | `tfjs-detector.js` | none | low — fast & private |

When a model key is set it is **authoritative**. With no key, detection falls back
to the on-device heuristic, which is clearly labelled **preview** in the badge and
popup — it is fast and private but **not accurate** (false positives + misses).

### Why the heuristic alone is not enough

Real catalog photos and AI renders both tend to have flat studio backgrounds, so a
pixel heuristic can't reliably separate them. The accurate path is a trained model —
which is exactly what the Hugging Face engine provides.

### Connect Hugging Face (free, in-extension)

The popup walks you through it ("How to get a free key"):

1. Create a free account at <https://huggingface.co/join>
2. Open <https://huggingface.co/settings/tokens> → **New token**, role **Read**
3. Copy the `hf_…` token, paste it in the popup, press **Connect**
4. Default model is `Organika/sdxl-detector` (changeable under *Model (advanced)*).
   The first scan can take ~20s while the model warms up (HF returns 503 + ETA; the
   worker retries automatically).

### API keys / `.env`

Still **no `.env` file** — keys are entered in the popup and stored in
`chrome.storage.sync`, never hard-coded or shipped. All authenticated API calls run
in the **service worker** (it has `host_permissions`, so it bypasses page CORS).

## Display modes (popup)

- **Show All** / **Badge Only** — keep AI cards visible with their badge
- **Hide AI** — remove AI-flagged cards from the grid

## Layout

```
manifest.json
background/service-worker.js   defaults on install
content/
  content.js                  scan, overlay, MutationObserver, popup messaging
  content.css                 badge + bar styles
  sites/*.js                  per-site selectors (each guards on hostname)
detection/
  exif-check.js  tfjs-detector.js  remote.js  pipeline.js
utils/
  logger.js  throttle.js  cache.js
libs/exifr.min.js             vendored EXIF parser
icons/                        16 / 48 / 128
```

## Tests

Playwright e2e loads the unpacked extension into Chromium, intercepts `myntra.com`
with a fixture, and serves images **cross-origin with no CORS header** (production-like).

```
npm test            # all e2e specs (headless)
npm run test:headed # watch in a real browser
```

- `extension.spec` — preview engine discriminates AI vs real; infinite scroll scans new cards
- `huggingface.spec` — with a token set, the **HF model verdict** is used (mocked, asserts 97% from HF, not the heuristic's 92%)
- `popup.spec` — SaaS UI: engine-status pill, provider switching, HF onboarding, token validation; saves `popup-*.png` screenshots to `test-results/`

## Notes & limitations

- **The on-device heuristic is preview-grade and will misclassify** — it is a fallback,
  not the product. Accuracy comes from connecting Hugging Face (or AI or Not).
- Site selectors use hashed CSS-module classes that change over time — re-identify in
  DevTools and update `content/sites/<site>.js` if badges stop appearing.
- A local TF.js model can be wired via the `window.RMF_LOAD_TFJS_MODEL(tf)` hook in
  `tfjs-detector.js` if you want fully on-device accurate inference later.

## Updating exifr

The vendored copy is `exifr/dist/lite.umd.js`. To refresh:

```
curl -sL -o libs/exifr.min.js https://cdn.jsdelivr.net/npm/exifr/dist/lite.umd.js
```
