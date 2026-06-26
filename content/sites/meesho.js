// content/sites/meesho.js
if (location.hostname.endsWith('meesho.com')) {
  window.RMF_SITE = {
    name: 'meesho',
    gridSelector: '.ProductList__GridCol-sc, [class*="ProductList"]',
    cardSelector: '[class*="ProductList__GridCol"] > div, [data-testid="product-card"]',
    imageSelector: 'img[class*="sc-"], img',
    overlayTargetSelector: 'img[class*="sc-"], [class*="ProductCard"]',
    observeSelector: 'main',
  };
}
