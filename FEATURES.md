# TrueKart — current features

Chrome extension for Indian marketplaces (Myntra, Flipkart, Meesho, Nykaa; Amazon limited).

## Popup (3 tabs)

| Tab | What it does |
|-----|----------------|
| **Scan** | Flags product images as AI-generated / likely AI / normal. Threshold slider, rescan, export JSON/CSV. |
| **Similar products** | Finds the same or similar item on other marketplaces. Auto-searches on tab open. |
| **Settings** | HF token, display mode, marketplace toggles, optional SerpApi key. |

## Scan

1. Content script finds product cards + images on supported sites.
2. Service worker runs Hugging Face API (or on-device preview heuristic).
3. Badges on page; popup shows counts. Cache avoids re-detecting same image.

## Similar products

**Input:** product title, brand, price, color (DOM + title parse), image URL from the active PDP.

**Search:** SerpApi Google Shopping (if key set) or direct marketplace search pages → up to 25 candidates per site.

**Text score (local, no API):** title parsed into brand, color, pattern, fit, gender, etc. Weights: brand 25%, title 20%, attributes 20%, color 15%, pattern 10%. Brand mismatch caps score at 45%; color/pattern/fit mismatches apply penalties.

**Image score:** CLIP (offscreen, local ONNX WASM) on top 15 text candidates only. Images fetched via service worker to avoid CORS.

**Output:** top 10 ranked results with % match, ✔/✖/— breakdown, price band. Manual search links if nothing close.

## Key files

- `content/content.js` — scan + product extraction
- `compare/search.js` — orchestration
- `compare/similarity.js` — scoring
- `compare/attribute-parser.js` — title → attributes
- `popup/compare-panel.js` — Similar products UI
