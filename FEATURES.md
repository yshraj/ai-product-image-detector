# TrueKart — current features

Chrome extension that flags AI-generated / fake product photos on AliExpress,
Temu, Shein, Amazon (global), Myntra, Flipkart, Meesho, and Nykaa.

**Engines:** Hugging Face (accurate, free token) · on-device Preview heuristic
(fast, low-accuracy, default) · optional fully-local ONNX model (opt-in, no
token — see [docs/ONDEVICE.md](docs/ONDEVICE.md)).

## Popup (2 tabs)

| Tab | What it does |
|-----|----------------|
| **Scan** | Flags product images as AI-generated / likely AI / normal. Threshold slider, rescan, **Scan whole page**, export JSON/CSV. |
| **Settings** | HF token, display mode, confidence, notifications. |

A persistent **Buy me a coffee** support footer sits above the bottom nav on
every open (all tabs/states). The target is provider-agnostic — set
`SUPPORT.url` in `utils/defaults.js` (Buy Me a Coffee / GitHub Sponsors / Ko-fi
/ Stripe / Lemon Squeezy / Polar / Patreon / custom); no popup change needed.

## Scan

1. Content script finds product cards + images on supported sites.
2. Service worker runs Hugging Face API (or on-device preview heuristic).
3. Badges on page; popup shows counts. Cache avoids re-detecting same image.
4. **Scan whole page** — scanning is viewport-gated to keep API volume low, so
   only visible products are analysed until you scroll. When scannable products
   remain off-screen, the Scan tab shows a "Scan whole page · N more" control
   that scrolls the page (loading lazy images) and force-scans every card, then
   restores your scroll position.

The "Why flagged?" popover on each badge shows the confidence and engine, plus
one-tap **reverse image search** (Google Lens / Bing) and **search elsewhere**
links — pure URL handoffs, no backend.

> A cross-marketplace "Similar products / price compare" experiment was removed
> in 1.8.0 (unreliable, unshipped, and heavy). The extension is now
> single-purpose: AI/fake product-photo detection.

## Key files

- `content/content.js` — scan orchestration, badges, "why flagged?" popover
- `content/sites/*.js` — per-marketplace selectors ([docs/SELECTORS.md](docs/SELECTORS.md))
- `background/service-worker.js` — HF/on-device detection, image fetch, badge, history
- `detection/pipeline.js` — remote → EXIF → heuristic priority
- `detection/ondevice/*` + `offscreen/detector.js` — opt-in local ONNX engine ([docs/ONDEVICE.md](docs/ONDEVICE.md))
- `popup/`, `options/` — UI
