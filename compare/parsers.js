// compare/parsers.js — extract product cards from marketplace search HTML.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_CompareParsers = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  function absUrl(href, base) {
    if (!href) return '';
    try {
      return new URL(href, base).href;
    } catch { return href; }
  }

  function decodeHtml(s) {
    return String(s || '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x27;/g, "'");
  }

  function stripTags(s) {
    return decodeHtml(String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }

  function uniqueBy(items, keyFn) {
    const seen = new Set();
    const out = [];
    for (const item of items) {
      const k = keyFn(item);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(item);
    }
    return out;
  }

  function parseAmazon(html, base) {
    const items = [];
    const re = /data-asin="([A-Z0-9]{10})"[^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/gi;
    let m;
    while ((m = re.exec(html)) !== null && items.length < 12) {
      const asin = m[1];
      if (asin === '0000000000') continue;
      const title = stripTags(m[2]);
      if (!title || title.length < 5) continue;
      const block = html.slice(m.index, m.index + 4000);
      const priceM = block.match(/class="a-price-whole"[^>]*>([\d,]+)/i)
        || block.match(/₹\s*([\d,]+)/);
      const price = priceM ? `₹${priceM[1]}` : '';
      items.push({
        title,
        price,
        url: `https://www.amazon.in/dp/${asin}`,
        image: '',
      });
    }
    return uniqueBy(items, (i) => i.url);
  }

  function parseFlipkart(html, base) {
    const items = [];
    // JSON blobs embedded in Flipkart pages often carry product data.
    const jsonRe = /"titles"\s*:\s*\{[^}]*"title"\s*:\s*"([^"]+)"/g;
    let jm;
    const titles = [];
    while ((jm = jsonRe.exec(html)) !== null && titles.length < 12) {
      titles.push(decodeHtml(jm[1]));
    }
    const linkRe = /href="(\/[^"]*\/p\/[^"]+)"/g;
    const links = [];
    let lm;
    while ((lm = linkRe.exec(html)) !== null && links.length < 12) {
      links.push(absUrl(lm[1], base));
    }
    const priceRe = /₹\s*([\d,]+)/g;
    const prices = [];
    let pm;
    while ((pm = priceRe.exec(html)) !== null && prices.length < 12) {
      prices.push(`₹${pm[1]}`);
    }
    const n = Math.min(titles.length, links.length, 12);
    for (let i = 0; i < n; i++) {
      items.push({ title: titles[i], price: prices[i] || '', url: links[i], image: '' });
    }
    if (!items.length) {
      const cardRe = /<a[^>]+href="([^"]*\/p\/[^"]+)"[^>]*>[\s\S]*?<div[^>]*>([^<]{10,120})<\/div>/gi;
      let cm;
      while ((cm = cardRe.exec(html)) !== null && items.length < 8) {
        items.push({
          title: stripTags(cm[2]),
          price: '',
          url: absUrl(cm[1], base),
          image: '',
        });
      }
    }
    return uniqueBy(items, (i) => i.url);
  }

  function parseMyntra(html, base) {
    const items = [];
    const re = /href="(\/[^"]+\/buy)"[^>]*>[\s\S]*?product-brand[^>]*>([^<]+)<[\s\S]*?product-product[^>]*>([^<]+)</gi;
    let m;
    while ((m = re.exec(html)) !== null && items.length < 12) {
      const brand = stripTags(m[2]);
      const name = stripTags(m[3]);
      const block = html.slice(m.index, m.index + 2000);
      const priceM = block.match(/₹\s*([\d,]+)/);
      items.push({
        title: brand ? `${brand} ${name}` : name,
        price: priceM ? `₹${priceM[1]}` : '',
        url: absUrl(m[1], base),
        image: '',
      });
    }
    if (!items.length) {
      const alt = /"productName"\s*:\s*"([^"]+)"[\s\S]*?"landingPageUrl"\s*:\s*"([^"]+)"[\s\S]*?"price"\s*:\s*(\d+)/g;
      let am;
      while ((am = alt.exec(html)) !== null && items.length < 12) {
        items.push({
          title: decodeHtml(am[1]),
          price: am[3] ? `₹${am[3]}` : '',
          url: absUrl(am[2], base),
          image: '',
        });
      }
    }
    return uniqueBy(items, (i) => i.url);
  }

  function parseMeesho(html, base) {
    const items = [];
    const re = /href="(\/[^"]+)"[^>]*class="[^"]*ProductCard[^"]*"[\s\S]*?<p[^>]*>([^<]{5,})<\/p>/gi;
    let m;
    while ((m = re.exec(html)) !== null && items.length < 12) {
      const block = html.slice(m.index, m.index + 1500);
      const priceM = block.match(/₹\s*([\d,]+)/);
      items.push({
        title: stripTags(m[2]),
        price: priceM ? `₹${priceM[1]}` : '',
        url: absUrl(m[1], base),
        image: '',
      });
    }
    if (!items.length) {
      const jsonRe = /"name"\s*:\s*"([^"]+)"[\s\S]*?"slug"\s*:\s*"([^"]+)"[\s\S]*?"price"\s*:\s*(\d+)/g;
      let jm;
      while ((jm = jsonRe.exec(html)) !== null && items.length < 12) {
        items.push({
          title: decodeHtml(jm[1]),
          price: jm[3] ? `₹${jm[3]}` : '',
          url: `https://www.meesho.com/${jm[2]}`,
          image: '',
        });
      }
    }
    return uniqueBy(items, (i) => i.url);
  }

  function parseNykaa(html, base) {
    const items = [];
    const re = /href="(\/[^"]+\/p\/[^"]+)"[^>]*>[\s\S]*?title="([^"]+)"/gi;
    let m;
    while ((m = re.exec(html)) !== null && items.length < 12) {
      const block = html.slice(m.index, m.index + 2000);
      const priceM = block.match(/₹\s*([\d,]+)/);
      items.push({
        title: decodeHtml(m[2]),
        price: priceM ? `₹${priceM[1]}` : '',
        url: absUrl(m[1], base),
        image: '',
      });
    }
    if (!items.length) {
      const alt = /"name"\s*:\s*"([^"]+)"[\s\S]*?"slug"\s*:\s*"([^"]+)"[\s\S]*?"price"\s*:\s*(\d+)/g;
      let am;
      while ((am = alt.exec(html)) !== null && items.length < 12) {
        items.push({
          title: decodeHtml(am[1]),
          price: am[3] ? `₹${am[3]}` : '',
          url: `https://www.nykaa.com/${am[2]}/p/${am[2]}`,
          image: '',
        });
      }
    }
    return uniqueBy(items, (i) => i.url);
  }

  const PARSERS = {
    amazon: parseAmazon,
    flipkart: parseFlipkart,
    myntra: parseMyntra,
    meesho: parseMeesho,
    nykaa: parseNykaa,
  };

  function parseSearchResults(site, html, baseUrl) {
    const fn = PARSERS[site];
    if (!fn || !html) return [];
    try {
      return fn(html, baseUrl || `https://${site}.com`);
    } catch {
      return [];
    }
  }

  return { parseSearchResults, PARSERS, absUrl, stripTags };
}));
