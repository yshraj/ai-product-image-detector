# TrueKart — current features

Chrome extension for Indian marketplaces (Myntra, Flipkart, Meesho, Nykaa; Amazon limited).

## Popup (2 tabs)

| Tab | What it does |
|-----|----------------|
| **Scan** | Flags product images as AI-generated / likely AI / normal. Threshold slider, rescan, **Scan whole page**, export JSON/CSV. |
| **Settings** | HF token, display mode, confidence, notifications. |

## Scan

1. Content script finds product cards + images on supported sites.
2. Service worker runs Hugging Face API (or on-device preview heuristic).
3. Badges on page; popup shows counts. Cache avoids re-detecting same image.
4. **Scan whole page** — scanning is viewport-gated to keep API volume low, so
   only visible products are analysed until you scroll. When scannable products
   remain off-screen, the Scan tab shows a "Scan whole page · N more" control
   that scrolls the page (loading lazy images) and force-scans every card, then
   restores your scroll position.

> **Similar products / compare** (cross-marketplace search + CLIP image scoring)
> is parked, not shipped in the current popup. The `compare/`, `offscreen/`, and
> `popup/compare-panel.js` modules and their tests remain for a future release;
> a unit test asserts `compare/search.js` is not imported by the service worker.

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
