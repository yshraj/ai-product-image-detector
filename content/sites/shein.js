// content/sites/shein.js — see content/sites/myntra.js and docs/ARCHITECTURE.md
// SHEIN exposes semi-stable `product-card` class hooks plus a hashed image
// container. Selectors use those hooks with a generic `img` fallback. NOTE:
// validate on a live category + product page; SHEIN localizes and A/B-tests
// heavily across regions.
if (/(^|\.)shein\.com$/.test(location.hostname) || /(^|\.)shein\.[a-z.]+$/.test(location.hostname)) {
  window.RMF_SITE = {
    name: 'shein',
    gridSelector: '.product-list__items, .S-product-list, [class*="product-list"]',
    cardSelector: 'section.product-card, .product-card, [class*="product-card"], .S-product-item',
    imageSelector: 'img.crop-image-container__img, .crop-image-container img, img[class*="product-card__img"], img',
    overlayTargetSelector: '.crop-image-container, [class*="product-card__img"], [class*="product-intro__main-img"]',
    observeSelector: '#app, body',
  };
}
