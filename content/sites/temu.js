// content/sites/temu.js — see content/sites/myntra.js and docs/ARCHITECTURE.md
// Temu is a heavy SPA with fully hashed class names, so card detection is
// class-agnostic: the PRIMARY selector is any product link wrapping a Temu-CDN
// image (`kwcdn.com`) via :has(), which survives redesigns. Stable hrefs/attrs
// and a generic `img` fallback back it up.
// NOTE: Temu's DOM is volatile and bot-sensitive — validate on a live search +
// product page and expect to tune `cardSelector` after redesigns.
if (/(^|\.)temu\.com$/.test(location.hostname)) {
  window.RMF_SITE = {
    name: 'temu',
    gridSelector: '[role="list"], #root',
    cardSelector: 'a:has(img[src*="kwcdn.com"]), a[href*="goods.html"], div[data-uniqid], [role="listitem"]',
    imageSelector: 'img[src*="kwcdn.com"], img[class*="goods"], img[src*="temu"], img',
    overlayTargetSelector: '[class*="imgContainer"], [class*="goods-img"], a',
    observeSelector: '#root, body',
  };
}
