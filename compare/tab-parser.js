// compare/tab-parser.js — DOM parsers injected into marketplace search tabs.
// Assigned to globalThis so executeScript can call it from the service worker.
(function () {
  function text(el) {
    return (el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  const SITE_HOSTS = {
    amazon: 'www.amazon.in',
    flipkart: 'www.flipkart.com',
    myntra: 'www.myntra.com',
    meesho: 'www.meesho.com',
    nykaa: 'www.nykaa.com',
  };

  function absUrl(href) {
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) return '';
    if (/^https?:\/\//i.test(href)) {
      try { return new URL(href).href; } catch { return ''; }
    }
    try {
      const u = new URL(href, location.href);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
    } catch { /* fall through */ }
    const host = globalThis.__RMF_SCRAPE_HOST;
    if (host) {
      const path = href.startsWith('/') ? href : `/${href}`;
      return `https://${host}${path}`;
    }
    return '';
  }

  function isNykaaProductUrl(url) {
    return /nykaa\.com/i.test(url) && /\/p\/\d+/i.test(url);
  }

  function parseAmazon() {
    const items = [];
    document.querySelectorAll('[data-asin]').forEach((el) => {
      const asin = el.getAttribute('data-asin');
      if (!asin || asin.length !== 10 || asin === '0000000000') return;
      const spans = [...el.querySelectorAll('h2 span, h2 a span, .a-text-normal')]
        .map((n) => text(n))
        .filter((t) => t.length >= 12);
      const title = spans.sort((a, b) => b.length - a.length)[0] || '';
      if (!title || title.length < 12) return;
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
    return items.slice(0, 25);
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

    function nykaaKey(url) {
      const m = String(url || '').match(/\/p\/(\d+)/i);
      return m ? `nykaa:${m[1]}` : absUrl(url);
    }

    function pushItem({ title, price, url, image }) {
      const abs = absUrl(url);
      const key = nykaaKey(abs);
      if (!abs || !isNykaaProductUrl(abs) || seen.has(key)) return;
      if (!title || title.length < 5) return;
      seen.add(key);
      items.push({
        title,
        price: price && !/^₹/.test(price) && /\d/.test(price) ? `₹${String(price).replace(/^price\s*/i, '').trim()}` : (price || ''),
        url: abs,
        image: image || '',
      });
    }

    document.querySelectorAll('.css-d5z3ro, [class*="productCard"], [class*="ProductCard"]').forEach((card) => {
      const link = card.querySelector('a[href*="/p/"]') || card.closest('a[href*="/p/"]');
      if (!link) return;
      const title = link.getAttribute('title')
        || text(card.querySelector('[class*="title"], h2, h3, .css-xrzmfa'))
        || text(link);
      const price = text(card.querySelector('[class*="price"], .css-111z9ua, span'));
      pushItem({
        title,
        price,
        url: link.getAttribute('href'),
        image: card.querySelector('img')?.src || '',
      });
    });

    if (!items.length) {
      document.querySelectorAll('a[href*="/p/"]').forEach((a) => {
        const title = a.getAttribute('title') || text(a.querySelector('[class*="title"], div'));
        const card = a.closest('div, li, article') || a.parentElement;
        const price = text(card?.querySelector('[class*="price"]'));
        pushItem({ title, price, url: a.getAttribute('href'), image: card?.querySelector('img')?.src || '' });
      });
    }

    return items.slice(0, 12);
  }

  const PARSERS = { amazon: parseAmazon, flipkart: parseFlipkart, myntra: parseMyntra, meesho: parseMeesho, nykaa: parseNykaa };

  function waitForSelector(selector, maxWaitMs, pollMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      function check() {
        try {
          if (document.querySelector(selector)) return resolve(true);
        } catch { /* invalid selector */ }
        if (Date.now() - start >= maxWaitMs) return resolve(false);
        setTimeout(check, pollMs);
      }
      check();
    });
  }

  globalThis.RMF_parseSearchPage = function (site) {
    const prevHost = globalThis.__RMF_SCRAPE_HOST;
    if (SITE_HOSTS[site]) globalThis.__RMF_SCRAPE_HOST = SITE_HOSTS[site];
    try {
      return (PARSERS[site] || (() => []))();
    } catch {
      return [];
    } finally {
      globalThis.__RMF_SCRAPE_HOST = prevHost;
    }
  };

  globalThis.RMF_waitAndParseSearchPage = async function (site, cfg = {}) {
    const prevHost = globalThis.__RMF_SCRAPE_HOST;
    if (SITE_HOSTS[site]) globalThis.__RMF_SCRAPE_HOST = SITE_HOSTS[site];
    const selector = cfg.readySelector || '[data-asin]';
    const maxWaitMs = cfg.maxWaitMs || 8000;
    const pollMs = cfg.pollIntervalMs || 300;
    try {
      await waitForSelector(selector, maxWaitMs, pollMs);
      return globalThis.RMF_parseSearchPage(site);
    } finally {
      globalThis.__RMF_SCRAPE_HOST = prevHost;
    }
  };
})();
