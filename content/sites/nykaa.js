// content/sites/nykaa.js — see content/sites/myntra.js and docs/ARCHITECTURE.md
// Nykaa uses Emotion/styled-components (`.css-xxxxxxx`) for its primary card
// classes, which regenerate on every rebuild — the most fragile pattern of any
// supported site. The PRIMARY selector is now class-agnostic: any anchor
// wrapping a Nykaa-CDN image via :has(), matching the same proven pattern used
// for AliExpress/Meesho/Temu/Shein. The hashed/class-substring selectors are
// kept as fallbacks. Not live-confirmed (see docs/SELECTORS.md) — hardened
// defensively since `.css-*` classes are known to rotate on deploy.
if (location.hostname.endsWith('nykaa.com')) {
  window.RMF_SITE = {
    name: 'nykaa',
    cardSelector: 'a:has(img[src*="nykaa.com"]), .css-d5z3ro, [class*="productCard"], [class*="ProductCard"]',
    imageSelector: 'img[src*="nykaa.com"], img',
    overlayTargetSelector: '[class*="imageContainer"], .css-d5z3ro, a',
  };
}
