// compare/search.js — orchestrate cross-marketplace product search from the service worker.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const config = require('./config.js');
    const parsers = require('./parsers.js');
    const query = require('../utils/product-query.js');
    const matcher = require('../utils/product-matcher.js');
    module.exports = factory(config, parsers, query, matcher);
  } else {
    const config = root.RMF_CompareConfig;
    const parsers = root.RMF_CompareParsers;
    const query = root.RMF_ProductQuery;
    const matcher = root.RMF_ProductMatcher;
    root.RMF_CompareSearch = factory(config, parsers, query, matcher);
  }
}(typeof self !== 'undefined' ? self : this, function (config, parsers, ProductQuery, ProductMatcher) {
  const { MARKETPLACES } = config;
  const { parseSearchResults } = parsers;
  const { buildSearchQuery } = ProductQuery;
  const { pickBest } = ProductMatcher;

  const FETCH_TIMEOUT_MS = 12_000;
  const MIN_RESULTS = 1;

  async function fetchSearchPage(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-IN,en;q=0.9',
        },
        credentials: 'omit',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  async function searchMarketplace(site, product, fetchFn = fetchSearchPage) {
    const mp = MARKETPLACES[site];
    if (!mp) return { site, ok: false, error: 'unknown site' };

    const queryStr = buildSearchQuery(product);
    const searchUrl = mp.searchUrl(queryStr);

    try {
      const html = await fetchFn(searchUrl);
      const candidates = parseSearchResults(site, html, `https://${mp.host}`);
      if (candidates.length < MIN_RESULTS) {
        return {
          site,
          ok: true,
          query: queryStr,
          searchUrl,
          best: null,
          candidates: [],
          message: 'no results',
        };
      }
      const best = pickBest(product, candidates);
      return {
        site,
        ok: true,
        query: queryStr,
        searchUrl,
        best,
        candidates: candidates.slice(0, 5),
      };
    } catch (err) {
      return {
        site,
        ok: false,
        query: queryStr,
        searchUrl,
        error: String(err?.message || err),
      };
    }
  }

  async function searchAll(product, sites, fetchFn) {
    const enabled = (sites || []).filter((s) => s !== product.site && MARKETPLACES[s]);
    const queryStr = buildSearchQuery(product);

    const results = await Promise.all(
      enabled.map((site) => searchMarketplace(site, product, fetchFn)),
    );

    const matches = results
      .filter((r) => r.ok && r.best)
      .sort((a, b) => (b.best?.match?.score || 0) - (a.best?.match?.score || 0));

    const sameProduct = matches.filter((r) => r.best.match.label === 'same');
    const similar = matches.filter((r) => r.best.match.label === 'similar');

    return {
      ok: true,
      query: queryStr,
      searched: enabled.length,
      results,
      matches,
      sameProduct,
      similar,
      timestamp: Date.now(),
    };
  }

  function cacheKey(product) {
    const q = buildSearchQuery(product);
    return `rmf_compare_${product.site || 'x'}_${q.slice(0, 60)}`;
  }

  return {
    searchMarketplace,
    searchAll,
    buildSearchQuery,
    cacheKey,
    FETCH_TIMEOUT_MS,
  };
}));
