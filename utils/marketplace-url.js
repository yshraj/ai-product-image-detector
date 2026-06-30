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

  return { isMarketplaceProductUrl, MARKETPLACE_TAB_URLS };
}));
