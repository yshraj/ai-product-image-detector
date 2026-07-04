// content/sites/temu.js — see content/sites/myntra.js and docs/ARCHITECTURE.md
// Temu is a heavy SPA with fully hashed class names, so card detection leans on
// stable attributes/hrefs and a generic `img` fallback rather than class names.
// NOTE: Temu's DOM is volatile and bot-sensitive — validate on a live search +
// product page and expect to tune `cardSelector` after redesigns.
if (/(^|\.)temu\.com$/.test(location.hostname)) {
  window.RMF_SITE = {
    name: 'temu',
    gridSelector: '[role="list"], #root',
    cardSelector: 'a[href*="goods.html"], div[data-uniqid], [role="listitem"]',
    imageSelector: 'img[class*="goods"], img[src*="kwcdn.com"], img[src*="temu"], img',
    overlayTargetSelector: '[class*="imgContainer"], [class*="goods-img"]',
    observeSelector: '#root, body',
  };
}
