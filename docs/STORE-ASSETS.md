# Chrome Web Store — production assets

Ready-to-paste copy and asset specs for the listing. All text is written to match
the **actual shipped behavior** (see `manifest.json`, `FEATURES.md`) — no claims
the extension can't back up. Scanning works immediately with the built-in
on-device Preview engine; connecting a free Hugging Face model (or a full
build with on-device ONNX) increases accuracy, and the copy says so honestly
without undermining the free default.

> The permission justifications and privacy disclosure live in
> [CHROMEWEBSTORE.md](../CHROMEWEBSTORE.md); this file covers marketing assets.

---

## 1. Title (≤ 75 chars)

```
TrueKart — AI & Fake Photo Check
```

## 2. Short description (≤ 132 chars)

```
Spot AI-generated & fake product photos on AliExpress, Temu, Shein, Amazon and more before you buy.
```
(98 chars.)

## 3. Long description

```
Online stores are flooding with AI-generated and stolen "hero" photos — especially on marketplaces full of dropshipping and lookalike listings. TrueKart flags product images that look AI-generated while you browse, so you can slow down and check before you spend.

WHAT IT DOES
• Scans product images on the page and marks each one: AI generated, likely AI, or normal.
• Puts a small badge on flagged photos and a page summary in the toolbar popup.
• Tap any badge for "Why flagged?" — the confidence, the engine used, and a one-tap reverse image search (Google Lens / Bing) to find where the photo really came from.
• "Scan whole page" checks off-screen products; a threshold slider tunes how strict flagging is.

WHERE IT WORKS
AliExpress, Temu, Shein, Amazon (global), Myntra, Flipkart, Meesho, and Nykaa.

HONEST ABOUT ACCURACY
TrueKart is a signal, not a verdict. Use it alongside reviews, ratings, and seller history. Scanning works out of the box with the built-in on-device Preview engine; connect a free Hugging Face model in one step (no payment) for higher accuracy. Even the best free detectors miss some AI images, so treat a flag as "look closer," not "proof."

PRIVATE BY DESIGN
• No account. No servers of ours. No analytics, ads, or tracking.
• Settings sync only across your own browser profile; results are cached locally.
• With Hugging Face connected, only the product image and your own token go to Hugging Face to classify it — nothing is sent to us.

FREE & OPEN SOURCE
No subscription, no paywall. MIT licensed, source on GitHub. If it saves you from a bad buy, there's an optional "Support us" link — never a nag.

Questions or a wrong flag? https://github.com/yshraj/ai-product-image-detector/issues
```

## 4. Keywords / search terms (informal — CWS has no keyword field; use these in the description & for ASO)

`AI image detector`, `fake product photos`, `AI photo checker`, `AliExpress scam`, `Temu fake`, `Shein`, `dropshipping checker`, `reverse image search shopping`, `is this photo AI`, `AI-generated image detector`, `online shopping safety`.

Primary phrase to rank for: **"AI image detector for shopping."**

## 5. Screenshots (1280×800 recommended; min 1, up to 5)

Capture on **real** marketplace pages (never the `research/accuracy-test/` fixtures).

| # | Scene | Caption (overlay text) |
|---|-------|------------------------|
| 1 | AliExpress or Temu search grid with red "AI Generated" + amber "Likely AI" badges on several cards | "See which product photos are AI-generated — as you browse." |
| 2 | Popup Scan panel: AI generated / Likely AI / Normal counts after a scan | "A clear per-page summary in one click." |
| 3 | "Why flagged?" popover open on a flagged image, showing confidence + "Find identical" | "Tap any badge to see why — and reverse-image-search it." |
| 4 | Popup Settings: Hugging Face connected, threshold slider | "Free, accurate detection in one step. No account with us." |
| 5 | Options page: privacy/data section + per-site toggles | "Private by design: no servers, no tracking, all local." |

## 6. Small promo tile — 440×280 PNG

✅ **Done:** [`docs/promo/small-tile-440x280.png`](promo/small-tile-440x280.png)
(`npm run generate-promo-assets`). Icon on the brand gradient, wordmark +
tagline, no marketplace content — matches the spec below as originally written:

- Left: TrueKart magnifier-check icon on the brand teal→green gradient.
- Right: wordmark "TrueKart" + tagline "Spot AI & fake product photos."
- No screenshots of real brands; keep it iconographic. High contrast, ≥ 4.5:1 text.

## 7. Marquee promo tile — 1400×560 PNG (optional but boosts featuring)

✅ **Done:** [`docs/promo/marquee-1400x560.png`](promo/marquee-1400x560.png)
(same script). Used a badge-tier callout row + headline instead of a dimmed
device frame (no synthetic "fake grid" mockup that could itself read as a
misleading screenshot) — same brand gradient, same message:

- ~~Centered device/browser frame showing scene #1 (badged grid), dimmed.~~ (skipped — see above)
- Foreground: "Is this product photo real?" → "TrueKart tells you before you buy."
- Brand gradient background; logo bottom-left.

## 8. Feature graphic specification

