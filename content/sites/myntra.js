// content/sites/myntra.js
// Only claims the page if we are actually on Myntra.
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
