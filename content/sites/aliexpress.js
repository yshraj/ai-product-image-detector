// content/sites/aliexpress.js — see content/sites/myntra.js and docs/ARCHITECTURE.md
// AliExpress uses hashed CSS-module class names that change often, so the
// PRIMARY selector is class-agnostic: any product link wrapping an AliExpress
// CDN image (`alicdn.com`) via :has(). The hashed-substring selectors and a
// generic `img` fallback back it up. NOTE: AliExpress ships frequent redesigns
// — validate on a live search + product page if badges stop appearing.
if (/(^|\.)aliexpress\.(com|us|ru)$/.test(location.hostname)) {
  window.RMF_SITE = {
    name: 'aliexpress',
    gridSelector: '[class*="list--gallery"], [class*="search-item-card"], .product-container',
    cardSelector: 'a:has(img[src*="alicdn.com"]), a[class*="multi--container"], div[class*="list--gallery"], div[class*="card--out-wrapper"], [class*="search-item-card-wrapper"]',
    imageSelector: 'img[src*="alicdn.com"], img[class*="images--item"], img[class*="image-view"], img.mainPic, img',
    overlayTargetSelector: '[class*="images--imageWindow"], [class*="image--wrap"], [class*="magnifier--wrap"], a',
    observeSelector: '#root, body',
  };
}
