// utils/marketplace-url.js — product-page URL detection and tab query patterns.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_MarketplaceUrl = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const MARKETPLACE_TAB_URLS = [
    'https://www.myntra.com/*',
    'https://www.flipkart.com/*',
    'https://www.meesho.com/*',
    'https://www.nykaa.com/*',
  ];

  /**
   * @param {string|null|undefined} url
   * @returns {boolean}
   */
  function isMarketplaceProductUrl(url) {
    if (!url) return false;
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      if (host === 'flipkart.com') return /\/p\//.test(u.pathname);
      if (host === 'myntra.com') return /\/buy$/.test(u.pathname) || /\d{6,}/.test(u.pathname);
      if (host === 'meesho.com') return /\/product\//.test(u.pathname);
      if (host.includes('nykaa.com')) return /\/p\//.test(u.pathname);
    } catch { /* invalid URL */ }
    return false;
  }

  const COMPARE_LINK_HOSTS = new Set([
    'www.amazon.in', 'amazon.in',
    'www.flipkart.com', 'flipkart.com',
    'www.myntra.com', 'myntra.com',
    'www.meesho.com', 'meesho.com',
    'www.nykaa.com', 'nykaa.com',
  ]);

  const COMPARE_IMAGE_HOST_SUFFIXES = [
    '.myntassets.com',
    '.flixcart.com',
    'images.meesho.com',
    '.nykaa.com',
    '.media-amazon.com',
    '.ssl-images-amazon.com',
  ];

  /**
   * Allow only https URLs on known marketplace/CDN hosts (compare result links/images).
   * @param {string|null|undefined} url
   * @param {{ images?: boolean }} [opts]
   * @returns {boolean}
   */
  function isSafeCompareUrl(url, opts = {}) {
    if (!url) return false;
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return false;
      const h = u.hostname.toLowerCase();
      if (COMPARE_LINK_HOSTS.has(h)) return true;
      if (opts.images) {
        return COMPARE_IMAGE_HOST_SUFFIXES.some((suf) => h === suf.replace(/^\./, '') || h.endsWith(suf));
      }
      return false;
    } catch { /* invalid URL */ }
    return false;
  }

  return { isMarketplaceProductUrl, isSafeCompareUrl, MARKETPLACE_TAB_URLS };
}));
