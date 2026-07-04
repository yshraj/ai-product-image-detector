// content/sites/amazon.js — see content/sites/myntra.js and docs/ARCHITECTURE.md
// Amazon across regional TLDs (.com, .co.uk, .de, .in, …). Search-results and
// product pages use stable, attribute-based selectors that survive most A/B
// layout changes. NOTE: verify on a live Amazon search + product page before
// relying on badges — Amazon runs many layout experiments.
if (/(^|\.)amazon\.(com|co\.uk|de|fr|it|es|ca|com\.au|com\.mx|com\.br|co\.jp|nl|se|pl|sg|ae|sa|in)$/.test(location.hostname)) {
  window.RMF_SITE = {
    name: 'amazon',
    gridSelector: '.s-main-slot, #search',
    cardSelector: 'div[data-component-type="s-search-result"], #imgTagWrapperId, #main-image-container',
    imageSelector: 'img.s-image, #landingImage, #imgTagWrapperId img, img',
    overlayTargetSelector: '.s-product-image-container, #imgTagWrapperId, #main-image-container',
    observeSelector: '.s-main-slot, #dp-container, body',
  };
}
