// content/sites/aliexpress.js — see content/sites/myntra.js and docs/ARCHITECTURE.md
// AliExpress uses hashed CSS-module class names that change often, so selectors
// lean on stable *substrings* (class*=) plus a generic `img` fallback. NOTE:
// AliExpress ships frequent redesigns — validate these on a live search +
// product page and update the substrings if badges stop appearing.
if (/(^|\.)aliexpress\.(com|us|ru)$/.test(location.hostname)) {
  window.RMF_SITE = {
    name: 'aliexpress',
    gridSelector: '[class*="list--gallery"], [class*="search-item-card"], .product-container',
    cardSelector: 'a[class*="multi--container"], div[class*="list--gallery"], div[class*="card--out-wrapper"], [class*="search-item-card-wrapper"]',
    imageSelector: 'img[class*="images--item"], img[class*="image-view"], img.mainPic, img',
    overlayTargetSelector: '[class*="images--imageWindow"], [class*="image--wrap"], [class*="magnifier--wrap"]',
    observeSelector: '#root, body',
  };
}
