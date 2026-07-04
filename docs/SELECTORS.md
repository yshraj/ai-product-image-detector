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

So a site config only needs **four selectors** to be correct.

## The `RMF_SITE` contract

| Field | Purpose | Robustness guidance |
|-------|---------|---------------------|
| `cardSelector` | The repeating product container to badge | Prefer stable attributes/hrefs over hashed classes; multiple comma-separated fallbacks allowed |
| `imageSelector` | The product `<img>` inside a card / on a PDP | Always end with a bare `img` fallback so a class rename fails *safe* (scans nothing, never mis-badges) |
| `overlayTargetSelector` | Where the badge anchors (secondary — the code prefers the scanned `<img>`'s parent) | The image container |
| `gridSelector` / `observeSelector` | Hints only | Fall back to `body` |

**Fail-safe principle:** if `cardSelector` matches nothing, the extension simply
badges nothing. It never produces false badges from a stale selector, so a site
redesign degrades to "no badges", not "wrong badges".

## Per-site status & how to verify

> ⚠️ **All four global marketplaces below require one manual live verification.**
> AliExpress/Temu/Shein use hashed, frequently-changed class names and are
> bot-sensitive, so their selectors are best-effort and cannot be confirmed from
> a repo. Verify with the extension loaded unpacked (`npm start` or Load unpacked).

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

| Site | File | Current selectors (verify) | Likely failure & fix |
|------|------|----------------------------|----------------------|
| **Amazon** (global) | `amazon.js` | `div[data-component-type="s-search-result"]`, `img.s-image`, PDP `#landingImage` | Stable — `data-component-type` and `#landingImage` are long-lived. Most likely issue: sponsored/rich cards without `s-image` (fine, skipped). |
| **AliExpress** | `aliexpress.js` | `a[class*="multi--container"]`, `div[class*="list--gallery"]`, `img[class*="images--item"]`, `img` | Hashed classes rotate. If `scanning 0 cards`, inspect a product card, copy a stable class *substring* (e.g. `search-item-card`) into `cardSelector`. |
| **Temu** | `temu.js` | `a[href*="goods.html"]`, `div[data-uniqid]`, `[role="listitem"]`, `img` | Most volatile + bot checks. Verify `a[href*="goods"]` still matches PDP links; update `imageSelector` if images move to `background-image` (would need a background-image scan variant). |
| **Shein** | `shein.js` | `section.product-card`, `.product-card`, `img.crop-image-container__img`, `img` | `.product-card` is fairly stable. Region A/B tests may rename the image class — the bare `img` fallback covers it. |
| **Myntra** | `myntra.js` | `.product-base`, `.product-imageSliderContainer img, img` | Legacy stable classes. |
| **Flipkart** | `flipkart.js` | `._1AtVbE, ._75nlfW > div, [data-id]`, hashed img classes + `img` | Flipkart rotates hashes often; `[data-id]` + `img` fallback keep it working. |
| **Meesho** | `meesho.js` | `[class*="ProductList__GridCol"] > div`, `[data-testid="product-card"]`, `img` | `data-testid` is the stable anchor. |
| **Nykaa** | `nykaa.js` | `[class*="productCard"]`, `img` | Class-substring based; robust. |

## When badges stop appearing after a redesign

1. Confirm the site host still matches the guard in `content/sites/<site>.js`.
2. In the console on the site: `document.querySelectorAll('<candidate cardSelector>').length`.
3. Prefer, in order: `data-*` attributes → semantic tags/roles → `href` patterns
   → stable class *substrings* (`[class*="…"]`) → hashed classes (last resort).
4. Keep the bare `img` fallback in `imageSelector`.
5. Re-run the verification steps above; open a PR updating only the one site file.
