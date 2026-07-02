// compare/attribute-parser.js — extract structured product attributes from titles (no AI).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const query = require('../utils/product-query.js');
    module.exports = factory(query);
  } else {
    root.RMF_AttributeParser = factory(root.RMF_ProductQuery);
  }
}(typeof self !== 'undefined' ? self : this, function (ProductQuery) {
  const { inferBrandFromTitle, normalizeTitle, tokenize } = ProductQuery;

  /** Longest phrases first — map to canonical color. */
  const COLOR_PHRASES = [
    ['dusty pink', 'pink'], ['rose pink', 'pink'], ['blush pink', 'pink'], ['hot pink', 'pink'],
    ['light pink', 'pink'], ['dark pink', 'pink'], ['baby pink', 'pink'], ['pastel pink', 'pink'],
    ['navy blue', 'navy'], ['royal blue', 'blue'], ['sky blue', 'blue'], ['light blue', 'blue'],
    ['dark blue', 'blue'], ['midnight blue', 'navy'], ['teal blue', 'teal'],
    ['olive green', 'olive'], ['forest green', 'green'], ['light green', 'green'], ['dark green', 'green'],
    ['off white', 'white'], ['cream white', 'cream'], ['off-white', 'white'],
    ['charcoal grey', 'grey'], ['charcoal gray', 'grey'], ['light grey', 'grey'], ['dark grey', 'grey'],
    ['wine red', 'wine'], ['dark red', 'red'], ['light red', 'red'],
    ['mustard yellow', 'mustard'], ['golden yellow', 'gold'],
    ['multicolour', 'multicolor'], ['multi colour', 'multicolor'], ['multi color', 'multicolor'],
    ['blush', 'pink'], ['rose', 'pink'], ['maroon', 'maroon'], ['burgundy', 'burgundy'],
    ['navy', 'navy'], ['teal', 'teal'], ['coral', 'coral'], ['peach', 'peach'], ['mint', 'mint'],
    ['lavender', 'lavender'], ['magenta', 'magenta'], ['cyan', 'cyan'], ['beige', 'beige'],
    ['khaki', 'khaki'], ['tan', 'tan'], ['ivory', 'ivory'], ['cream', 'cream'],
    ['black', 'black'], ['white', 'white'], ['grey', 'grey'], ['gray', 'grey'],
    ['blue', 'blue'], ['red', 'red'], ['green', 'green'], ['yellow', 'yellow'],
    ['orange', 'orange'], ['purple', 'purple'], ['pink', 'pink'], ['brown', 'brown'],
    ['gold', 'gold'], ['silver', 'silver'], ['olive', 'olive'],
  ];

  const PATTERN_PHRASES = [
    ['all over print', 'printed'], ['all-over print', 'printed'], ['allover print', 'printed'],
    ['self design', 'printed'], ['self-design', 'printed'],
    ['checkered', 'checked'], ['check print', 'checked'], ['tartan', 'checked'], ['plaid', 'checked'],
    ['striped', 'striped'], ['stripe', 'striped'], ['stripes', 'striped'], ['pinstripe', 'striped'],
    ['graphic print', 'printed'], ['graphic', 'printed'], ['printed', 'printed'], ['print', 'printed'],
    ['floral', 'printed'], ['abstract', 'printed'], ['camouflage', 'printed'], ['camo', 'printed'],
    ['textured', 'textured'], ['ribbed', 'textured'], ['waffle', 'textured'], ['melange', 'textured'],
    ['heather', 'textured'], ['slub', 'textured'], ['jacquard', 'textured'],
    ['solid', 'solid'], ['plain', 'solid'],
    ['checked', 'checked'], ['check', 'checked'],
  ];

  const FIT_PHRASES = [
    ['regular fit', 'regular'], ['slim fit', 'slim'], ['relaxed fit', 'relaxed'],
    ['oversized fit', 'oversized'], ['loose fit', 'relaxed'], ['skinny fit', 'slim'],
    ['tapered fit', 'tapered'], ['straight fit', 'straight'], ['comfort fit', 'regular'],
    ['regular', 'regular'], ['slim', 'slim'], ['relaxed', 'relaxed'], ['oversized', 'oversized'],
    ['loose', 'relaxed'], ['skinny', 'slim'], ['tapered', 'tapered'], ['straight', 'straight'],
  ];

  const SLEEVE_PHRASES = [
    ['full sleeve', 'full'], ['full-sleeve', 'full'], ['long sleeve', 'full'], ['long-sleeve', 'full'],
    ['half sleeve', 'half'], ['half-sleeve', 'half'], ['short sleeve', 'short'], ['short-sleeve', 'short'],
    ['sleeveless', 'sleeveless'], ['cap sleeve', 'short'], ['three quarter', 'three-quarter'],
    ['3/4 sleeve', 'three-quarter'], ['roll up sleeve', 'roll-up'],
  ];

  const COLLAR_PHRASES = [
    ['button down', 'button-down'], ['button-down', 'button-down'], ['button up', 'button-down'],
    ['spread collar', 'spread'], ['mandarin collar', 'mandarin'], ['band collar', 'band'],
    ['polo collar', 'polo'], ['collared', 'collared'], ['round neck', 'round-neck'],
    ['crew neck', 'crew-neck'], ['v neck', 'v-neck'], ['v-neck', 'v-neck'], ['henley', 'henley'],
    ['hooded', 'hooded'], ['high neck', 'high-neck'], ['turtle neck', 'turtle-neck'],
    ['turtleneck', 'turtle-neck'], ['notch collar', 'notch'], ['lapel', 'lapel'],
  ];

  const FABRIC_PHRASES = [
    ['100% cotton', 'cotton'], ['pure cotton', 'cotton'], ['cotton blend', 'cotton-blend'],
    ['polyester blend', 'polyester'], ['linen blend', 'linen'], ['silk blend', 'silk'],
    ['denim', 'denim'], ['leather', 'leather'], ['suede', 'suede'], ['velvet', 'velvet'],
    ['cotton', 'cotton'], ['polyester', 'polyester'], ['linen', 'linen'], ['silk', 'silk'],
    ['wool', 'wool'], ['nylon', 'nylon'], ['rayon', 'rayon'], ['viscose', 'viscose'],
    ['georgette', 'georgette'], ['chiffon', 'chiffon'], ['satin', 'satin'], ['jersey', 'jersey'],
    ['fleece', 'fleece'], ['knit', 'knit'], ['knitted', 'knit'],
  ];

  const GENDER_PHRASES = [
    ['for men', 'men'], ['for women', 'women'], ['for boys', 'boys'], ['for girls', 'girls'],
    ["men's", 'men'], ["women's", 'women'], ["boys'", 'boys'], ["girls'", 'girls'],
    ['mens', 'men'], ['womens', 'women'],
    ['men', 'men'], ['women', 'women'], ['boys', 'boys'], ['girls', 'girls'],
    ['unisex', 'unisex'], ['male', 'men'], ['female', 'women'],
  ];

  const CATEGORY_PHRASES = [
    ['t-shirt', 't-shirt'], ['t shirt', 't-shirt'], ['tshirt', 't-shirt'], ['tee', 't-shirt'],
    ['lounge t-shirt', 't-shirt'], ['lounge tshirt', 't-shirt'], ['lounge tee', 't-shirt'],
    ['polo shirt', 'polo'], ['polo t-shirt', 'polo'], ['polo', 'polo'],
    ['formal shirt', 'shirt'], ['casual shirt', 'shirt'], ['dress shirt', 'shirt'], ['shirt', 'shirt'],
    ['jeans', 'jeans'], ['trousers', 'trousers'], ['pants', 'trousers'], ['chinos', 'trousers'],
    ['pajama', 'pajama'], ['pyjama', 'pajama'], ['pajamas', 'pajama'], ['pyjamas', 'pajama'],
    ['night suit', 'nightwear'], ['nightwear', 'nightwear'], ['night wear', 'nightwear'],
    ['lounge pant', 'lounge-pant'], ['lounge pants', 'lounge-pant'],
    ['shorts', 'shorts'], ['joggers', 'joggers'], ['track pants', 'track-pants'],
    ['jacket', 'jacket'], ['blazer', 'blazer'], ['hoodie', 'hoodie'], ['sweatshirt', 'sweatshirt'],
    ['sweater', 'sweater'], ['cardigan', 'cardigan'], ['kurta', 'kurta'], ['kurti', 'kurti'],
    ['saree', 'saree'], ['dress', 'dress'], ['skirt', 'skirt'], ['leggings', 'leggings'],
    ['coord set', 'coord-set'], ['co-ord set', 'coord-set'], ['shirt with pant', 'coord-set'],
    ['sneakers', 'sneakers'], ['shoes', 'shoes'], ['sandals', 'sandals'], ['boots', 'boots'],
    ['watch', 'watch'], ['handbag', 'handbag'], ['backpack', 'backpack'],
    ['lipstick', 'lipstick'], ['foundation', 'foundation'], ['perfume', 'perfume'],
    ['moisturizer', 'moisturizer'], ['serum', 'serum'], ['hair mask', 'hair-mask'],
    ['hair spa', 'hair-mask'], ['shampoo', 'shampoo'], ['conditioner', 'conditioner'],
  ];

  const MARKETING_NOISE = new Set([
    'buy', 'online', 'india', 'free', 'shipping', 'delivery', 'cod', 'off', 'sale', 'new', 'latest',
    'best', 'price', 'offer', 'deals', 'premium', 'collection', 'exclusive', 'trending', 'bestseller',
    'bestselling', 'prime', 'deal', 'today', 'limited', 'stock', 'only', 'left', 'genuine', 'original',
    'authentic', 'warranty', 'guarantee', 'seller', 'combo', 'pack', 'multipack', 'pair',
    'casual', 'formal', 'stylish', 'fashion', 'designer', 'classic', 'modern', 'imported',
  ]);

  function padSpaces(s) {
    return ` ${String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()} `;
  }

  function extractPhrase(text, phrases) {
    const hay = padSpaces(text);
    for (const [phrase, canonical] of phrases) {
      if (hay.includes(` ${phrase} `)) return canonical;
    }
    return '';
  }

  function extractColor(text) {
    const hay = padSpaces(text);
    for (const [phrase, canonical] of COLOR_PHRASES) {
      if (hay.includes(` ${phrase} `)) return canonical;
    }
    return '';
  }

  function normalizeColor(color) {
    if (!color) return '';
    const c = String(color).toLowerCase().trim();
    for (const [phrase, canonical] of COLOR_PHRASES) {
      if (c === phrase || c.includes(phrase)) return canonical;
    }
    return c;
  }

  function colorsMatch(a, b) {
    const ca = normalizeColor(a);
    const cb = normalizeColor(b);
    if (!ca || !cb) return null;
    return ca === cb;
  }

  function brandTokens(brand) {
    return tokenize(brand).filter((t) => t.length > 1);
  }

  function brandInText(brand, text) {
    const tokens = brandTokens(brand);
    if (!tokens.length) return false;
    const hay = padSpaces(text);
    return tokens.every((t) => hay.includes(` ${t} `) || hay.includes(t));
  }

  function inferBrand(title, explicitBrand) {
    if (explicitBrand) return String(explicitBrand).trim();
    return inferBrandFromTitle(title || '');
  }

  function buildNormalizedTitle(title, brand) {
    let s = normalizeTitle(title || '');
    const brandToks = brandTokens(brand);
    for (const t of brandToks) {
      s = s.replace(new RegExp(`\\b${t}\\b`, 'gi'), ' ');
    }
    const tokens = s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !MARKETING_NOISE.has(w));
    const unique = [];
    const seen = new Set();
    for (const t of tokens) {
      if (!seen.has(t)) { seen.add(t); unique.push(t); }
    }
    return unique.join(' ');
  }

  /**
   * @param {{ title?: string, brand?: string, color?: string, model?: string, size?: string, category?: string }} product
   */
  function parseAttributes(product) {
    const title = product?.title || '';
    const brand = inferBrand(title, product?.brand);
    const lower = title.toLowerCase();

    const attrs = {
      brand: brand || '',
      category: product?.category || extractPhrase(lower, CATEGORY_PHRASES),
      gender: extractPhrase(lower, GENDER_PHRASES),
      color: normalizeColor(product?.color || extractColor(lower)),
      pattern: extractPhrase(lower, PATTERN_PHRASES),
      fit: extractPhrase(lower, FIT_PHRASES),
      sleeve: extractPhrase(lower, SLEEVE_PHRASES),
      collar: extractPhrase(lower, COLLAR_PHRASES),
      fabric: extractPhrase(lower, FABRIC_PHRASES),
      size: product?.size || '',
      model: (product?.model || '').trim(),
      normalizedTitle: buildNormalizedTitle(title, brand),
      rawTitle: title,
    };

    if (!attrs.color && product?.color) attrs.color = normalizeColor(product.color);
    return attrs;
  }

  function attributeQueryTokens(attrs) {
    const parts = [];
    if (attrs.brand) parts.push(...brandTokens(attrs.brand));
    if (attrs.gender && attrs.gender !== 'unisex') parts.push(attrs.gender);
    if (attrs.color) parts.push(attrs.color);
    if (attrs.pattern) parts.push(attrs.pattern);
    if (attrs.fit) parts.push(attrs.fit);
    if (attrs.fabric) parts.push(attrs.fabric);
    if (attrs.category) parts.push(attrs.category.replace(/-/g, ' '));
    if (attrs.model) parts.push(attrs.model);
    const titleTokens = (attrs.normalizedTitle || '').split(/\s+/).filter(Boolean);
    for (const t of titleTokens) {
      if (!parts.includes(t)) parts.push(t);
    }
    return parts.slice(0, 10);
  }

  return {
    parseAttributes,
    normalizeColor,
    colorsMatch,
    brandInText,
    brandTokens,
    attributeQueryTokens,
    buildNormalizedTitle,
    extractColor,
    COLOR_PHRASES,
    PATTERN_PHRASES,
    MARKETING_NOISE,
  };
}));
