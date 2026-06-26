// content/sites/nykaa.js
if (location.hostname.endsWith('nykaa.com')) {
  window.RMF_SITE = {
    name: 'nykaa',
    gridSelector: '.css-uo0ckf, [class*="productWrapper"]',
    cardSelector: '.css-d5z3ro, [class*="productCard"], [class*="ProductCard"]',
    imageSelector: 'img',
    overlayTargetSelector: '[class*="imageContainer"], .css-d5z3ro',
    observeSelector: '.css-uo0ckf, body',
  };
}
