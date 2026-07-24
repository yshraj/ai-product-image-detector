# Chrome Web Store Listing — TrueKart

> Last Updated: 2026-07-04

## Store Listing

**Extension Name** [REQUIRED]
TrueKart — AI & Fake Photo Check

**Short Description** [REQUIRED]
Spot AI-generated & fake product photos on AliExpress, Temu, Shein, Amazon and more before you buy.

**Detailed Description** [REQUIRED]
TrueKart checks product photos on shopping sites and flags the ones that look AI-generated or fake, so you can judge a listing before you spend money — especially on marketplaces full of dropshipping and lookalike listings.

As you browse AliExpress, Temu, Shein, Amazon, Myntra, Flipkart, Meesho and Nykaa, TrueKart quietly scans the product images on the page and marks each one: AI generated, likely AI, or normal. A small badge appears on flagged photos, and the toolbar popup shows a summary for the whole page. Tap any badge to see why an image was flagged.

Why it matters: scam and dropshipping listings increasingly use AI-generated or stolen "hero" images that don't match what actually ships. A photo that looks synthetic is a useful signal to slow down, read reviews, and reverse-image-search before you buy. TrueKart is a signal, not a verdict — use it alongside reviews and ratings.

How to use it:
1. TrueKart scans automatically with the built-in on-device Preview engine — no setup required. For higher accuracy, click the TrueKart icon and connect a free Hugging Face detection model (takes about a minute, no payment).
2. Open any product or search page on a supported store — images are scanned automatically.
3. Use "Scan whole page" to check off-screen products, and adjust the flag threshold to your taste.
4. Tap a flagged badge → "Find identical" to reverse-image-search the photo on Google Lens or Bing.

Your privacy: TrueKart has no account and no servers of its own. Your settings sync only across your own browser profile, and detection results are cached locally on your device. When you connect Hugging Face, only the product image and your own access token are sent to Hugging Face to classify the image — nothing is sent to us.

Support & feedback: https://github.com/yshraj/ai-product-image-detector/issues

**Category** [REQUIRED]
Shopping

**Single Purpose** [REQUIRED]
Flags AI-generated or fake-looking product photos on supported shopping sites (AliExpress, Temu, Shein, Amazon, Myntra, Flipkart, Meesho, Nykaa) so shoppers can assess listings before buying.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ✅ Ready (popup Scan overview, no marketplace content needed) | `docs/promo/store-screenshot-popup-1280x800.png` |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ✅ Ready (popup Settings / Hugging Face connect, no marketplace content needed) | `docs/promo/store-screenshot-settings-1280x800.png` |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ **Not created — needs a real marketplace page, see below** | — |
| Small Promo Tile [RECOMMENDED] | 440×280 | ✅ Ready | `docs/promo/small-tile-440x280.png` |
| Marquee Promo Tile | 1400×560 | ✅ Ready | `docs/promo/marquee-1400x560.png` |

The promo tiles and Screenshots 1–2 are generated from the real extension UI
and brand tokens (`npm run generate-promo-assets`, `npm run
capture-screenshots` then `npm run generate-store-screenshot`) —
iconographic/UI-only, no marketplace content needed, so no live-site access
blocker applies to them. **Screenshot 3 — badges on a real product grid — is
the one CWS asset that genuinely cannot be produced from this environment**;
see the checklist at the bottom of this file.

### Screenshot Notes (use REAL listings, not test fixtures)
1. ⬜ An AliExpress or Temu search page with red "AI generated" / amber "Likely AI" badges on several product images — this is the money shot; pick a category with obvious synthetic hero images.
2. ✅ **Done** — the popup Scan panel showing the flag threshold and cached results: `docs/promo/store-screenshot-popup-1280x800.png`.
3. ⬜ The "Why flagged?" popover on a flagged image, including the "Find identical" reverse-image-search handoff — needs a real listing, same blocker as item 1.
4. ✅ **Done** — the Settings panel showing the Hugging Face connection: `docs/promo/store-screenshot-settings-1280x800.png`.

Regenerate 2 and 4 with `npm run capture-screenshots && npm run
generate-store-screenshot` after a popup UI change.

