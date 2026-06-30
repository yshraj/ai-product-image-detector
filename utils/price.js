// utils/price.js — canonical INR price parsing for compare, trust, and matchers.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_Price = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  /**
   * Parse a price string to a number (INR), or null if not found.
   * @param {string|null|undefined} text
   * @returns {number|null}
   */
  function parsePrice(text) {
    if (!text) return null;
    const s = String(text).replace(/,/g, '');
    const m = s.match(/(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d{1,2})?)/i);
    return m ? Number(m[1]) : null;
  }

  /** @param {string|null|undefined} text @returns {number} */
  function parsePriceForSort(text) {
    return parsePrice(text) ?? Infinity;
  }

  return { parsePrice, parsePriceForSort };
}));
