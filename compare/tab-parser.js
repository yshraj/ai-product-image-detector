// compare/tab-parser.js — DOM parsers injected into marketplace search tabs.
// Assigned to globalThis so executeScript can call it from the service worker.
(function () {
  function text(el) {
    return (el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function absUrl(href) {
    try { return new URL(href, location.href).href; } catch { return href || ''; }
  }

  function parseAmazon() {
    const items = [];
    document.querySelectorAll('[data-asin]').forEach((el) => {
      const asin = el.getAttribute('data-asin');
      if (!asin || asin.length !== 10 || asin === '0000000000') return;
      const titleEl = el.querySelector('h2 a span, h2 span, .a-text-normal');
      const title = text(titleEl);
      if (!title || title.length < 5) return;
      const priceEl = el.querySelector('.a-price-whole, .a-offscreen');
      const priceRaw = text(priceEl);
      const price = priceRaw.match(/₹|(\d)/) ? (priceRaw.startsWith('₹') ? priceRaw : `₹${priceRaw}`) : '';
      items.push({
        title,
        price,
        url: `https://www.amazon.in/dp/${asin}`,
        image: el.querySelector('img')?.src || '',
      });
    });
    return items.slice(0, 12);
  }

  function parseFlipkart() {
    const items = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="/p/"]').forEach((a) => {
      const url = absUrl(a.getAttribute('href'));
      if (!url || seen.has(url)) return;
      const card = a.closest('[data-id], ._1AtVbE, .tUxRFH, ._4ddWXP, li, div');
      const titleEl = card?.querySelector('a[title], .KzDlHZ, .wjcEIp, .IRpwTa, div[class*="title"]') || a;
      const title = a.getAttribute('title') || text(titleEl);
      if (!title || title.length < 5) return;
      seen.add(url);
      const priceEl = card?.querySelector('._30jeq3, .Nx9bqj, [class*="price"]');
      items.push({ title, price: text(priceEl), url, image: card?.querySelector('img')?.src || '' });
    });
    return items.slice(0, 12);
  }

  function parseMyntra() {
    const items = [];
    document.querySelectorAll('li.product-base, .product-base').forEach((el) => {
      const brand = text(el.querySelector('.product-brand'));
      const name = text(el.querySelector('.product-product'));
      const title = brand ? `${brand} ${name}` : name;
      if (!title || title.length < 5) return;
      const link = el.querySelector('a[href]');
      const price = text(el.querySelector('.product-discountedPrice, .product-price'));
      items.push({
        title,
        price: price ? (price.startsWith('₹') ? price : `₹${price}`) : '',
        url: absUrl(link?.getAttribute('href')),
        image: el.querySelector('img')?.src || '',
      });
    });
    return items.filter((i) => i.url).slice(0, 12);
  }

  function parseMeesho() {
    const items = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="/"]').forEach((a) => {
      const card = a.closest('[class*="ProductCard"], [class*="product-card"]');
      if (!card) return;
      const url = absUrl(a.getAttribute('href'));
      if (!url || seen.has(url) || !url.includes('meesho.com')) return;
      const title = text(card.querySelector('p, h2, [class*="title"]'));
      if (!title || title.length < 5) return;
      seen.add(url);
      const price = text(card.querySelector('[class*="price"], span'));
      items.push({ title, price, url, image: card.querySelector('img')?.src || '' });
    });
    return items.slice(0, 12);
  }

  function parseNykaa() {
    const items = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="/p/"], a[href*="product"]').forEach((a) => {
      const url = absUrl(a.getAttribute('href'));
      if (!url || seen.has(url)) return;
      const title = a.getAttribute('title') || text(a.querySelector('[class*="title"], .css-xrzmfa, div'));
      if (!title || title.length < 5) return;
      seen.add(url);
      const card = a.closest('div[class*="product"], li, article') || a.parentElement;
      const price = text(card?.querySelector('[class*="price"], .css-111z9ua'));
      items.push({ title, price, url, image: card?.querySelector('img')?.src || '' });
    });
    return items.slice(0, 12);
  }

  const PARSERS = { amazon: parseAmazon, flipkart: parseFlipkart, myntra: parseMyntra, meesho: parseMeesho, nykaa: parseNykaa };

  globalThis.RMF_parseSearchPage = function (site) {
    try {
      return (PARSERS[site] || (() => []))();
    } catch {
      return [];
    }
  };
})();
