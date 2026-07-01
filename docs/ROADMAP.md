# TrueKart — Roadmap

_Last updated: 2026-06-30_

TrueKart is a **shopping assistant** for Indian e-commerce. AI detection is one tool;
compare, utilities, and trust signals are the long-term wedge.

---

## Current state (v1.3+)

| Area | Status | Notes |
|---|---|---|
| Four-tab popup (Scan / Compare / Tools / Settings) | ✅ Shipped | Bottom nav, shopping-first positioning |
| Compare — marketplace search handoffs | ✅ Shipped | Amazon, Flipkart, Myntra, Meesho, Nykaa |
| Tools — copy, share, reverse image search | ✅ Shipped | Product extraction via OG + JSON-LD |
| AI badges + "Why flagged?" popover | ✅ Shipped | HF + Preview engines |
| Export JSON/CSV, history, notifications | ✅ Shipped | |
| Settings page + popup quick settings | ✅ Shipped | |
| Hugging Face via router endpoint | ✅ Shipped | Live token validation |
| Playwright E2E (69 tests) | ✅ Shipped | Fixtures, helpers, CI |
| Site selectors | ⚠️ Fragile | Hashed CSS classes drift — re-check before store launch |

---

## Near term

- [ ] **Trust score** — composite signal (seller, reviews, return policy, AI image, discount)
  so the product feels like a shopping assistant, not only a detector.
- [x] **Live price comparison** — auto-search other marketplaces, score title/brand/price similarity, show best matches (v1.4).
- [ ] **Amazon.in** content-script support (Compare already links to Amazon search).
- [ ] Re-validate site selectors on live Myntra / Flipkart / Meesho / Nykaa pages.
- [ ] Chrome Web Store listing (screenshots, demo GIF, privacy review).

---

## Later

- [ ] Confidence heatmap on flagged images (à la Illuminarty).
- [ ] "Which generator?" labelling (needs Hive-class engine).
- [ ] More marketplaces (Ajio, Tata Cliq).
- [ ] Optional hosted proxy for zero-key free tier.
- [ ] Review summary, price history, wishlist export (Tools tab).

---

## Positioning

**Wedge:** "Shop smarter on the Indian marketplaces you already use."

- Hive/TruthScan = paste-an-image checkers; we work **in-context** on the product grid.
- SynthID = Google-watermarked images only.
- Coupon extensions = price focus; we combine **trust + compare + utilities**.

---

## Open decisions

1. **Store launch:** soft launch (unpacked) vs Chrome Web Store submission.
2. **Default HF model:** keep `haywoodsloan/ai-image-detector-deploy` or A/B alternatives.
3. **Zero-key tier:** bring-your-own HF token only vs hosted proxy (post-launch infra).

---

## Sources

See [research/competitor-analysis.md](../research/competitor-analysis.md) and
[research/feature-plan.md](../research/feature-plan.md) for background research.
