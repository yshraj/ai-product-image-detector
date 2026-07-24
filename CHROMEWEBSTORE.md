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
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | — |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | — |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | — |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | — |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | — |

### Screenshot Notes (use REAL listings, not test fixtures)
1. An AliExpress or Temu search page with red "AI generated" / amber "Likely AI" badges on several product images — this is the money shot; pick a category with obvious synthetic hero images.
2. The popup Scan panel showing the AI generated / Likely AI / Normal breakdown after a scan.
3. The "Why flagged?" popover on a flagged image, including the "Find identical" reverse-image-search handoff.
4. The Settings panel showing the Hugging Face connection + display modes.

> Do not reuse the synthetic noise-square images in `research/accuracy-test/` — they read as fake. Capture real marketplace pages.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `activeTab` | permissions | Reads the page you're actively viewing (when you click the icon or trigger a scan) to find and analyze product images on it. |
| `storage` | permissions | Saves your settings (display mode, flag threshold, enabled sites) and caches detection results locally so pages aren't re-scanned. |
| `scripting` | permissions | Injects the image-scanning logic into supported marketplace pages, and runs the right-click "Check this image" check. |
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
| 1.8.0 | 2026-07-04 | Expanded to global marketplaces (AliExpress, Temu, Shein, Amazon global + full Amazon.in scan); repositioned around AI/fake photo detection; optional on-device ONNX engine; removed the unshipped cross-marketplace "compare" experiment; trimmed store package from ~11 MB to ~120 KB. | Draft |

## Review Notes

### Known Issues / Limitations
- The built-in on-device "Preview" engine works with zero setup but is a heuristic, not a trained model — it's less accurate than the Hugging Face path. This is disclosed in the UI. A fully-local, higher-accuracy ONNX engine is built but gated out of the default build (see docs/ONDEVICE.md).
- AliExpress, Temu and Shein use volatile, hashed DOM class names — selectors in `content/sites/` are best-effort and need periodic re-validation on live pages.

### Pre-Submit Checklist
- [x] Manifest V3, no V2 APIs
- [x] Every permission + host_permission has a specific justification (above)
- [x] All declared permissions are actually used in code (verified)
- [x] 128×128 store icon exists (`icons/icon-128.png`)
- [x] Store package trimmed (<1 MB; parked Compare feature excluded via `web-ext-config.mjs`)
- [ ] Selectors validated on live AliExpress / Temu / Shein / Amazon pages
- [ ] Privacy Policy URL is live (commit `docs/PRIVACY.md` to the public repo) and matches this disclosure
- [ ] At least 1 screenshot at 1280×800 or 640×400 from a REAL marketplace page
- [ ] Publisher name + contact email filled in
