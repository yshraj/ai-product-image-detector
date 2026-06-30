// utils/product-matcher.js — score how similar a search result is to the source product.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const query = require('./product-query.js');
    module.exports = factory(query);
  } else {
    const query = root.RMF_ProductQuery;
    root.RMF_ProductMatcher = factory(query);
  }
}(typeof self !== 'undefined' ? self : this, function (ProductQuery) {
  const { tokenize, parsePrice } = ProductQuery;

  function jaccard(a, b) {
    const setA = new Set(a);
    const setB = new Set(b);
    if (!setA.size && !setB.size) return 0;
    let inter = 0;
    for (const x of setA) if (setB.has(x)) inter++;
    const union = setA.size + setB.size - inter;
    return union ? inter / union : 0;
  }

  function brandMatch(sourceBrand, candidateTitle) {
    if (!sourceBrand) return 0;
    const brandTokens = tokenize(sourceBrand);
    if (!brandTokens.length) return 0;
    const titleLower = (candidateTitle || '').toLowerCase();
    const hits = brandTokens.filter((t) => titleLower.includes(t)).length;
    return hits / brandTokens.length;
  }

  function priceScore(sourcePrice, candidatePrice) {
    if (!sourcePrice || !candidatePrice) return 0.5;
    const ratio = Math.min(sourcePrice, candidatePrice) / Math.max(sourcePrice, candidatePrice);
    if (ratio >= 0.95) return 1;
    if (ratio >= 0.8) return 0.7;
    if (ratio >= 0.6) return 0.4;
    return 0.1;
  }

  const MIN_MATCH_SCORE = 40;

  function scoreMatch(source, candidate) {
    const srcTokens = tokenize(source.title);
    const candTokens = tokenize(candidate.title);
    const titleSim = jaccard(srcTokens, candTokens);

    const srcJoined = srcTokens.join(' ');
    const candJoined = candTokens.join(' ');
    let containBonus = 0;
    if (srcJoined && candJoined) {
      if (candJoined.includes(srcJoined) || srcJoined.includes(candJoined)) containBonus = 0.1;
    }

    const brand = brandMatch(source.brand, candidate.title);
    const srcPrice = parsePrice(source.price);
    const candPrice = parsePrice(candidate.price);
    const price = priceScore(srcPrice, candPrice);

    const raw = (titleSim * 0.60) + (brand * 0.20) + (price * 0.20) + containBonus;
    const score = Math.min(100, Math.round(raw * 100));

    let label = 'low';
    if (score >= 90) label = 'same';
    else if (score >= 70) label = 'similar';
    else if (score >= MIN_MATCH_SCORE) label = 'possible';

    return { score, label, titleSim, brand, price };
  }

  function rankResults(source, candidates, limit = 3) {
    return candidates
      .map((c) => ({ ...c, match: scoreMatch(source, c) }))
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, limit);
  }

  function pickBest(source, candidates, minScore = MIN_MATCH_SCORE) {
    const ranked = rankResults(source, candidates, candidates.length)
      .filter((c) => c.match.score >= minScore);
    return ranked[0] || null;
  }

  return { scoreMatch, rankResults, pickBest, jaccard, brandMatch, priceScore, MIN_MATCH_SCORE };
}));
