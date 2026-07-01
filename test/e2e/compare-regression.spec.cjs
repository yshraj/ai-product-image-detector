// Compare regression — live product/search pages exercising attribute-based matching.
// Run: npm run test:compare-regression  (requires network; ~15–25 min)
const { test, expect } = require('./fixtures/extension-real.fixture.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');
const { closeMarketplaceTabs } = require('./helpers/tab-utils.cjs');
const {
  ensureEvidenceDir,
  writeEvidence,
  appendSummary,
  screenshot,
  urlPatternFor,
  waitForProduct,
  runCompareWithDebug,
  printDebugReport,
  buildFailureTableHtml,
  collectPageErrors,
  parseResultCards,
  waitForCompareComplete,
  openComparePopup,
  verifyResultCards,
} = require('./helpers/compare-regression.cjs');
const fs = require('fs');
const path = require('path');

const REGRESSION_CASES = [
  {
    id: 'exact-same-product',
    name: 'Rare Rabbit pink solid shirt (Flipkart PDP)',
    url: 'https://www.flipkart.com/rare-rabbit-men-solid-casual-pink-shirt/p/itm154995e78d032',
    expectProduct: true,
    expectResults: true,
    minResults: 1,
    maxFreezeMs: 30_000,
    matchHints: { brand: /rare rabbit/i, color: /pink/i, pattern: /solid/i },
    description: 'Exact same product across marketplaces — brand + color + pattern should align',
  },
  {
    id: 'same-brand-checked',
    name: 'Snitch checked shirt (Myntra PDP)',
    url: 'https://www.myntra.com/shirts/snitch/snitch-men-checked-casual-shirt/41892912/buy',
    expectProduct: true,
    expectResults: true,
    minResults: 1,
    maxFreezeMs: 30_000,
    matchHints: { brand: /snitch/i, pattern: /checked/i },
    description: 'Same brand, checked pattern — solid vs checked discrimination',
  },
  {
    id: 'amazon-search-unsupported',
    name: 'Amazon search page (no content script)',
    url: 'https://www.amazon.in/s?k=rare+rabbit+pink+shirt',
    expectProduct: false,
    expectResults: false,
    maxFreezeMs: 15_000,
    description: 'Amazon has no content script — Compare should show empty state without crashing',
  },
  {
    id: 'flipkart-search-listing',
    name: 'Flipkart search results (Snitch checked)',
    url: 'https://www.flipkart.com/search?q=snitch+checked+shirt',
    expectProduct: false,
    expectResults: false,
    maxFreezeMs: 15_000,
    description: 'Search/listing page — no single product to compare',
  },
  {
    id: 'myntra-listing',
    name: 'Myntra category listing (men-shirts)',
    url: 'https://www.myntra.com/men-shirts',
    expectProduct: false,
    expectResults: false,
    maxFreezeMs: 15_000,
    description: 'Category listing — Compare should prompt to open a product page',
  },
];

test.describe.configure({ mode: 'serial', timeout: 180_000 });
test.use({ trace: 'retain-on-failure', screenshot: 'on', video: 'retain-on-failure' });

test.beforeAll(() => {
  ensureEvidenceDir();
});

test.beforeEach(async ({ extensionContext }) => {
  await closeMarketplaceTabs(extensionContext);
  await setSyncStorage(extensionContext, {
    serpApiKey: '',
    compareSites: ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa'],
    compareUseTabs: true,
    compareUseClip: true,
    compareDebugLog: true,
  });
});

