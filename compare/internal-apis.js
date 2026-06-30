// compare/internal-apis.js — Option B: direct JSON endpoints where available (free fallback).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_InternalApis = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';

  async function fetchJson(url, opts = {}) {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA, ...opts.headers },
      credentials: 'omit',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function searchMyntra(query) {
    const url = `https://www.myntra.com/gateway/v2/search/myntra?q=${encodeURIComponent(query)}&rows=12&plaEnabled=true`;
    const data = await fetchJson(url);
    const products = data?.products || data?.data?.products || [];
    return products.slice(0, 8).map((p) => ({
      title: [p.brand, p.productName || p.name].filter(Boolean).join(' '),
      price: p.price ? `₹${p.price}` : (p.mrp ? `₹${p.mrp}` : ''),
      url: p.landingPageUrl || (p.searchImage ? `https://www.myntra.com/${p.productId}` : ''),
      image: p.searchImage || p.imageURL || '',
    })).filter((i) => i.title && i.url);
  }

  async function searchMeesho(query) {
    const url = `https://www.meesho.com/api/v1/products/search?search=${encodeURIComponent(query)}&type=product&page=1&limit=12`;
    const data = await fetchJson(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    const items = data?.catalogs || data?.data?.catalogs || [];
    return items.slice(0, 8).map((p) => ({
      title: p.name || '',
      price: p.price ? `₹${p.price}` : '',
      url: p.slug ? `https://www.meesho.com/${p.slug}` : '',
      image: p.image || p.images?.[0] || '',
    })).filter((i) => i.title);
  }

  const SEARCHERS = {
    myntra: searchMyntra,
    meesho: searchMeesho,
  };

  async function searchViaInternalApi(site, query) {
    const fn = SEARCHERS[site];
    if (!fn) return [];
    try {
      return await fn(query);
    } catch {
      return [];
    }
  }

  return { searchViaInternalApi, SEARCHERS };
}));