> Do not reuse the synthetic noise-square images in `research/accuracy-test/` — they read as fake. Capture real marketplace pages.
>
> Items 1 and 3 (badges/popover on a real listing) are the only remaining
> screenshot gaps, and both need a real marketplace page — they cannot be
> automated from this environment (blocked/unreliable network access to live
> marketplaces; see [docs/SELECTORS.md](docs/SELECTORS.md)).

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `activeTab` | permissions | Reads the page you're actively viewing (when you click the icon or trigger a scan) to find and analyze product images on it. |
| `storage` | permissions | Saves your settings (display mode, flag threshold, enabled sites) and caches detection results locally so pages aren't re-scanned. |
| `scripting` | permissions | Injects the image-scanning logic into supported marketplace pages, and runs the right-click "Check this image" check. |
| `tabs` | permissions | The popup looks up your currently-active marketplace tab by URL pattern (`chrome.tabs.query({url: ...})`) to show that tab's scan stats and route actions like Rescan / Scan whole page — this URL-pattern lookup needs the `tabs` permission even though the matched hosts are already covered by `host_permissions`. No browsing history is read; the extension only ever looks at tabs matching its own supported marketplace list. |
| `notifications` | permissions | Shows a single optional OS notification when AI images are found on a page (off by default). |
| `contextMenus` | permissions | Adds a right-click menu option to check a specific image on the page. |
| Marketplace page hosts — `aliexpress.com`, `aliexpress.us`, `temu.com`, `shein.com`, `sheinindia.in`, `amazon.com`/`.co.uk`/`.de`/`.in`/`.ca`/`.com.au`/`.fr`/`.it`/`.es`/`.co.jp`, `myntra.com`, `flipkart.com`, `meesho.com`, `nykaa.com` | host_permissions | Scanning product images on these shopping sites is the extension's core function. |
| `router.huggingface.co`, `huggingface.co`, `cdn-lfs.huggingface.co` | host_permissions | Sends the product image (with your own access token) to the Hugging Face model you connect, to classify whether a photo is AI-generated. |
| Image CDN hosts — `*.alicdn.com`, `*.kwcdn.com`, `*.ltwebstatic.com`, `*.media-amazon.com`, `*.ssl-images-amazon.com`, `assets.myntassets.com`, `*.flixcart.com`, `images.meesho.com`, `*.nykaa.com` | host_permissions | Fetches the product image bytes from each store's image CDN so they can be analyzed. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No (nothing is sent to the developer). Product images are transmitted to a third party (Hugging Face) only when you connect that engine, solely to classify the image.

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | — | No |
| Health info | No | No | — | No |
| Financial info | No | No | — | No |
| Authentication info | Stored locally only | To Hugging Face only | Your Hugging Face token authenticates your own API calls | No (only to Hugging Face, as your own request) |
| Personal communications | No | No | — | No |
| Location | No | No | — | No |
| Web history | No | No | — | No |
| User activity | No | No | — | No |
| Website content | Product image URLs/bytes | To Hugging Face (only with HF engine) | Classify whether the product photo is AI-generated | No (only to Hugging Face for classification) |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED — host before submitting]
https://github.com/yshraj/ai-product-image-detector/blob/main/docs/PRIVACY.md

<!-- docs/PRIVACY.md must be committed to the public repo (and its content must
     match the disclosure above and the in-extension Settings → Privacy text)
     before this URL will pass review. -->

## Distribution

**Visibility**: Public
**Regions**: All regions (product now works on global marketplaces — AliExpress, Temu, Shein, Amazon — as well as the Indian stores)

## Developer Info

**Publisher Name** [REQUIRED — fill in]
**Contact Email** [REQUIRED — fill in; shown publicly]
**Support URL / Email** [RECOMMENDED] https://github.com/yshraj/ai-product-image-detector/issues
**Homepage URL** [RECOMMENDED] https://github.com/yshraj/ai-product-image-detector

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.9.0 | 2026-07-25 | Relicensed to MIT; added the standard OSS trust surface (SECURITY.md, CONTRIBUTING.md, CoC, templates); published real accuracy numbers (docs/ACCURACY.md); Flipkart selectors live-fixed, Myntra/Nykaa hardened; SSRF guard IPv6 hardening; a11y (forced-colors, light-theme popover); store promo assets generated. See CHANGELOG.md for the full list. | Draft |
| 1.8.0 | 2026-07-04 | Expanded to global marketplaces (AliExpress, Temu, Shein, Amazon global + full Amazon.in scan); repositioned around AI/fake photo detection; optional on-device ONNX engine; removed the unshipped cross-marketplace "compare" experiment; trimmed store package from ~11 MB to ~120 KB. | Draft |

## Review Notes

### Known Issues / Limitations
- The built-in on-device "Preview" engine works with zero setup but is a heuristic, not a trained model — it's less accurate than the Hugging Face path. This is disclosed in the UI, and quantified honestly in [docs/ACCURACY.md](docs/ACCURACY.md). A fully-local, higher-accuracy ONNX engine is built but gated out of the default build (see docs/ONDEVICE.md).
- AliExpress, Temu, Shein, Amazon, and Meesho selectors are best-effort and haven't had a live re-check this pass (blocked from this automated environment — see docs/SELECTORS.md). Flipkart was live-validated and fixed 2026-07-25; Myntra and Nykaa were hardened defensively.
- HF token lives in `chrome.storage.sync`, not `.local` — tracked in SECURITY.md, not a silent gap.

### Pre-Submit Checklist
- [x] Manifest V3, no V2 APIs
- [x] Every permission + host_permission has a specific justification (above)
- [x] All declared permissions are actually used in code (verified)
- [x] 128×128 store icon exists (`icons/icon-128.png`)
- [x] Store package trimmed (128 KB — `npm run build`; verified 2026-07-25)
- [x] Small promo tile (440×280) + marquee tile (1400×560) ready
- [x] 2 of 3 screenshot slots ready (popup Scan + Settings, no marketplace content needed)
- [x] Flipkart selectors live-validated 2026-07-25; Myntra/Nykaa hardened defensively — see [docs/SELECTORS.md](docs/SELECTORS.md)
- [ ] AliExpress / Temu / Shein / Amazon / Meesho selectors still need a manual live check (blocked from this automated environment — anti-bot network restrictions, not a code issue)
- [ ] Privacy Policy URL live at the GitHub blob URL below — resolves once this repo's changes are pushed to `main`
- [ ] 1 more screenshot (badges on a REAL marketplace page — the one asset that must be captured manually)
- [ ] Publisher name + contact email filled in (below — maintainer decision, not something a repo change can supply)