✅ Satisfied by the same marquee tile (item 7) — same 1400×560 asset, headline
≤6 words, brand gradient, no competitor logos or guaranteed-detection claims.

- **Aspect:** 1400×560, safe area centered (avoid 60px edges).
- **Palette:** brand teal `#0FA36B`→green gradient, near-white text `#F8FAFC`.
- **Type:** one headline (≤ 6 words) + one sub. System/Inter, bold headline.
- **Do not** imply guaranteed detection or show competitor logos.

## 9. Demo GIF storyboard (≤ 15s, silent, loop)

1. (0–3s) Cursor on an AliExpress search page; badges pop in on 3–4 photos.
2. (3–7s) Click a red badge → "Why flagged?" popover expands (92% · Hugging Face).
3. (7–11s) Click "Find identical" → Google Lens opens in a new tab (cut before results).
4. (11–15s) Toolbar popup opens showing the "3 of 20 look AI" summary. Loop.

Caption card at end: "TrueKart — free, private AI photo check."

## 10. Demo video storyboard (30–45s, YouTube, for the listing link)

| Time | Visual | Voiceover / caption |
|------|--------|---------------------|
| 0–5s | Marketplace scroll, several too-perfect photos | "Half these product photos might not be real." |
| 5–12s | Install → pin → open a Temu/AliExpress page; badges appear | "TrueKart flags AI-generated photos as you browse." |
| 12–20s | Click badge → Why flagged → reverse image search | "See why, and trace where the photo actually came from." |
| 20–30s | Settings: connect Hugging Face (free) in one step | "Free, accurate detection — no account, nothing sent to us." |
| 30–40s | Options privacy section | "Private by design. A signal to shop smarter — always check reviews too." |
| 40–45s | Logo + store CTA | "TrueKart. Free on the Chrome Web Store." |

Disclosure to include verbatim: "TrueKart is a detection aid, not a guarantee."

## 11. FAQ (for the listing + support page)

**Does it work automatically?** Yes — open a supported store's product or search page and images are scanned as they come into view. Use "Scan whole page" for off-screen items.

**Do I need a Hugging Face token?** No — the built-in Preview engine scans locally with zero setup. A free Hugging Face model gives higher accuracy if you want it. Creating a read token is free and takes a minute; images go directly from your browser to Hugging Face, never to us. (A full/on-device build can get the same accuracy boost with no token at all — see docs/ONDEVICE.md.)

**Is it 100% accurate?** No. Even the best free detectors miss some AI images and can occasionally misjudge a real photo. Treat a flag as "look closer," and use reviews/ratings too. You can lower/raise the flag threshold, and mark a flag "Not AI" to dismiss it. Real, reproducible accuracy numbers (not marketing copy): docs/ACCURACY.md.

**Do you collect my data?** No. No account, no servers of ours, no analytics or tracking. Settings sync only in your own browser profile; results cache locally.

**Which sites are supported?** AliExpress, Temu, Shein, Amazon (global), Myntra, Flipkart, Meesho, Nykaa. More can be added — request one via the issues link.

**Badges stopped showing on a site.** The store likely changed its page layout. Please file an issue; selector fixes are quick. See docs/SELECTORS.md.

**Is it free?** Yes, completely. There's an optional "Support us" link (in the popup and Settings) and nothing is gated behind it.

**Is this open source?** Yes — MIT licensed, source on GitHub. Contributions welcome, especially fixing a marketplace selector after a site redesign (the most common maintenance need). See CONTRIBUTING.md.

**How accurate is it, really?** See docs/ACCURACY.md for real numbers from a reproducible benchmark — not a marketing claim. Short version: the free on-device mode is a convenience layer, not something to rely on alone; connecting Hugging Face (free, ~1 minute) gets you a detector with zero false alarms on our test set.

## 12. Support page content (host at the GitHub issues URL / a simple page)

```
TrueKart Support

• Report a bug or a wrong flag: open an issue with the site, the product URL, and a screenshot.
• Request a new marketplace: open an issue titled "Site request: <name>".
• Privacy: see docs/PRIVACY.md — no data is sent to us.
• Connecting Hugging Face: Settings → Hugging Face → paste a free read token from huggingface.co/settings/tokens.
Response time: best-effort, this is an indie project.
```

## 13. Release notes (store "What's new")

```
1.9.0
• Now MIT-licensed, fully open source.
• Real, published accuracy numbers — see the "Accuracy" link in the listing.
• More reliable badges on Flipkart after a site redesign; hardened against future ones on Myntra and Nykaa too.
• Clearer, more honest messaging about the free on-device scan mode.
• Accessibility: Windows High Contrast support, light-theme "Why flagged?" popover.
```

```
1.8.0
• Now works on AliExpress, Temu, Shein and Amazon (global) — not just Indian stores.
• Repositioned around spotting AI-generated & fake product photos on scam-prone marketplaces.
• Much smaller, faster install.
• New: optional fully on-device detection (no token, nothing leaves your device) in advanced builds.
• Clearer "Why flagged?" details and reverse-image-search handoff.
```
