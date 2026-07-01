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
    'of', 'in', 'at', 'by', 'from', 'to', 'or', 'on', 'is', 'it',
    'seller', 'warranty', 'guarantee', 'genuine', 'original', 'authentic',
    'bestseller', 'bestselling', 'prime', 'deal', 'today', 'limited',
    'stock', 'only', 'left', 'pcs', 'piece', 'pieces', 'qty', 'quantity',
    'approx', 'approximately', 'inches', 'inch', 'cm', 'mm', 'meter',
    'year', 'years', 'edition', 'version', 'model', 'no', 'number',
  ]);

  const FILLER_PHRASES = [
    /\bpack\s+of\s+\d+\b/gi,
    /\b\d+\s*[-x×]\s*\d+\b/gi,
    /\bbest\s+seller\b/gi,
    /\bfree\s+shipping\b/gi,
    /\b\d+\s*%\s*off\b/gi,
    /\b(?:size|sz)\s*[:\-]?\s*\w+\b/gi,
  ];

  const SIZE_RE = /\b(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|5xl|\d{2,3}\s*(cm|inch|inches|in|mm|ml|l|kg|g))\b/i;

  const COLOR_TOKENS = new Set([
    'black', 'white', 'blue', 'red', 'green', 'yellow', 'orange', 'purple', 'pink',
    'grey', 'gray', 'brown', 'navy', 'maroon', 'beige', 'cream', 'gold', 'silver',
    'olive', 'teal', 'coral', 'burgundy', 'charcoal', 'ivory', 'khaki', 'multicolor',
    'mustard', 'lavender', 'magenta', 'cyan', 'tan', 'wine', 'peach', 'mint',
  ]);

  function isSizeToken(t) {
    return SIZE_RE.test(t);
  }

  function isColorToken(word) {
    const w = String(word).toLowerCase().replace(/[^a-z]/g, '');
    return w.length > 1 && COLOR_TOKENS.has(w);
  }

  /** @param {{ title?: string, brand?: string, color?: string }} product */
  function extractColorFromProduct(product) {
    if (product?.color) return String(product.color).toLowerCase().trim();
    const title = product?.title || '';
    const paren = title.match(/\(([^)]+)\)/);
    if (paren) {
      const first = paren[1].toLowerCase().trim().split(/[\s,/]+/)[0];
      if (isColorToken(first)) return first;
    }
    const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
    for (const w of words) {
      if (isColorToken(w)) return w;
    }
    return '';
  }
  const PAREN_RE = /\([^)]*\)|\[[^\]]*\]/g;

  /** Words that typically follow the brand prefix in marketplace titles. */
  const BRAND_STOP = new Set([
    'men', 'women', 'boys', 'girls', 'unisex', 'kid', 'kids', 'baby', 'infant',
    'regular', 'slim', 'fit', 'relaxed', 'loose', 'skinny', 'straight', 'tapered',
    'cotton', 'polyester', 'linen', 'silk', 'wool', 'nylon', 'denim', 'leather',
    'solid', 'printed', 'striped', 'checked', 'graphic', 'embroidered',
    'pack', 'combo', 'set', 'pair', 'multipack', 'multicolor',
    'new', 'latest', 'premium', 'classic', 'casual', 'formal', 'sports', 'running',
    'wireless', 'bluetooth', 'smart', 'digital', 'automatic', 'manual',
    'with', 'for', 'and', 'the',
  ]);

  function wordStem(w) {
    return String(w).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function isBrandStop(stem) {
    if (BRAND_STOP.has(stem)) return true;
    if (stem.length > 2 && stem.endsWith('s') && BRAND_STOP.has(stem.slice(0, -1))) return true;
    return false;
  }

  /** Infer leading brand tokens when `brand` metadata is missing (common on Amazon PDPs). */
  function inferBrandFromTitle(title) {
    if (!title) return '';
    const words = normalizeTitle(title).split(/\s+/).filter(Boolean);
    const brandWords = [];
    for (const w of words) {
      const stem = wordStem(w);
      if (!stem || stem.length < 2) continue;
      if (isBrandStop(stem)) break;
      if (isSizeToken(stem)) break;
      if (isColorToken(stem)) break;
      brandWords.push(w);
      if (brandWords.length >= 3) break;
    }
    return brandWords.join(' ');
  }

  function normalizeTitle(title) {
    if (!title) return '';
    let s = String(title);
    for (const re of FILLER_PHRASES) s = s.replace(re, ' ');
    return s
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

  /**
   * Build a short marketplace search query from a noisy product title + attributes.
   * @param {string} title
   * @param {{ brand?: string, color?: string, model?: string }} [attributes]
   * @returns {string}
   */
  function cleanQueryFromProduct(title, attributes = {}) {
    const brand = attributes.brand || '';
    const color = attributes.color || extractColorFromProduct({ title, brand });
    const model = (attributes.model || '').trim();
    let tokens = tokenize(title);

    if (brand) {
      const brandWords = tokenize(brand);
      const brandSet = new Set(brandWords);
      tokens = tokens.filter((t) => !brandSet.has(t));
      tokens = [...brandWords, ...tokens];
    }

    if (model) {
      const modelWords = tokenize(model).filter((t) => t.length > 1);
      tokens = [...modelWords, ...tokens];
    }

    const cleaned = tokens.filter((t) => !isSizeToken(t) && t.length > 1);
    const unique = [];
    const seen = new Set();
    for (const t of cleaned) {
      if (!seen.has(t)) { seen.add(t); unique.push(t); }
    }
    if (color && !seen.has(color)) unique.push(color);

    const query = unique.slice(0, 8).join(' ');
    const fallback = normalizeTitle(title).slice(0, 80);
    return query || fallback;
  }

  function buildSearchQuery(product) {
    const AP = (typeof self !== 'undefined' && self.RMF_AttributeParser)
      || (typeof global !== 'undefined' && global.RMF_AttributeParser);
    if (AP?.parseAttributes && AP?.attributeQueryTokens) {
      const attrs = AP.parseAttributes(product);
      const q = AP.attributeQueryTokens(attrs).join(' ');
      if (q) return q;
    }
    const brand = product?.brand || inferBrandFromTitle(product?.title || '');
    return cleanQueryFromProduct(product?.title || '', {
      brand,
      color: product?.color || extractColorFromProduct(product),
      model: product?.model,
    });
  }

  function parsePrice(text) {
    return priceMod.parsePrice(text);
  }

  return {
    normalizeTitle, tokenize, buildSearchQuery, cleanQueryFromProduct, parsePrice,
    extractColorFromProduct, inferBrandFromTitle, isColorToken, NOISE,
  };
}));
