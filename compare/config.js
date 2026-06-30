// compare/config.js — marketplace search URL builders and metadata.
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
    },
    flipkart: {
      name: 'Flipkart',
      host: 'www.flipkart.com',
      searchUrl: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
      manualUrl: (q) => `https://www.flipkart.com/search?q=${q}`,
    },
    myntra: {
      name: 'Myntra',
      host: 'www.myntra.com',
      searchUrl: (q) => `https://www.myntra.com/search?q=${encodeURIComponent(q)}`,
      manualUrl: (q) => `https://www.myntra.com/search?q=${q}`,
    },
    meesho: {
      name: 'Meesho',
      host: 'www.meesho.com',
      searchUrl: (q) => `https://www.meesho.com/search?q=${encodeURIComponent(q)}`,
      manualUrl: (q) => `https://www.meesho.com/search?q=${q}`,
    },
    nykaa: {
      name: 'Nykaa',
      host: 'www.nykaa.com',
      searchUrl: (q) => `https://www.nykaa.com/search/result/?q=${encodeURIComponent(q)}`,
      manualUrl: (q) => `https://www.nykaa.com/search/result/?q=${q}`,
    },
  };

  const ALL_SITES = Object.keys(MARKETPLACES);

  return { MARKETPLACES, ALL_SITES };
}));
