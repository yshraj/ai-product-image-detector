// compare/serp-search.js — Option A: Google Shopping via SerpApi (one call, domain-filtered).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const config = require('./config.js');
    module.exports = factory(config);
  } else {
    root.RMF_SerpSearch = factory(root.RMF_CompareConfig);
  }
}(typeof self !== 'undefined' ? self : this, function (config) {
  const { MARKETPLACES } = config;

  const DOMAIN_TO_SITE = {
    'amazon.in': 'amazon',
    'www.amazon.in': 'amazon',
    'flipkart.com': 'flipkart',
    'www.flipkart.com': 'flipkart',
    'myntra.com': 'myntra',
    'www.myntra.com': 'myntra',
    'meesho.com': 'meesho',
    'www.meesho.com': 'meesho',
    'nykaa.com': 'nykaa',
    'www.nykaa.com': 'nykaa',
  };

  function siteFromUrl(link) {
    try {
      const host = new URL(link).hostname.toLowerCase();
      return DOMAIN_TO_SITE[host] || null;
    } catch { return null; }
  }

  function normalizeItem(item, site) {
    return {
      title: item.title || '',
      price: item.price || item.extracted_price || '',
      url: item.link || item.product_link || '',
      image: item.thumbnail || item.image || '',
      site,
    };
  }

  async function searchGoogleShopping(query, apiKey) {
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: query,
      gl: 'in',
      hl: 'en',
      api_key: apiKey,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const bySite = {};
    const lists = [
      ...(data.shopping_results || []),
      ...(data.inline_shopping_results || []),
    ];
    for (const item of lists) {
      const site = siteFromUrl(item.link || item.product_link || '');
      if (!site || bySite[site]) continue;
      const norm = normalizeItem(item, site);
      if (norm.title && norm.url) bySite[site] = norm;
    }
    return bySite;
  }

  return { searchGoogleShopping, siteFromUrl, DOMAIN_TO_SITE };
}));
