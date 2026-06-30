// utils/product-query.js — build optimized search queries from product metadata.
// UMD: window/self in extension, module.exports for Node tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const priceMod = require('./price.js');
    module.exports = factory(priceMod);
  } else {
    root.RMF_ProductQuery = factory(root.RMF_Price);
  }
}(typeof self !== 'undefined' ? self : this, function (priceMod) {
  const NOISE = new Set([
    'buy', 'online', 'india', 'free', 'shipping', 'delivery', 'cod',
    'off', 'sale', 'new', 'latest', 'best', 'price', 'offer', 'deals',
    'men', 'women', 'boys', 'girls', 'unisex', 'pack', 'combo', 'set',
    'size', 'colour', 'color', 'with', 'for', 'and', 'the', 'a', 'an',
  ]);

  const SIZE_RE = /\b(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|5xl|\d{2,3}\s*(cm|inch|inches|in|mm|ml|l|kg|g|gb|tb))\b/i;

  function isSizeToken(t) {
    return SIZE_RE.test(t);
  }
  const PAREN_RE = /\([^)]*\)|\[[^\]]*\]/g;

  function normalizeTitle(title) {
    if (!title) return '';
    return String(title)
      .replace(PAREN_RE, ' ')
      .replace(/[|/\\–—]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(text) {
    return normalizeTitle(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !NOISE.has(w));
  }

  function buildSearchQuery(product) {
    const title = normalizeTitle(product?.title || '');
    const brand = (product?.brand || '').trim();
    let tokens = tokenize(title);

    if (brand) {
      const brandWords = tokenize(brand);
      const brandSet = new Set(brandWords);
      tokens = tokens.filter((t) => !brandSet.has(t));
      tokens = [...brandWords, ...tokens];
    }

    // Drop size/color tokens — they hurt cross-marketplace search.
    const cleaned = tokens.filter((t) => !isSizeToken(t) && t.length > 1);
    const unique = [];
    const seen = new Set();
    for (const t of cleaned) {
      if (!seen.has(t)) { seen.add(t); unique.push(t); }
    }

    const query = unique.slice(0, 8).join(' ');
    return query || title.slice(0, 80);
  }

  function parsePrice(text) {
    return priceMod.parsePrice(text);
  }

  return { normalizeTitle, tokenize, buildSearchQuery, parsePrice, NOISE };
}));
