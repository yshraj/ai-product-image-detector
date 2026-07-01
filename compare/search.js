// compare/search.js — orchestrate cross-marketplace product search from the service worker.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const config = require('./config.js');
    const parsers = require('./parsers.js');
    const query = require('../utils/product-query.js');
    const matcher = require('../utils/product-matcher.js');
    const serp = require('./serp-search.js');
    const internal = require('./internal-apis.js');
    module.exports = factory(config, parsers, query, matcher, serp, internal);
  } else {
    root.RMF_CompareSearch = factory(
      root.RMF_CompareConfig,
      root.RMF_CompareParsers,
      root.RMF_ProductQuery,
      root.RMF_ProductMatcher,
      root.RMF_SerpSearch,
      root.RMF_InternalApis,
    );
  }
}(typeof self !== 'undefined' ? self : this, function (config, parsers, ProductQuery, ProductMatcher, SerpSearch, InternalApis) {
  const { MARKETPLACES } = config;
  const { parseSearchResults } = parsers;
  const { buildSearchQuery } = ProductQuery;
  const { pickBest, rankResults } = ProductMatcher;
  const { searchGoogleShopping } = SerpSearch || {};
  const { searchViaInternalApi } = InternalApis || {};

  const FETCH_TIMEOUT_MS = 12_000;
  const MIN_RESULTS = 1;
  const COMPARE_CONCURRENCY = 3;
  const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  /** Run async tasks with a concurrency cap (order preserved in results). */
  async function mapConcurrent(items, fn, limit = COMPARE_CONCURRENCY) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(limit, items.length) }, () => worker()),
    );
    return results;
  }

  async function fetchSearchPage(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-IN,en;q=0.9',
          'User-Agent': BROWSER_UA,
        },
        credentials: 'omit',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  async function getCandidates(site, searchUrl, fetchFn, tabFetchFn) {
    const queryStr = decodeURIComponent(searchUrl.split(/[?&](?:q|k)=/)[1] || '');
    if (searchViaInternalApi) {
      const internalItems = await searchViaInternalApi(site, queryStr);
      if (internalItems.length) return internalItems;
    }
    // Direct fetch first — no visible background tabs.
    try {
      const html = await fetchFn(searchUrl);
      const parsed = parseSearchResults(site, html, searchUrl);
      if (parsed.length) return parsed;
    } catch { /* fall through to optional tab scrape */ }
    if (tabFetchFn) {
      const items = await tabFetchFn(searchUrl, site);
      if (items.length) return items;
    }
    return [];
  }

  async function searchMarketplace(site, product, fetchFn = fetchSearchPage, tabFetchFn = null) {
    const mp = MARKETPLACES[site];
    if (!mp) return { site, ok: false, error: 'unknown site' };

    const queryStr = buildSearchQuery(product);
    const searchUrl = mp.searchUrl(queryStr);

    try {
      const candidates = await getCandidates(site, searchUrl, fetchFn, tabFetchFn);
      if (candidates.length < MIN_RESULTS) {
        return { site, ok: true, query: queryStr, searchUrl, best: null, candidates: [], message: 'no results', source: 'direct' };
      }
      const best = pickBest(product, candidates);
      return { site, ok: true, query: queryStr, searchUrl, best, candidates: candidates.slice(0, 5), source: 'direct' };
    } catch (err) {
      return { site, ok: false, query: queryStr, searchUrl, error: String(err?.message || err), source: 'direct' };
    }
  }

  async function searchViaSerp(product, sites, apiKey) {
    const queryStr = buildSearchQuery(product);
    const bySite = await searchGoogleShopping(queryStr, apiKey);
    const results = [];
    for (const site of sites) {
      if (site === product.site) continue;
      const candidate = bySite[site];
      if (!candidate) {
        results.push({ site, ok: true, query: queryStr, best: null, candidates: [], message: 'no results', source: 'serp' });
        continue;
      }
      const best = pickBest(product, [candidate]);
      results.push({
        site, ok: true, query: queryStr, searchUrl: `serp:${queryStr}`, best,
        candidates: [candidate], source: 'serp',
      });
    }
    return results;
  }

  function buildResponse(product, sites, results, source) {
    const queryStr = buildSearchQuery(product);
    const matches = results
      .filter((r) => r.ok && r.best)
      .sort((a, b) => (b.best?.match?.score || 0) - (a.best?.match?.score || 0));
    return {
      ok: true,
      query: queryStr,
      searched: sites.filter((s) => s !== product.site).length,
      results,
      matches,
      sameProduct: matches.filter((r) => r.best.match.label === 'same'),
      similar: matches.filter((r) => r.best.match.label === 'similar'),
      failed: results.filter((r) => !r.ok),
      empty: results.filter((r) => r.ok && !r.best),
      source,
      timestamp: Date.now(),
    };
  }

  async function searchAll(product, sites, options = {}) {
    const {
      fetchFn = fetchSearchPage,
      tabFetchFn = null,
      serpApiKey = '',
      concurrency = COMPARE_CONCURRENCY,
    } = options;
    const enabled = (sites || []).filter((s) => s !== product.site && MARKETPLACES[s]);
    let serpFailed = false;

    if (serpApiKey && searchGoogleShopping) {
      try {
        const serpResults = await searchViaSerp(product, enabled, serpApiKey);
        const matched = serpResults.filter((r) => r.best).length;
        if (matched > 0) {
          const resp = buildResponse(product, sites, serpResults, 'serp');
          return { ...resp, serpFailed: false };
        }
      } catch {
        serpFailed = true;
        // SerpApi unavailable — fall through to direct marketplace search.
      }
    }

    const results = await mapConcurrent(
      enabled,
      (site) => searchMarketplace(site, product, fetchFn, tabFetchFn),
      concurrency,
    );
    const resp = buildResponse(product, sites, results, 'direct');
    return { ...resp, serpFailed };
  }

  function cacheKey(product) {
    const q = buildSearchQuery(product);
    return `rmf_compare_${product.site || 'x'}_${q.slice(0, 60)}`;
  }

  return {
    searchMarketplace, searchAll, buildSearchQuery, cacheKey, FETCH_TIMEOUT_MS,
    mapConcurrent, COMPARE_CONCURRENCY,
  };
}));
