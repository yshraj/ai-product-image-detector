// utils/trust-storage.js — seller trust, price history, false-positive corrections.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const priceMod = require('./price.js');
    const storageMod = require('./storage-local.js');
    module.exports = factory(priceMod, storageMod);
  } else {
    root.RMF_TrustStorage = factory(root.RMF_Price, root.RMF_StorageLocal);
  }
}(typeof self !== 'undefined' ? self : this, function (priceMod, storageMod) {
  const SELLER_KEY = 'rmf_seller_trust';
  const PRICE_KEY = 'rmf_price_history';
  const CORRECTIONS_KEY = 'rmf_corrections';

  const parsePrice = priceMod.parsePrice;
  const getLocal = storageMod.get;
  const setLocal = storageMod.set;

  function productId(url) {
    try { return new URL(url).pathname.slice(0, 120); } catch { return url || ''; }
  }

  async function recordSeller(seller, verdict) {
    if (!seller) return;
    const key = seller.trim().toLowerCase().slice(0, 80);
    if (!key) return;
    const all = await getLocal(SELLER_KEY, {});
    const cur = all[key] || { name: seller.trim(), aiGenerated: 0, likelyAi: 0, normal: 0, lastSeen: 0 };
    if (verdict === 'high') cur.aiGenerated++;
    else if (verdict === 'med') cur.likelyAi++;
    else cur.normal++;
    cur.lastSeen = Date.now();
    cur.name = seller.trim();
    all[key] = cur;
    await setLocal(SELLER_KEY, all);
  }

  async function getSellerTrust(seller) {
    if (!seller) return null;
    const key = seller.trim().toLowerCase().slice(0, 80);
    const all = await getLocal(SELLER_KEY, {});
    const s = all[key];
    if (!s) return null;
    const total = s.aiGenerated + s.likelyAi + s.normal;
    if (total < 3) return null;
    const aiPct = Math.round(((s.aiGenerated + s.likelyAi) / total) * 100);
    return { ...s, total, aiPct };
  }

  async function recordPrice(url, priceText) {
    const price = parsePrice(priceText);
    const id = productId(url);
    if (!id || price == null) return null;
    const all = await getLocal(PRICE_KEY, {});
    const hist = Array.isArray(all[id]) ? all[id] : [];
    const low = hist.length ? Math.min(...hist.map((h) => h.price)) : price;
    hist.push({ price, at: Date.now() });
    all[id] = hist.slice(-20);
    await setLocal(PRICE_KEY, all);
    return { isLowest: price <= low, price, low };
  }

  async function isCorrected(imageUrl) {
    const list = await getLocal(CORRECTIONS_KEY, []);
    return list.some((c) => c.imageUrl === imageUrl);
  }

  async function addCorrection(entry) {
    const list = await getLocal(CORRECTIONS_KEY, []);
    list.unshift({ ...entry, at: Date.now() });
    await setLocal(CORRECTIONS_KEY, list.slice(0, 200));
  }

  async function getCorrections() {
    return getLocal(CORRECTIONS_KEY, []);
  }

  async function getSellerList() {
    const all = await getLocal(SELLER_KEY, {});
    return Object.values(all)
      .map((s) => {
        const total = s.aiGenerated + s.likelyAi + s.normal;
        return { ...s, total, aiPct: total ? Math.round(((s.aiGenerated + s.likelyAi) / total) * 100) : 0 };
      })
      .filter((s) => s.total >= 3)
      .sort((a, b) => b.aiPct - a.aiPct);
  }

  return {
    recordSeller,
    getSellerTrust,
    recordPrice,
    isCorrected,
    addCorrection,
    getCorrections,
    getSellerList,
    productId,
  };
}));
