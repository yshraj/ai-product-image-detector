# Chrome Web Store Listing — TrueKart

> Last Updated: 2026-07-03

## Store Listing

**Extension Name** [REQUIRED]
TrueKart — AI Photo Check

**Short Description** [REQUIRED]
Spot AI-generated product photos on Myntra, Flipkart, Meesho and Nykaa while you shop.

**Detailed Description** [REQUIRED]
TrueKart checks product photos on Indian shopping sites and flags the ones that look AI-generated, so you can judge a listing before you buy.

As you browse Myntra, Flipkart, Meesho and Nykaa, TrueKart quietly scans the product images on the page and marks each one: AI generated, likely AI, or normal. A small badge appears on flagged photos, and the toolbar popup shows a summary for the whole page. Tap any badge to see why an image was flagged.

How to use it:
1. Click the TrueKart icon and connect a free Hugging Face detection model (or try the on-device Preview engine).
2. Open any product page on a supported store — images are scanned automatically.
3. Use "Scan whole page" to check off-screen products, and adjust the flag threshold to your taste.

Your privacy: TrueKart has no account and no servers of its own. Your settings sync only across your own browser profile, and detection results are cached locally on your device. When you connect Hugging Face, only the product image and your own access token are sent to Hugging Face to classify the image — nothing is sent to us.

Support & feedback: https://github.com/yshraj/ai-product-image-detector/issues

**Category** [REQUIRED]
Shopping

**Single Purpose** [REQUIRED]
Flags AI-generated product photos on supported Indian shopping sites (Myntra, Flipkart, Meesho, Nykaa) so shoppers can assess listings.

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

### Screenshot Notes
1. A supported product page (e.g. Myntra) with badges on several product images — show a red "AI generated" badge in context.
2. The popup Scan panel showing the AI generated / Likely AI / Normal breakdown after a scan.
3. The "Why flagged?" popover on a flagged image.
4. The Settings panel showing the Hugging Face connection + display modes.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `activeTab` | permissions | Reads the page you're actively viewing (when you click the icon or trigger a scan) to find and analyze product images on it. |
| `storage` | permissions | Saves your settings (display mode, flag threshold, enabled sites) and caches detection results locally so pages aren't re-scanned. |
| `scripting` | permissions | Injects the image-scanning logic into supported marketplace pages to detect and badge product photos. |
| `tabs` | permissions | Reads the active tab's URL to know whether it's a supported shopping site, and opens the Settings/support pages. |
| `notifications` | permissions | Shows a single optional OS notification when AI images are found on a page (off by default). |
| `contextMenus` | permissions | Adds a right-click menu option to check a specific image on the page. |
| `https://www.myntra.com/*`, `https://www.flipkart.com/*`, `https://www.meesho.com/*`, `https://www.nykaa.com/*`, `https://www.amazon.in/*` | host_permissions | Scanning product images on these shopping sites is the extension's core function. |
| `https://router.huggingface.co/*`, `https://huggingface.co/*`, `https://cdn-lfs.huggingface.co/*` | host_permissions | Sends the product image (with your own access token) to the Hugging Face model you connect, to classify whether a photo is AI-generated. |
| `https://assets.myntassets.com/*`, `https://*.flixcart.com/*`, `https://images.meesho.com/*`, `https://*.nykaa.com/*`, `https://*.media-amazon.com/*`, `https://*.ssl-images-amazon.com/*`, `https://*.amazon.in/*` | host_permissions | Fetches the product image bytes from each store's image CDN so they can be analyzed. |

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
<!-- The full policy text already exists in the extension's Settings page (options.html → "Privacy Policy").
     Host that text at a public URL (e.g. GitHub Pages / a README anchor) and paste the URL here.
     Suggested: https://github.com/yshraj/ai-product-image-detector/blob/main/PRIVACY.md -->

## Distribution

**Visibility**: Public
**Regions**: All regions (primary audience: India)

## Developer Info

**Publisher Name** [REQUIRED — fill in]
**Contact Email** [REQUIRED — fill in; shown publicly]
**Support URL / Email** [RECOMMENDED] https://github.com/yshraj/ai-product-image-detector/issues
**Homepage URL** [RECOMMENDED] https://github.com/yshraj/ai-product-image-detector

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.7.0 | 2026-07-03 | New magnifier app icon/brand mark; accessible skeleton loader; a11y fixes (contrast, landmarks, ARIA, h1). | Draft |

## Review Notes

### Known Issues / Limitations
- The on-device "Preview" engine is explicitly low-accuracy; the accurate path requires the user to connect a free Hugging Face model. This is disclosed in the UI.
- Amazon India support is limited compared to the other four marketplaces.

### Pre-Submit Checklist (from skill review-checklist)
- [x] Manifest V3, no V2 APIs
- [x] Every permission + host_permission has a specific justification (above)
- [x] All declared permissions are actually used in code (verified)
- [x] 128×128 store icon exists (`icons/icon-128.png`)
- [ ] Privacy Policy URL is live and matches this disclosure
- [ ] At least 1 screenshot at 1280×800 or 640×400
- [x] Packaging excludes dev files, `.agents/`, `logos/`, and this file (`web-ext-config.mjs`)
- [ ] Publisher name + contact email filled in