for (const caseDef of REGRESSION_CASES) {
  test(`Compare regression — ${caseDef.name}`, async ({ extensionContext, popupUrl }, testInfo) => {
    const errors = { productPage: [], popup: [] };
    let product = null;
    let debugReport = null;
    let uiCards = [];
    let compareState = null;
    const failures = [];

    const productTab = await extensionContext.newPage();
    const productErr = await collectPageErrors(productTab);
    errors.productPage = productErr.errors;

    try {
      await productTab.goto(caseDef.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await productTab.waitForTimeout(3000);
      await screenshot(productTab, `${caseDef.id}-01-product-page`);

      const urlPattern = urlPatternFor(caseDef.url);

      if (caseDef.expectProduct) {
        product = await waitForProduct(extensionContext, urlPattern, caseDef.url, 45_000);
        expect(product?.title, 'content script should extract product title').toBeTruthy();
        expect(product?.isProductPage, 'should be a product page').not.toBe(false);

        if (caseDef.matchHints?.brand) {
          expect(`${product.brand || ''} ${product.title}`, 'brand hint').toMatch(caseDef.matchHints.brand);
        }
        if (caseDef.matchHints?.color) {
          expect(`${product.color || ''} ${product.title}`, 'color hint').toMatch(caseDef.matchHints.color);
        }
      } else {
        product = await waitForProduct(extensionContext, urlPattern, caseDef.url, 8_000);
        if (product?.title && product.isProductPage !== false) {
          failures.push('expected non-product page but product was extracted');
        }
      }

      const { popup } = await openComparePopup(extensionContext, popupUrl, caseDef.url);
      const popupErr = await collectPageErrors(popup);
      errors.popup = popupErr.errors;

      try {
        if (caseDef.expectProduct) {
          await expect.poll(async () => {
            const t = await popup.locator('#compare-title').textContent();
            return t && !/open a product page/i.test(t);
          }, { timeout: 20_000 }).toBe(true);
        }

        const skeletonVisible = await popup.locator('#compare-skeleton').isVisible().catch(() => false);
        if (skeletonVisible) {
          await screenshot(popup, `${caseDef.id}-02-loading`);
        }

        const freezeStart = Date.now();
        compareState = await waitForCompareComplete(popup, 120_000);
        const freezeElapsed = Date.now() - freezeStart;

        if (freezeElapsed > (caseDef.maxFreezeMs || 30_000) && !compareState.sawLoading) {
          failures.push(`UI appeared frozen for ${freezeElapsed}ms without loading indicator`);
        }

        await screenshot(popup, `${caseDef.id}-03-completed`);

        const skeletonHidden = await popup.locator('#compare-skeleton').isHidden();
        expect(skeletonHidden, 'loading skeleton should disappear').toBe(true);

        uiCards = await parseResultCards(popup);

        if (caseDef.expectResults) {
          const { issues, scores, count } = verifyResultCards(uiCards);
          if (count < (caseDef.minResults || 1)) {
            failures.push(`expected at least ${caseDef.minResults || 1} results, got ${count}`);
          }
          failures.push(...issues);

          if (product) {
            debugReport = await runCompareWithDebug(extensionContext, product);
            printDebugReport(caseDef.id, debugReport);

            if (debugReport.ranked?.length) {
              for (const r of debugReport.ranked) {
                if (r.matchScore != null && (r.matchScore < 0 || r.matchScore > 100)) {
                  failures.push(`debug score out of range: ${r.matchScore}`);
                }
              }
              const debugScores = debugReport.ranked.map((r) => r.matchScore).filter((s) => s != null);
              for (let i = 1; i < debugScores.length; i++) {
                if (debugScores[i] > debugScores[i - 1]) {
                  failures.push(`debug ranking not descending: ${debugScores.join(', ')}`);
                  break;
                }
              }
            } else {
              failures.push('debug pipeline returned zero ranked results');
            }
          }
        } else {
          const title = await popup.locator('#compare-title').textContent();
          const noProduct = /open a product page|category page/i.test(title || '');
          const emptyHint = await popup.locator('#compare-empty').isVisible().catch(() => false);
          if (!noProduct && !emptyHint && uiCards.length === 0) {
            failures.push(`expected empty compare state on non-product page, title="${title}"`);
          }
        }

        const statusText = await popup.locator('#compare-status').textContent().catch(() => '');
        expect(statusText || '', 'should not stay in Searching state').not.toMatch(/^Searching/i);
      } finally {
        await popup.close();
      }
    } catch (err) {
      failures.push(String(err?.message || err));
      await screenshot(productTab, `${caseDef.id}-FAIL-product`).catch(() => {});
    } finally {
      await productTab.close();
    }

    const jsErrors = [...errors.productPage, ...errors.popup].filter(
      (e) => !/favicon|404|net::ERR|ResizeObserver|Non-Error promise rejection/i.test(e),
    );

    const evidence = {
      caseId: caseDef.id,
      name: caseDef.name,
      url: caseDef.url,
      description: caseDef.description,
      product,
      compareState,
      uiCards,
      debugReport,
      jsErrors,
      failures,
      passed: failures.length === 0 && jsErrors.length === 0,
    };

    writeEvidence(`${caseDef.id}.json`, evidence);
    appendSummary({
      caseId: caseDef.id,
      name: caseDef.name,
      passed: evidence.passed,
      resultCount: uiCards.length,
      failures,
      jsErrorCount: jsErrors.length,
    });

    if (debugReport) {
      await testInfo.attach(`${caseDef.id}-debug.json`, {
        body: Buffer.from(JSON.stringify(debugReport, null, 2)),
        contentType: 'application/json',
      });
      fs.writeFileSync(
        path.join(process.cwd(), 'test-results', 'compare-regression', `${caseDef.id}-failure-table.html`),
        buildFailureTableHtml(caseDef.id, debugReport),
      );
    }

    if (jsErrors.length) {
      console.log(`[${caseDef.id}] JS errors:`, jsErrors);
    }

    if (failures.length) {
      console.log(`[${caseDef.id}] Failures:\n`, failures.map((f) => `  - ${f}`).join('\n'));
      if (debugReport) {
        console.log(`[${caseDef.id}] See test-results/compare-regression/${caseDef.id}-failure-table.html`);
      }
    }

    expect(failures, `Compare regression failures for ${caseDef.id}`).toEqual([]);
    expect(jsErrors, `JS errors on ${caseDef.id}`).toEqual([]);
  });
}

test.afterAll(() => {
  ensureEvidenceDir();
  const summaryPath = path.join(process.cwd(), 'test-results', 'compare-regression', 'summary.json');
  if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const passed = summary.filter((r) => r.passed).length;
    console.log(`\nCompare regression complete: ${passed}/${summary.length} passed`);
    console.log('Evidence: test-results/compare-regression/');
    console.log('HTML report: playwright-report/ (run npm run test:report)\n');
  }
});
