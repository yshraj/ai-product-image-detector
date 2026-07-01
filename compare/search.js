// compare/search.js — orchestrate cross-marketplace product search from the service worker.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const config = require('./config.js');
    const parsers = require('./parsers.js');
    const query = require('../utils/product-query.js');
    const matcher = require('../utils/product-matcher.js');
    const serp = require('./serp-search.js');
    const internal = require('./internal-apis.js');
    const similarity = require('./similarity.js');
    const scoreConfig = require('./score-config.js');
    module.exports = factory(config, parsers, query, matcher, serp, internal, similarity, scoreConfig);
  } else {
    root.RMF_CompareSearch = factory(
      root.RMF_CompareConfig,
      root.RMF_CompareParsers,
      root.RMF_ProductQuery,
      root.RMF_ProductMatcher,
      root.RMF_SerpSearch,
      root.RMF_InternalApis,
      root.RMF_CompareSimilarity,
      root.RMF_ScoreConfig,
    );
  }
}(typeof self !== 'undefined' ? self : this, function (
  config, parsers, ProductQuery, ProductMatcher, SerpSearch, InternalApis, Similarity, ScoreConfig,
) {
  const { MARKETPLACES } = config;
  const { parseSearchResults } = parsers;
  const { buildSearchQuery, inferBrandFromTitle } = ProductQuery;
  const { pickBest, brandMatch } = ProductMatcher;
  const { searchGoogleShopping } = SerpSearch || {};
  const { searchViaInternalApi } = InternalApis || {};
  const {
    TOP_RANKED, MIN_FINAL_SCORE, MIN_FALLBACK_SCORE,
    MAX_CANDIDATES_PER_SITE, CLIP_TEXT_PREFILTER,
  } = ScoreConfig || {
    TOP_RANKED: 10, MIN_FINAL_SCORE: 0.12, MIN_FALLBACK_SCORE: 0.06,
    MAX_CANDIDATES_PER_SITE: 25, CLIP_TEXT_PREFILTER: 15,
  };

  const FETCH_TIMEOUT_MS = 12_000;
  const CLIP_RANK_BUDGET_MS = 45_000;
  const MIN_RESULTS = 1;
  const COMPARE_CONCURRENCY = 3;
  const COMPARE_DEBUG = typeof process !== 'undefined' && process.env?.RMF_COMPARE_DEBUG === '1';
  /** Direct fetch is blocked (Akamai 403); hidden tabs required. */
  const TAB_REQUIRED_SITES = new Set(['nykaa']);
  const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

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

  async function getCandidates(site, searchUrl, fetchFn, tabFetchFn, tabFallback = false) {
    const queryStr = decodeURIComponent(searchUrl.split(/[?&](?:q|k)=/)[1] || '');
    if (searchViaInternalApi) {
      const internalItems = await searchViaInternalApi(site, queryStr);
      if (internalItems.length) return internalItems;
    }

    const needsTab = TAB_REQUIRED_SITES.has(site) || tabFallback;

    if (!TAB_REQUIRED_SITES.has(site)) {
      try {
        const html = await fetchFn(searchUrl);
        const parsed = parseSearchResults(site, html, searchUrl);
        if (parsed.length) return parsed;
      } catch { /* fall through to optional tab scrape */ }
    }

    if (tabFetchFn && needsTab) {
      try {
        const items = await tabFetchFn(searchUrl, site);
        if (items.length) return items;
      } catch (err) {
        if (TAB_REQUIRED_SITES.has(site)) throw err;
      }
    }
    return [];
  }

  function compareLog(event, data) {
    if (typeof console !== 'undefined') {
      console.log('[RMF Compare]', event, data);
    }
  }

  function isUsableCandidate(candidate) {
    const title = String(candidate?.title || '').trim();
    if (title.length < 12) return false;
    const words = title.split(/\s+/).filter(Boolean);
    if (words.length <= 1) return false;
    return true;
  }

  function flattenCandidates(siteResults) {
    const pool = [];
    for (const r of siteResults) {
      if (!r.ok || !r.candidates?.length) continue;
      for (const c of r.candidates) {
        if (!isUsableCandidate(c)) continue;
        pool.push({ ...c, site: r.site });
      }
    }
    return pool;
  }

  async function clipScoresByProductUrl(clipBridge, sourceImage, candidates, debug = false) {
    const withImg = candidates.filter((c) => c.image);
    if (!clipBridge || !sourceImage || !withImg.length) {
      if (debug) compareLog('clip-skipped', { reason: 'no-bridge-or-images', sourceImage, count: withImg.length });
      return {};
    }

    const started = Date.now();
    const task = (async () => {
      const uniqueImages = [...new Set(withImg.map((c) => c.image))];
      const scoresByImage = await clipBridge.scoreImageBatch(sourceImage, uniqueImages, { debug });
      const byProductUrl = {};
      for (const c of withImg) {
        const clipScore = scoresByImage[c.image];
        if (clipScore != null) byProductUrl[c.url] = clipScore;
        if (debug) {
          compareLog('clip-candidate', {
            sourceImage,
            candidateImage: c.image,
            clipScore: clipScore ?? null,
            elapsed: Date.now() - started,
          });
        }
      }
      return byProductUrl;
    })();

    try {
      const result = await Promise.race([
        task,
        new Promise((resolve) => { setTimeout(() => resolve({ __timeout: true }), CLIP_RANK_BUDGET_MS); }),
      ]);
      if (result?.__timeout) {
        compareLog('clip-timeout', { elapsed: CLIP_RANK_BUDGET_MS, candidates: withImg.length });
        return {};
      }
      if (debug) {
        compareLog('clip-batch-done', {
          sourceImage,
          scored: Object.keys(result).length,
          candidates: withImg.length,
          elapsed: Date.now() - started,
        });
      }
      return result;
    } catch (err) {
      compareLog('clip-error', { error: String(err?.message || err), elapsed: Date.now() - started });
      return {};
    }
  }

  function scorePoolTextOnly(product, pool, sim) {
    return pool.map((c) => {
      const scored = sim.scoreCandidateMatch(product, c, 0);
      return {
        ...c,
        imageScore: 0,
        textScore: scored.titleScore,
        finalScore: scored.finalScore,
        breakdown: scored.breakdown,
        sourceAttrs: scored.sourceAttrs,
        candidateAttrs: scored.candidateAttrs,
        _textOnlyScore: scored.finalScore,
      };
    });
  }

  function scorePoolForRanking(product, pool, imageScores, sim, debug = false) {
    return pool.map((c) => {
      const imageScore = imageScores[c.url] ?? 0;
      const scored = sim.scoreCandidateMatch(product, c, imageScore);
      const match = sim.scoreLabel(scored.finalScore);
      if (debug) {
        compareLog('match-score', {
          title: c.title,
          url: c.url,
          finalScore: scored.finalScore,
          breakdown: scored.breakdown,
          imageScore,
        });
      }
      return {
        ...c,
        imageScore: scored.imageScore,
        textScore: scored.titleScore,
        finalScore: scored.finalScore,
        breakdown: scored.breakdown,
        sourceAttrs: scored.sourceAttrs,
        candidateAttrs: scored.candidateAttrs,
        match: {
          ...match,
          textScore: Math.round((scored.titleScore || 0) * 100),
          imageScore: Math.round((scored.imageScore || 0) * 100),
          breakdown: scored.breakdown,
        },
      };
    });
  }

  async function rankCrossPlatform(product, siteResults, options = {}) {
    const sim = options.similarity || Similarity;
    if (!sim) return [];

    const pool = flattenCandidates(siteResults);
    if (!pool.length) return [];

    const debug = options.debug === true || COMPARE_DEBUG;
    const useClip = options.useClip !== false && options.clipBridge && product.image;
    const clipPrefilter = options.clipPrefilter ?? CLIP_TEXT_PREFILTER;

    let textRanked = scorePoolTextOnly(product, pool, sim);
    textRanked.sort((a, b) => (b._textOnlyScore || 0) - (a._textOnlyScore || 0));

    let imageScores = {};
    if (useClip) {
      if (options.clipBridge?.warmupClip) {
        await options.clipBridge.warmupClip().catch(() => {});
      }
      const clipPool = textRanked
        .filter((c) => c.image)
        .slice(0, clipPrefilter);
      imageScores = await clipScoresByProductUrl(
        options.clipBridge,
        product.image,
        clipPool,
        debug,
      );
      if (Object.keys(imageScores).length === 0) {
        compareLog('clip-no-scores', {
          sourceImage: product.image,
          prefilterCount: clipPool.length,
          hint: 'All CLIP scores 0/undefined — check offscreen document or image URLs',
        });
      }
    }

    let ranked = scorePoolForRanking(product, pool, imageScores, sim, debug);
    ranked = sim.dedupCandidates(ranked);
    const minScore = options.minFinalScore ?? MIN_FINAL_SCORE;
    const minFallback = options.minFallbackScore ?? MIN_FALLBACK_SCORE;
    const topN = options.topN ?? TOP_RANKED;

    let filtered = ranked
      .filter((c) => (c.finalScore || 0) >= minScore)
      .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

    if (!filtered.length && ranked.length) {
      const bestScore = Math.max(...ranked.map((c) => c.finalScore || 0));
      if (bestScore >= minFallback) {
        filtered = [...ranked]
          .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
          .slice(0, topN);
      }
    }

    return filtered
      .slice(0, topN)
      .map((c) => ({
        site: c.site,
        title: c.title,
        price: c.price,
        url: c.url,
        image: c.image || '',
        match: c.match,
        finalScore: c.finalScore,
      }));
  }

  function matchesFromRanked(ranked) {
    const seen = new Set();
    const matches = [];
    for (const item of ranked) {
      if (seen.has(item.site)) continue;
      seen.add(item.site);
      matches.push({
        site: item.site,
        ok: true,
        best: item,
      });
    }
    return matches.sort((a, b) => (b.best.match.score || 0) - (a.best.match.score || 0));
  }

  async function searchMarketplace(site, product, fetchFn = fetchSearchPage, tabFetchFn = null, tabFallback = false) {
    const mp = MARKETPLACES[site];
    if (!mp) return { site, ok: false, error: 'unknown site' };

    const queryStr = buildSearchQuery(product);
    const searchUrl = mp.searchUrl(queryStr);

    try {
      const candidates = await getCandidates(site, searchUrl, fetchFn, tabFetchFn, tabFallback);
      if (candidates.length < MIN_RESULTS) {
        return { site, ok: true, query: queryStr, searchUrl, best: null, candidates: [], message: 'no results', source: 'direct' };
      }
      const best = pickBest(product, candidates);
      return {
        site, ok: true, query: queryStr, searchUrl, best,
        candidates: candidates.slice(0, MAX_CANDIDATES_PER_SITE),
        source: 'direct',
      };
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

  function buildResponse(product, sites, results, source, ranked = []) {
    const queryStr = buildSearchQuery(product);
    const matches = ranked.length
      ? matchesFromRanked(ranked)
      : results
        .filter((r) => r.ok && r.best)
        .sort((a, b) => (b.best?.match?.score || 0) - (a.best?.match?.score || 0));
    return {
      ok: true,
      query: queryStr,
      searched: sites.filter((s) => s !== product.site).length,
      results,
      ranked,
      matches,
      sameProduct: matches.filter((r) => r.best?.match?.label === 'same'),
      similar: matches.filter((r) => r.best?.match?.label === 'similar'),
      failed: results.filter((r) => !r.ok),
      empty: results.filter((r) => r.ok && !r.candidates?.length),
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
      compareUseTabs = false,
      similarity: sim = Similarity,
      clipBridge = null,
      useClip = true,
    } = options;
    const tabFallback = compareUseTabs === true;
    const enabled = (sites || []).filter((s) => s !== product.site && MARKETPLACES[s]);
    let serpFailed = false;

    if (serpApiKey && searchGoogleShopping) {
      try {
        const serpResults = await searchViaSerp(product, enabled, serpApiKey);
        const ranked = sim
          ? await rankCrossPlatform(product, serpResults, {
            similarity: sim,
            clipBridge: useClip ? clipBridge : null,
            useClip,
            debug: options.debug,
          })
          : [];
        return {
          ...buildResponse(product, sites, serpResults, 'serp', ranked),
          serpFailed: false,
        };
      } catch {
        serpFailed = true;
      }
    }

    const results = await mapConcurrent(
      enabled,
      (site) => searchMarketplace(site, product, fetchFn, tabFetchFn, tabFallback),
      concurrency,
    );
    const ranked = sim
      ? await rankCrossPlatform(product, results, {
        similarity: sim,
        clipBridge: useClip ? clipBridge : null,
        useClip,
        debug: options.debug,
      })
      : [];
    return { ...buildResponse(product, sites, results, 'direct', ranked), serpFailed };
  }

  function cacheKey(product) {
    const fp = product?.fingerprint;
    if (fp) return `rmf_compare_${String(fp).slice(0, 100)}`;
    const q = buildSearchQuery(product);
    return `rmf_compare_${product.site || 'x'}_${q.slice(0, 60)}`;
  }

  return {
    searchMarketplace, searchAll, buildSearchQuery, cacheKey, FETCH_TIMEOUT_MS,
    mapConcurrent, COMPARE_CONCURRENCY, TAB_REQUIRED_SITES,
    rankCrossPlatform, flattenCandidates, matchesFromRanked, scorePoolForRanking,
  };
}));
