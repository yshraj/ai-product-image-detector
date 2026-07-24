// content/sites/shein.js — see content/sites/myntra.js and docs/ARCHITECTURE.md
// SHEIN exposes semi-stable `product-card` class hooks plus a hashed image
// container. Selectors use those hooks with a generic `img` fallback. NOTE:
// validate on a live category + product page; SHEIN localizes and A/B-tests
// heavily across regions.
if (/(^|\.)sheinindia\.in$/.test(location.hostname)) {
  // Shein India (sheinindia.in) is a separate, Reliance-operated platform with
  // its own DOM — the global shein.com class hooks do not apply. Class-agnostic
  // first (any product link wrapping a Shein-CDN image), with generic fallbacks.
  window.RMF_SITE = {
    name: 'shein',
    cardSelector: 'a:has(img[src*="ltwebstatic"]), a[href*="/p/"], a[href*="-p-"], [class*="product-card"], [class*="productCard"]',
    imageSelector: 'img[src*="ltwebstatic"], img[class*="product"], img[class*="Product"], img',
    overlayTargetSelector: '[class*="product-card__img"], [class*="crop-image"], [class*="productCard"], a',
  };
} else if (/(^|\.)shein\.com$/.test(location.hostname) || /(^|\.)shein\.[a-z.]+$/.test(location.hostname)) {
  window.RMF_SITE = {
    name: 'shein',
    cardSelector: 'a:has(img[src*="ltwebstatic"]), section.product-card, .product-card, [class*="product-card"], .S-product-item',
    imageSelector: 'img[src*="ltwebstatic"], img.crop-image-container__img, .crop-image-container img, img[class*="product-card__img"], img',
    overlayTargetSelector: '.crop-image-container, [class*="product-card__img"], [class*="product-intro__main-img"]',
  };
}
