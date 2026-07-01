// compare/config.js — marketplace search URL builders and display metadata.
// Used by compare/search.js in the service worker and compare-panel.js in the popup.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_CompareConfig = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const MARKETPLACES = {
    amazon: {
      name: 'Amazon',
      host: 'www.amazon.in',
      searchUrl: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
      manualUrl: (q) => `https://www.amazon.in/s?k=${q}`,
      scrape: {
        readySelector: '[data-asin]:not([data-asin=""])',
        pollIntervalMs: 300,
        maxWaitMs: 8000,
        maxResults: 12,
      },
    },
    flipkart: {
      name: 'Flipkart',
      host: 'www.flipkart.com',
      searchUrl: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
      manualUrl: (q) => `https://www.flipkart.com/search?q=${q}`,
      scrape: {
        readySelector: 'a[href*="/p/"]',
        pollIntervalMs: 300,
        maxWaitMs: 8000,
        maxResults: 12,
      },
    },
    myntra: {
      name: 'Myntra',
      host: 'www.myntra.com',
      searchUrl: (q) => `https://www.myntra.com/search?q=${encodeURIComponent(q)}`,
      manualUrl: (q) => `https://www.myntra.com/search?q=${q}`,
      scrape: {
        readySelector: 'li.product-base, .product-base',
        pollIntervalMs: 300,
        maxWaitMs: 8000,
        maxResults: 12,
      },
    },
    meesho: {
      name: 'Meesho',
      host: 'www.meesho.com',
      searchUrl: (q) => `https://www.meesho.com/search?q=${encodeURIComponent(q)}`,
      manualUrl: (q) => `https://www.meesho.com/search?q=${q}`,
      scrape: {
        readySelector: '[class*="ProductCard"], [class*="product-card"]',
        pollIntervalMs: 300,
        maxWaitMs: 8000,
        maxResults: 12,
      },
    },
    nykaa: {
      name: 'Nykaa',
      host: 'www.nykaa.com',
      searchUrl: (q) => `https://www.nykaa.com/search/result/?q=${encodeURIComponent(q)}`,
      manualUrl: (q) => `https://www.nykaa.com/search/result/?q=${q}`,
      scrape: {
        readySelector: '.css-d5z3ro, a[href*="/p/"]',
        pollIntervalMs: 400,
        maxWaitMs: 10000,
        maxResults: 12,
      },
    },
  };

  const SCRAPE_TIMEOUT_MS = 10_000;

  const ALL_SITES = Object.keys(MARKETPLACES);

  return { MARKETPLACES, ALL_SITES, SCRAPE_TIMEOUT_MS };
}));
