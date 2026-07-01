// Live scrape + evidence helpers for compare-real-products tests.
const fs = require('fs');
const path = require('path');
const { inServiceWorker } = require('./chrome-api.cjs');

const EVIDENCE_ROOT = path.join(process.cwd(), 'test-results', 'compare-real-products');

function ensureEvidenceDir() {
  fs.mkdirSync(EVIDENCE_ROOT, { recursive: true });
  fs.mkdirSync(path.join(EVIDENCE_ROOT, 'screenshots'), { recursive: true });
}

function evidencePath(...parts) {
  return path.join(EVIDENCE_ROOT, ...parts);
}

function writeEvidence(filename, data) {
  ensureEvidenceDir();
  fs.writeFileSync(evidencePath(filename), JSON.stringify(data, null, 2));
}

function appendSummary(tier, row) {
  ensureEvidenceDir();
  const file = evidencePath(`${tier}-summary.json`);
  const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  list.push({ ...row, recordedAt: new Date().toISOString() });
  fs.writeFileSync(file, JSON.stringify(list, null, 2));
}

function saveScreenshot(name, dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return;
  ensureEvidenceDir();
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(evidencePath('screenshots', `${name}.png`), Buffer.from(b64, 'base64'));
}

/**
 * Scrape candidates via extension hidden tab (Tier A mechanics).
 * @param {import('@playwright/test').BrowserContext} context
 */
async function scrapePlatform(context, platform, target) {
  const out = await inServiceWorker(context, async ({ plat, tgt }) => {
    const TabSearch = self.RMF_TabSearch;
    const config = self.RMF_CompareConfig;
    const logs = [];
    const log = (stage, msg) => logs.push({ stage, msg });

    if (!TabSearch || !config) {
      return { ok: false, error: 'compare modules not loaded', logs, candidates: [] };
    }

    let tabId = null;
    let screenshot = null;
    let result;

    try {
      if (tgt.type === 'search') {
        log('STAGE1', `query extraction → "${tgt.query}"`);
        log('STAGE2', `opening hidden tab on ${plat}`);
        result = await TabSearch.openHiddenSearchTab(plat, tgt.query, { timeoutMs: 25_000 });
        log('STAGE3', `scraped ${result.items?.length || 0} candidates`);
        if (result.error) log('STAGE3', `error: ${result.error}`);
        return {
          ok: result.ok !== false,
          url: result.url,
          query: tgt.query,
          error: result.error || null,
          candidates: result.items || [],
          logs,
        };
      }

      log('STAGE1', `listing URL → ${tgt.url}`);
      log('STAGE2', `opening hidden tab on ${plat}`);
      const mp = config.MARKETPLACES[plat];
      const scrapeConfig = mp?.scrape || {};
      const tab = await chrome.tabs.create({ url: tgt.url, active: false });
      tabId = tab.id;
      await TabSearch.waitForTabComplete(tabId, config.SCRAPE_TIMEOUT_MS || 10_000);
      try {
        screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      } catch { /* headless may block capture */ }
      const items = await TabSearch.scrapeTabProducts(tabId, plat, scrapeConfig);
      log('STAGE3', `scraped ${items.length} candidates from listing page`);
      const denied = await (async () => {
        try {
          const [{ result: blocked }] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => /access denied|captcha|robot/i.test(document.body?.innerText?.slice(0, 500) || ''),
          });
          return blocked;
        } catch { return false; }
      })();
      if (denied) log('STAGE3', 'page blocked (CAPTCHA / access denied)');
      result = {
        ok: !denied,
        url: tgt.url,
        error: denied ? 'blocked (CAPTCHA/access denied)' : null,
        candidates: items,
        logs,
        screenshot,
      };
      return result;
    } catch (err) {
      log('STAGE3', `exception: ${String(err?.message || err)}`);
      return { ok: false, error: String(err?.message || err), candidates: [], logs, url: tgt.url };
    } finally {
      if (tabId != null) chrome.tabs.remove(tabId).catch(() => {});
    }
  }, { plat: platform, tgt: target });

  for (const entry of out.logs || []) {
    console.log(`[${entry.stage}] ${platform}: ${entry.msg}`);
  }
  if (out.screenshot) saveScreenshot(`${platform}-${slug(target)}`, out.screenshot);

  return out;
}

