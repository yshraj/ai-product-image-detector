// utils/product-fingerprint.js — stable product identity for compare cache invalidation.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_ProductFingerprint = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  function simpleHash(text) {
    let h = 0;
    const s = String(text || '');
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /** @param {string} url @param {string} [site] */
  function extractProductId(url, site) {
    if (!url) return '';
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      const path = u.pathname;

      if (site === 'amazon' || host.includes('amazon.')) {
        const m = path.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
        return m?.[1]?.toUpperCase() || '';
      }
      if (site === 'flipkart' || host.includes('flipkart')) {
        const pid = u.searchParams.get('pid');
        if (pid && pid.length > 3) return pid;
        const m = path.match(/\/p\/(itm[^/?]+)/i) || path.match(/\/p\/([^/?]+)/i);
        return m?.[1] || '';
      }
      if (site === 'myntra' || host.includes('myntra')) {
        const m = path.match(/(\d{6,})/);
        return m?.[1] || path.replace(/\/buy\/?$/, '');
      }
      if (site === 'meesho' || host.includes('meesho')) {
        const m = path.match(/\/product\/([^/?]+)/i);
        return m?.[1] || '';
      }
      if (site === 'nykaa' || host.includes('nykaa')) {
        const m = path.match(/\/p\/(\d+)/i) || path.match(/\/(\d{6,})(?:\/|$)/);
        return m?.[1] || '';
      }
    } catch { /* invalid URL */ }
    return '';
  }

  /**
   * @param {{ site?: string, url?: string, title?: string, image?: string }} product
   * @returns {string}
   */
  function productFingerprint(product) {
    if (!product) return '';
    const site = product.site || '';
    const pid = extractProductId(product.url || '', site);
    if (pid && String(pid).length > 2) return `${site}:${pid}`;

    const title = String(product.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const image = String(product.image || '').split('?')[0];
    if (!title && !image) return `${site}:${product.url || ''}`;
    return `${site}:t${simpleHash(title)}:i${simpleHash(image)}`;
  }

  return { productFingerprint, extractProductId, simpleHash };
}));
