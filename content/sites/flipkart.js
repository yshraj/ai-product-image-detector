// content/sites/flipkart.js — see content/sites/myntra.js and docs/ARCHITECTURE.md
// Flipkart's hashed CSS-module classes (`._1AtVbE`, `._396cs4`, …) rotate on
// redesigns — confirmed empirically 2026-07-25 against a live search page that
// most of the previously hardcoded hashes no longer match at all. The PRIMARY
// selector is now class-agnostic: any anchor wrapping a Flipkart-CDN image
// (`*.flixcart.com`, e.g. `rukminim2.flixcart.com`) via :has(), which survives
// class churn. The legacy hashed classes and `[data-id]` are kept as fallbacks.
if (location.hostname.endsWith('flipkart.com')) {
  window.RMF_SITE = {
    name: 'flipkart',
    cardSelector: 'a:has(img[src*="flixcart.com"]), ._1AtVbE, ._75nlfW > div, [data-id]',
    imageSelector: 'img[src*="flixcart.com"], img._396cs4, img.DByuf4, img._53J4C-, img',
    overlayTargetSelector: '._396cs4, ._4WELSP, ._3exPp9, a',
  };
}
