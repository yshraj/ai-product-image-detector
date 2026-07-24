// content/sites/meesho.js — see content/sites/myntra.js and docs/ARCHITECTURE.md
//
// Meesho is a client-rendered SPA whose card containers use hashed
// styled-component class names (e.g. `ProductList__GridCol-sc-<hash>`) that
// rotate on redesigns. So the PRIMARY selector is class-agnostic: any product
// link wrapping a Meesho-CDN image (`images.meesho.com`) via :has(). That
// survives class churn. The hashed-class / data-testid selectors are kept as
// fallbacks (and the offline e2e fixture relies on `data-testid`).
if (location.hostname.endsWith('meesho.com')) {
  window.RMF_SITE = {
    name: 'meesho',
    cardSelector: 'a:has(img[src*="images.meesho.com"]), [data-testid="product-card"], [class*="ProductList__GridCol"] > div',
    imageSelector: 'img[src*="images.meesho.com"], img[class*="ProductImage"], img[class*="ImageContainer"] img, img',
    overlayTargetSelector: '[class*="ProductImage"], [class*="ImageContainer"], a',
  };
}
