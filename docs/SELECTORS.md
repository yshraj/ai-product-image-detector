# Marketplace selectors — verification & maintenance

Each supported site has a small config in `content/sites/<site>.js` that sets
`window.RMF_SITE` when the hostname matches. `content/content.js` reads it and
does the rest (scanning, badges, mutation/scroll observing, viewport gating).

## What the content script already handles (site-agnostic)

You do **not** need per-site code for any of these — they work off `RMF_SITE`:

| Concern | Mechanism (`content/content.js`) |
|---------|----------------------------------|
| Dynamically inserted cards | `MutationObserver(document.body, {childList, subtree})` → debounced `scanAll` |
| Lazy-loaded images | Same observer with `attributeFilter:['src','srcset']` + `scroll` listener |
| Infinite scroll | `scroll` → `scheduleScan`; "Scan whole page" walks the page and force-scans |
| SPA navigation | Patched `history.pushState/replaceState` + `popstate` → clean `rerender` on path change |
| Late-painting SPAs | Delayed rescans at 400/1200/2500 ms after load |
| Re-scan cost | Per-URL result cache + 3-way concurrency limit; only visible cards scanned |

So a site config only needs **three selectors** to be correct.

## The `RMF_SITE` contract

| Field | Purpose | Robustness guidance |
|-------|---------|---------------------|
| `cardSelector` | The repeating product container to badge | Prefer stable attributes/hrefs, or a class-agnostic `a:has(img[src*="<cdn>"])` anchor, over hashed classes; multiple comma-separated fallbacks allowed |
| `imageSelector` | The product `<img>` inside a card / on a PDP | Always end with a bare `img` fallback so a class rename fails *safe* (scans nothing, never mis-badges) |
| `overlayTargetSelector` | Where the badge anchors (secondary — the code prefers the scanned `<img>`'s parent) | The image container |

`gridSelector` and `observeSelector` were removed 2026-07-25 — they were never
read anywhere in `content/content.js` (confirmed by repo-wide search); the
`MutationObserver` always watches `document.body` regardless. Don't re-add
them to a new site config.

**Fail-safe principle:** if `cardSelector` matches nothing, the extension simply
badges nothing. It never produces false badges from a stale selector, so a site
redesign degrades to "no badges", not "wrong badges".

## Per-site status & how to verify

> ⚠️ **Live verification was attempted 2026-07-25 from an automated/cloud
> environment and was blocked or unreliable for 6 of 8 sites** (timeouts,
> `net::ERR_HTTP2_PROTOCOL_ERROR`, or explicit `403 Access Denied` — consistent
> with anti-bot defenses on datacenter IP ranges, not a code problem). Only
> **Flipkart** and **Temu** returned real, renderable pages; Flipkart's
> selectors were checked against that live page and fixed (see below). The
> other sites still need one **manual** live check from a residential
> connection with the extension loaded unpacked (`npm start` or Load
> unpacked) before you can be confident badges appear in production.

**Verification steps (per site):**
1. Load the extension unpacked; switch the engine to Hugging Face (or on-device)
   so real verdicts appear.
2. Open a **category/search** page and a **product** page on the site.
3. Open DevTools console on that tab; filter for `[RMF]` (set
   `localStorage.RMF_DEBUG='1'` and reload for verbose logs).
4. **Expected pass:** console logs `scanning N cards on <site>` with `N` roughly
   equal to the number of visible products; badges appear on flagged images;
   `document.querySelectorAll(RMF_SITE.cardSelector).length` (run in console)
   is > 0 and matches the visible product count.
5. **Fail signature:** `scanning 0 cards` → `cardSelector` is wrong; badges never
   appear though cards are found → `imageSelector` is wrong or images are
   background-images (not `<img>`).

| Site | File | Current selectors | Status |
|------|------|--------------------|--------|
| **Flipkart** | `flipkart.js` | `a:has(img[src*="flixcart.com"])` primary + legacy hashed classes + `[data-id]` fallback | ✅ **Live-verified 2026-07-25.** All the old hardcoded hashed classes (`._396cs4`, `.DByuf4`, `._53J4C-`, the old `overlayTargetSelector` hashes) matched **zero** elements on a real search page — confirmed dead. `[data-id]` alone still kept `cardSelector` working (40 matches), but `imageSelector`/`overlayTargetSelector` had no working fallback at all. Fixed with a class-agnostic `flixcart.com` CDN-image selector, the proven pattern used on 4 other sites. |
| **Temu** | `temu.js` | `a:has(img[src*="kwcdn.com"])` primary + `a[href*="goods.html"]`, `div[data-uniqid]` fallbacks | Page loaded live (200) but not deeply inspected against `cardSelector` this pass — the existing class-agnostic pattern is sound; do a full check per the steps above before trusting it in production. |
| **Amazon** (global) | `amazon.js` | `div[data-component-type="s-search-result"]`, `img.s-image`, PDP `#landingImage` | Not reachable this pass (`503` bot-check page). `data-component-type` and `#landingImage` are long-lived, well-known-stable Amazon attributes — lower risk than hashed-class sites, but still unverified live this pass. |
| **AliExpress** | `aliexpress.js` | `a:has(img[src*="alicdn.com"])` primary + hashed-class fallbacks | Not reachable this pass (connection timed out). Hashed classes rotate; the CDN-image primary selector is the resilient part. |
| **Shein** | `shein.js` | `a:has(img[src*="ltwebstatic"])` primary + `.product-card`, hashed-class fallbacks | Not reachable this pass (connection timed out). |
| **Myntra** | `myntra.js` | `.product-base` primary + new `img[src*="myntassets.com"]` fallback | Not reachable this pass (`net::ERR_HTTP2_PROTOCOL_ERROR`). `.product-base` looked stable in earlier checks; added a CDN-image fallback defensively 2026-07-25 (not confirmed broken, just hardened). |
| **Meesho** | `meesho.js` | `a:has(img[src*="images.meesho.com"])` primary + `[data-testid="product-card"]` fallback | Not reachable this pass (`403 Access Denied`). `data-testid` is a deliberately stable QA hook — lower risk. |
| **Nykaa** | `nykaa.js` | `a:has(img[src*="nykaa.com"])` primary (new) + `.css-*`/class-substring fallbacks | Not reachable this pass (`net::ERR_HTTP2_PROTOCOL_ERROR`). Previously relied on Emotion `.css-xxxxxxx` classes as primary — those regenerate on every rebuild, the most fragile pattern of any site here. Added a CDN-image primary selector defensively 2026-07-25. |

**Net effect of this pass:** every site's `cardSelector` now has a
class-agnostic, CDN-image-based option somewhere in its fallback chain (most
already did; Myntra and Nykaa were the two gaps, now closed). This doesn't
replace live verification — it lowers the blast radius of the next redesign.

## When badges stop appearing after a redesign

1. Confirm the site host still matches the guard in `content/sites/<site>.js`.
2. In the console on the site: `document.querySelectorAll('<candidate cardSelector>').length`.
3. Prefer, in order: `data-*` attributes → semantic tags/roles → `href` patterns
   → stable class *substrings* (`[class*="…"]`) → hashed classes (last resort).
4. Keep the bare `img` fallback in `imageSelector`.
5. Re-run the verification steps above; open a PR updating only the one site file.
