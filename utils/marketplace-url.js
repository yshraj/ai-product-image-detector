// utils/marketplace-url.js — product-page URL detection and tab query patterns.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_MarketplaceUrl = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const MARKETPLACE_TAB_URLS = [
    'https://www.aliexpress.com/*',
    'https://www.aliexpress.us/*',
    'https://www.temu.com/*',
    'https://www.shein.com/*',
    'https://www.amazon.com/*',
    'https://www.amazon.co.uk/*',
    'https://www.amazon.de/*',
    'https://www.amazon.in/*',
    'https://www.amazon.ca/*',
    'https://www.amazon.com.au/*',
    'https://www.amazon.fr/*',
    'https://www.amazon.it/*',
    'https://www.amazon.es/*',
    'https://www.amazon.co.jp/*',
    'https://www.myntra.com/*',
    'https://www.flipkart.com/*',
    'https://www.meesho.com/*',
    'https://www.nykaa.com/*',
  ];

  const isAmazonHost = (host) => /(^|\.)amazon\.[a-z.]+$/.test(host);

  /**
   * @param {string|null|undefined} url
   * @returns {boolean}
   */
  function isMarketplaceProductUrl(url) {
    if (!url) return false;
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      if (isAmazonHost(host)) return /\/(dp|gp\/product)\//.test(u.pathname);
      if (host.includes('aliexpress.')) return /\/item\//.test(u.pathname);
      if (host.includes('temu.com')) return /-g-\d|goods/.test(u.pathname);
      if (host.includes('shein.')) return /-p-\d+/.test(u.pathname) || /\/product\//.test(u.pathname);
      if (host === 'flipkart.com') return /\/p\//.test(u.pathname);
      if (host === 'myntra.com') return /\/buy$/.test(u.pathname) || /\d{6,}/.test(u.pathname);
      if (host === 'meesho.com') return /\/product\//.test(u.pathname);
      if (host.includes('nykaa.com')) return /\/p\//.test(u.pathname);
    } catch { /* invalid URL */ }
    return false;
  }

  const SUPPORTED_HOSTS = [
    'aliexpress.com', 'aliexpress.us',
    'temu.com', 'shein.com',
    'myntra.com', 'flipkart.com', 'meesho.com', 'nykaa.com',
  ];

  /**
   * True when the URL is on a supported marketplace host (listing or product).
   * Amazon is matched across all regional TLDs (amazon.com, amazon.co.uk, …).
   * @param {string|null|undefined} url
   * @returns {boolean}
   */
  function isSupportedMarketplaceUrl(url) {
    if (!url) return false;
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      if (isAmazonHost(host)) return true;
      return SUPPORTED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
    } catch { /* invalid URL */ }
    return false;
  }

  return {
    isMarketplaceProductUrl,
    isSupportedMarketplaceUrl,
    MARKETPLACE_TAB_URLS,
  };
}));
