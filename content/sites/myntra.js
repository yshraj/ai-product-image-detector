// content/sites/myntra.js
// Per-marketplace DOM selectors. Loaded before content.js in manifest.json.
// Each site file sets window.RMF_SITE when the hostname matches; content.js
// exits immediately if RMF_SITE is unset. See docs/ARCHITECTURE.md for the
// full RMF_SITE contract and how to add or fix selectors after a site redesign.
if (location.hostname.endsWith('myntra.com')) {
  window.RMF_SITE = {
    name: 'myntra',
    gridSelector: '.results-base',
    cardSelector: '.product-base',
    imageSelector: '.product-imageSliderContainer img, .product-image img, img',
    overlayTargetSelector: '.product-imageSliderContainer, .product-image',
    observeSelector: '.results-base',
  };
}
