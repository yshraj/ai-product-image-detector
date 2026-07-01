// test/unit/tab-parser.test.cjs — per-platform DOM scrapers via Playwright page context
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const FIXTURES = path.join(__dirname, '../fixtures');
const PARSER_PATH = path.join(__dirname, '../../compare/tab-parser.js');

const CASES = [
  { site: 'amazon', fixture: 'amazon-search.html', expectTitle: /Roadster/i },
  { site: 'flipkart', fixture: 'flipkart-search.html', minItems: 1 },
  { site: 'myntra', fixture: 'myntra-search.html', expectTitle: /Roadster/i },
  { site: 'nykaa', fixture: 'nykaa-search.html', expectTitle: /Maybelline/i },
];

let browser;

test.before(async () => {
  browser = await chromium.launch();
});

test.after(async () => {
  await browser?.close();
});

for (const case_ of CASES) {
  test(`tab-parser scrapes ${case_.site} search fixture`, async () => {
    const page = await browser.newPage();
    const html = fs.readFileSync(path.join(FIXTURES, case_.fixture), 'utf8');
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: PARSER_PATH });

    const items = await page.evaluate(async (site) => {
      if (typeof globalThis.RMF_waitAndParseSearchPage === 'function') {
        return await globalThis.RMF_waitAndParseSearchPage(site, {
          readySelector: 'body',
          maxWaitMs: 500,
          pollIntervalMs: 50,
        });
      }
      return globalThis.RMF_parseSearchPage(site);
    }, case_.site);

    await page.close();
    assert.ok(Array.isArray(items));
    if (case_.minItems) assert.ok(items.length >= case_.minItems);
    else assert.ok(items.length >= 1);
    if (case_.expectTitle) assert.match(items[0].title, case_.expectTitle);
    assert.ok(items[0].url);
  });
}

test('tab-parser waitForSelector polls before parsing empty DOM', async () => {
  const page = await browser.newPage();
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ path: PARSER_PATH });

  const promise = page.evaluate(async () => {
    const parsePromise = globalThis.RMF_waitAndParseSearchPage('amazon', {
      readySelector: '[data-asin]',
      maxWaitMs: 2000,
      pollIntervalMs: 100,
    });
    await new Promise((r) => setTimeout(r, 300));
    const el = document.createElement('div');
    el.setAttribute('data-asin', 'B0LATE1234');
    el.innerHTML = '<h2><span>Late Loaded Shoe</span></h2><span class="a-price-whole">999</span>';
    document.body.appendChild(el);
    return parsePromise;
  });

  const items = await promise;
  await page.close();
  assert.ok(items.length >= 1);
  assert.match(items[0].title, /Late Loaded/i);
});
