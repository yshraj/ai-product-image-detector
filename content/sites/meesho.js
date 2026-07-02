// content/sites/meesho.js — see content/sites/myntra.js and docs/ARCHITECTURE.md
if (location.hostname.endsWith('meesho.com')) {
  window.RMF_SITE = {
    name: 'meesho',
    gridSelector: '.ProductList__GridCol-sc, [class*="ProductList"]',
    cardSelector: '[class*="ProductList__GridCol"] > div, [data-testid="product-card"]',
    imageSelector: 'img[class*="ProductImage"], img[class*="ImageContainer"] img, img[src*="images.meesho.com"], img',
    overlayTargetSelector: '[class*="ProductImage"], [class*="ImageContainer"]',
    observeSelector: 'main',
  };
}