function slug(target) {
  if (target.type === 'search') return target.query.replace(/\s+/g, '-').slice(0, 40);
  return (target.url || 'page').split('/').filter(Boolean).slice(-2).join('-').slice(0, 40);
}

function classifyZeroResult(out) {
  if ((out.candidates?.length || 0) > 0) return null;
  const err = (out.error || '').toLowerCase();
  const logText = (out.logs || []).map((l) => l.msg).join(' ').toLowerCase();
  if (/blocked|captcha|access denied|akamai/i.test(err + logText)) return 'blocked/CAPTCHA';
  if (/timeout/i.test(err + logText)) return 'timeout';
  if (/unknown platform/i.test(err)) return 'config error';
  return 'zero results (selector miss or genuinely empty)';
}

/**
 * Pick first Amazon.in product from search results page.
 * @param {import('@playwright/test').Page} page
 */
async function pickFirstAmazonProduct(page, searchQuery) {
  const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(searchQuery)}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(4000);

  const productUrl = await page.evaluate(() => {
    const cards = document.querySelectorAll('[data-asin]:not([data-asin=""])');
    for (const card of cards) {
      const asin = card.getAttribute('data-asin');
      if (!asin || asin.length < 8) continue;
      const link = card.querySelector('a[href*="/dp/"], h2 a, .a-link-normal[href*="/dp/"]');
      const href = link?.href || link?.getAttribute('href');
      if (!href) continue;
      const text = (card.innerText || '').toLowerCase();
      if (/currently unavailable|out of stock/i.test(text)) continue;
      return href.startsWith('http') ? href : `https://www.amazon.in${href}`;
    }
    const fallback = document.querySelector('a[href*="/dp/"]');
    if (fallback?.href) return fallback.href;
    return null;
  });

  if (!productUrl) return null;

  await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(3000);

  return page.evaluate(() => {
    const meta = (sel) => document.querySelector(sel)?.getAttribute('content')?.trim() || '';
    const title = meta('meta[property="og:title"]')
      || document.querySelector('#productTitle')?.textContent?.trim()
      || document.title;
    const image = meta('meta[property="og:image"]') || '';
    const price = meta('meta[property="og:price:amount"]')
      || (document.body.innerText.match(/₹\s?[\d,]+/) || [])[0]
      || '';
    const brand = meta('meta[property="og:brand"]') || '';
    return {
      site: 'amazon',
      title: title.replace(/\s+/g, ' ').slice(0, 200),
      brand,
      price: price ? (price.startsWith('₹') ? price : `₹${price}`) : '',
      image,
      url: location.href,
      isProductPage: true,
    };
  });
}

/**
 * Run full compare pipeline via service worker message.
 */
async function runComparePipeline(context, product, sites) {
  const { sendRuntimeMessage } = require('./chrome-messaging.cjs');
  const logs = [];
  logs.push({ stage: 'STAGE1', msg: `source: ${product.title?.slice(0, 80)}` });
  logs.push({ stage: 'STAGE2', msg: `searching: ${sites.join(', ')}` });

  const res = await sendRuntimeMessage(context, {
    type: 'RMF_COMPARE_SEARCH',
    product,
    sites,
  });

  logs.push({
    stage: 'STAGE3',
    msg: `results: ${(res.results || []).map((r) => `${r.site}=${r.ok ? (r.best ? 'match' : 'empty') : 'fail'}`).join(', ')}`,
  });
  logs.push({ stage: 'STAGE4', msg: `matches=${res.matches?.length || 0}` });

  for (const entry of logs) console.log(`[${entry.stage}] ${entry.msg}`);

  const top5 = (res.matches || []).slice(0, 5).map((m) => ({
    site: m.site,
    title: m.best?.title,
    price: m.best?.price,
    url: m.best?.url,
    image: m.best?.image,
    score: m.best?.match?.score,
    label: m.best?.match?.label,
  }));

  return { res, logs, top5 };
}

module.exports = {
  EVIDENCE_ROOT,
  ensureEvidenceDir,
  writeEvidence,
  appendSummary,
  scrapePlatform,
  classifyZeroResult,
  pickFirstAmazonProduct,
  runComparePipeline,
};
