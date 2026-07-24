// content/sites/myntra.js
// Per-marketplace DOM selectors. Loaded before content.js in manifest.json.
// Each site file sets window.RMF_SITE when the hostname matches; content.js
// exits immediately if RMF_SITE is unset. See docs/ARCHITECTURE.md for the
// full RMF_SITE contract and how to add or fix selectors after a site redesign.
//
// `.product-base` / `.product-imageSliderContainer` are Myntra's long-lived
// semantic class names (not hashed), so they stay primary. A Myntra-CDN
// (`assets.myntassets.com`) image fallback is added defensively in case a
// future redesign renames them — not live-confirmed broken, just hardened
// against it (see docs/SELECTORS.md).
if (location.hostname.endsWith('myntra.com')) {
  window.RMF_SITE = {
    name: 'myntra',
    cardSelector: '.product-base, li:has(img[src*="myntassets.com"])',
    imageSelector: '.product-imageSliderContainer img, .product-image img, img[src*="myntassets.com"], img',
    overlayTargetSelector: '.product-imageSliderContainer, .product-image',
  };
}
