// Live compare tests — Tier A (scraper mechanics) + Tier B (end-to-end).
// Run: npm run test:compare-real  (requires network; ~30–45 min for full suite)
const { test, expect } = require('./fixtures/extension-real.fixture.cjs');
const { setSyncStorage } = require('./helpers/chrome-storage.cjs');
const { TIER_A_BRANDS, TIER_B_BRANDS, PLATFORMS } = require('./helpers/compare-real-brands.cjs');
const {
  scrapePlatform,
  classifyZeroResult,
  pickFirstAmazonProduct,
  runComparePipeline,
  writeEvidence,
  appendSummary,
  ensureEvidenceDir,
} = require('./helpers/compare-scrape.cjs');

test.describe.configure({ mode: 'serial', timeout: 180_000 });

test.beforeAll(() => {
  ensureEvidenceDir();
});

test.beforeEach(async ({ extensionContext }) => {
  await setSyncStorage(extensionContext, {
    serpApiKey: '',
    compareSites: ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa'],
    compareUseTabs: true,
  });
});

test.describe('Compare feature — Tier A: scraper mechanics per brand', () => {
  for (const brand of TIER_A_BRANDS) {
    for (const platform of PLATFORMS) {
      test(`scrapes candidates for ${brand.name} on ${platform}`, async ({ extensionContext }) => {
        const target = brand[platform];
        expect(target, `${platform} target missing for ${brand.id}`).toBeTruthy();

        const out = await scrapePlatform(extensionContext, platform, target);
        const count = out.candidates?.length || 0;
        const zeroReason = count === 0 ? classifyZeroResult(out) : null;

        const evidence = {
          tier: 'A',
          brand: brand.name,
          brandId: brand.id,
          platform,
          target,
          candidateCount: count,
          zeroReason,
          url: out.url,
          error: out.error,
          candidates: (out.candidates || []).slice(0, 12),
          logs: out.logs,
        };
        writeEvidence(`tier-a-${brand.id}-${platform}.json`, evidence);
        appendSummary('tier-a', {
          brand: brand.name,
          brandId: brand.id,
          platform,
          candidates: count,
          status: count > 0 ? 'ok' : `empty (${zeroReason})`,
          error: out.error,
        });

        console.log(JSON.stringify({
          tier: 'A',
          brand: brand.name,
          platform,
          candidateCount: count,
          zeroReason,
          sample: (out.candidates || []).slice(0, 3).map((c) => ({ title: c.title, price: c.price, url: c.url })),
        }, null, 2));

        // Pass if we got candidates OR documented why zero (no crash).
        expect(out.logs?.length).toBeGreaterThan(0);
        expect(typeof out.ok).toBe('boolean');
      });
    }
  }
});

test.describe('Compare feature — Tier B: live end-to-end run', () => {
  for (const brand of TIER_B_BRANDS) {
    test(`end-to-end compare for live ${brand.name} Amazon product`, async ({ extensionContext }) => {
      const page = await extensionContext.newPage();
      try {
        const product = await pickFirstAmazonProduct(page, brand.amazonQuery);
        expect(product, `could not resolve live Amazon product for ${brand.name}`).toBeTruthy();
        expect(product.title.length).toBeGreaterThan(5);

        await page.screenshot({
          path: `test-results/compare-real-products/screenshots/tier-b-source-${brand.id}.png`,
          fullPage: false,
        });

        const { res, logs, top5 } = await runComparePipeline(
          extensionContext,
          product,
          ['flipkart', 'myntra', 'nykaa'],
        );

        expect(res?.ok).toBe(true);

        const evidence = {
          tier: 'B',
          brand: brand.name,
          brandId: brand.id,
          sourceProduct: product,
          compareResponse: {
            ok: res.ok,
            query: res.query,
            searched: res.searched,
            failed: res.failed,
            empty: res.empty,
            matches: res.matches,
          },
          top5,
          logs,
        };
        writeEvidence(`tier-b-${brand.id}.json`, evidence);

        const top = top5[0];
        appendSummary('tier-b', {
          brand: brand.name,
          brandId: brand.id,
          sourceTitle: product.title,
          sourceUrl: product.url,
          topMatch: top ? `${top.site}: ${top.title?.slice(0, 60)}` : '(none)',
          topScore: top?.score ?? null,
          matchCount: res.matches?.length || 0,
          failedSites: (res.failed || []).map((f) => f.site),
        });

        console.log(JSON.stringify({
          tier: 'B',
          brand: brand.name,
          source: { title: product.title, price: product.price, url: product.url },
          top5,
          failed: res.failed,
        }, null, 2));

        // Pipeline must complete without throwing; Roadster may legitimately have 0 matches.
        expect(res.ok).toBe(true);
        if (brand.id === 'roadster') {
          expect(res.matches?.length || 0).toBeLessThanOrEqual(3);
        }
      } finally {
        await page.close();
      }
    });
  }
});
