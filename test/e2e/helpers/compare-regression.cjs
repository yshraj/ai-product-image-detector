// Compare regression helpers — live PDP/search tests with debug evidence.
const fs = require('fs');
const path = require('path');
const { inServiceWorker } = require('./chrome-api.cjs');
const { sendRuntimeMessage } = require('./chrome-messaging.cjs');

const EVIDENCE_ROOT = path.join(process.cwd(), 'test-results', 'compare-regression');

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

function appendSummary(row) {
  ensureEvidenceDir();
  const file = evidencePath('summary.json');
  const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  list.push({ ...row, recordedAt: new Date().toISOString() });
  fs.writeFileSync(file, JSON.stringify(list, null, 2));
}

async function screenshot(page, name) {
  ensureEvidenceDir();
  const file = evidencePath('screenshots', `${name}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  return file;
}

function urlPatternFor(url) {
  const host = new URL(url).host;
  if (host.includes('flipkart')) return 'https://www.flipkart.com/*';
  if (host.includes('myntra')) return 'https://www.myntra.com/*';
  if (host.includes('amazon')) return 'https://www.amazon.in/*';
  if (host.includes('meesho')) return 'https://www.meesho.com/*';
  if (host.includes('nykaa')) return 'https://www.nykaa.com/*';
  return `${new URL(url).origin}/*`;
}

async function activateTab(context, urlPattern, urlPart) {
  return inServiceWorker(context, async ({ pattern, needle }) => {
    const tabs = await chrome.tabs.query({ url: [pattern] });
    const tab = tabs.find((t) => t.url?.includes(needle)) || tabs[tabs.length - 1];
    if (tab?.id) await chrome.tabs.update(tab.id, { active: true });
    return tab?.url || null;
  }, { pattern: urlPattern, needle: urlPart });
}

async function waitForProduct(context, urlPattern, exactUrl, timeoutMs = 45_000) {
  const { getProduct } = require('./chrome-messaging.cjs');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const product = await getProduct(context, urlPattern, exactUrl);
    if (product?.title && product.isProductPage !== false) return product;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return getProduct(context, urlPattern, exactUrl);
}

async function runCompareWithDebug(context, product, sites = ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa']) {
  const debug = await inServiceWorker(context, async ({ prod, siteList }) => {
    const CompareSearch = self.RMF_CompareSearch;
    const AttributeParser = self.RMF_AttributeParser;
    const Similarity = self.RMF_CompareSimilarity;
    const TabSearch = self.RMF_TabSearch;
    const ClipBridge = self.RMF_ClipBridge;

    if (!CompareSearch || !AttributeParser) {
      return { ok: false, error: 'compare modules not loaded' };
    }

    const cfg = await chrome.storage.sync.get({
      compareUseClip: true,
      compareDebugLog: true,
      compareUseTabs: true,
    });

    const sourceAttributes = AttributeParser.parseAttributes(prod);
    const clipEnabled = cfg.compareUseClip !== false && !!prod?.image;

    const data = await CompareSearch.searchAll(prod, siteList, {
      tabFetchFn: TabSearch?.fetchSearchPageViaTab || null,
      compareUseTabs: cfg.compareUseTabs === true,
      clipBridge: ClipBridge,
      useClip: clipEnabled,
      debug: cfg.compareDebugLog === true,
    });

    const rankedUrls = new Set((data.ranked || []).map((r) => r.url));
    const rejected = [];

    for (const siteResult of data.results || []) {
      for (const cand of siteResult.candidates || []) {
        if (rankedUrls.has(cand.url)) continue;
        const scored = Similarity?.scoreCandidateMatch
          ? Similarity.scoreCandidateMatch(prod, cand, 0)
          : { finalScore: 0, breakdown: {}, candidateAttrs: {} };
        rejected.push({
          site: siteResult.site,
          title: cand.title,
          url: cand.url,
          brand: scored.candidateAttrs?.brand || '',
          color: scored.candidateAttrs?.color || '',
          pattern: scored.candidateAttrs?.pattern || '',
          fit: scored.candidateAttrs?.fit || '',
          imageScore: 0,
          textScore: Math.round((scored.titleScore || 0) * 100),
          finalScore: Math.round((scored.finalScore || 0) * 100),
          reason: scored.finalScore < 0.12 ? 'below MIN_FINAL_SCORE' : 'outranked',
          breakdown: scored.breakdown,
        });
      }
    }

    rejected.sort((a, b) => b.finalScore - a.finalScore);

    return {
      ok: data.ok !== false,
      query: data.query,
      sourceProduct: prod,
      sourceAttributes,
      clipEnabled,
      candidateCounts: (data.results || []).map((r) => ({
        site: r.site,
        ok: r.ok,
        count: r.candidates?.length || 0,
        error: r.error || null,
      })),
      ranked: (data.ranked || []).map((r, i) => ({
        rank: i + 1,
        site: r.site,
        title: r.title,
        url: r.url,
        image: r.image,
        finalScore: r.finalScore,
        matchScore: r.match?.score,
        label: r.match?.label,
        brand: r.match?.breakdown?.brand,
        color: r.match?.breakdown?.color,
        pattern: r.match?.breakdown?.pattern,
        fit: r.match?.breakdown?.fit,
        imageScore: r.match?.breakdown?.image?.score,
        textScore: r.match?.textScore,
        breakdown: r.match?.breakdown,
      })),
      failed: data.failed,
      empty: data.empty,
      rejected: rejected.slice(0, 15),
    };
  }, { prod: product, siteList: sites });

  return debug;
}

function printDebugReport(caseId, report) {
  console.log('\n========== Compare regression debug:', caseId, '==========');
  console.log('Source product:', JSON.stringify(report.sourceProduct, null, 2));
  console.log('Source attributes:', JSON.stringify(report.sourceAttributes, null, 2));
  console.log('Search query:', report.query);
  console.log('CLIP enabled:', report.clipEnabled);
  console.log('Candidate counts:', report.candidateCounts);
  console.log('Ranking order:');
  for (const r of report.ranked || []) {
    console.log(`  #${r.rank} [${r.matchScore}%] ${r.site} — ${r.title?.slice(0, 70)}`);
    console.log(`      brand=${JSON.stringify(r.brand)} color=${JSON.stringify(r.color)} pattern=${JSON.stringify(r.pattern)} image=${r.imageScore} text=${r.textScore}`);
  }
  if (report.rejected?.length) {
    console.log('Top rejected:');
    for (const r of report.rejected.slice(0, 5)) {
      console.log(`  [${r.finalScore}%] ${r.site} — ${r.title?.slice(0, 60)} (${r.reason})`);
    }
  }
  console.log('================================================\n');
}

function buildFailureTableHtml(caseId, report) {
  const rows = [
    ...(report.ranked || []).map((r) => ({
      status: 'ranked',
      ...r,
      brand: r.breakdown?.brand?.ok ? '✔' : '✖',
      color: r.breakdown?.color?.ok ? '✔' : '✖',
      pattern: r.breakdown?.pattern?.ok ? '✔' : '✖',
      fit: r.breakdown?.fit?.ok ? '✔' : '✖',
      imageScore: r.breakdown?.image?.score ?? r.imageScore ?? '—',
      textScore: r.textScore ?? '—',
      finalScore: r.matchScore ?? Math.round((r.finalScore || 0) * 100),
      reason: r.label || 'ranked',
    })),
    ...(report.rejected || []).map((r) => ({
      status: 'rejected',
      site: r.site,
      title: r.title,
      brand: r.brand,
      color: r.color,
      pattern: r.pattern,
      fit: r.fit,
      imageScore: r.imageScore,
      textScore: r.textScore,
      finalScore: r.finalScore,
      reason: r.reason,
    })),
  ];

  const header = `
    <tr>
      <th>Status</th><th>Site</th><th>Candidate</th><th>Brand</th><th>Color</th>
      <th>Pattern</th><th>Fit</th><th>Image</th><th>Text</th><th>Final</th><th>Reason</th>
    </tr>`;

  const body = rows.map((r) => `
    <tr>
      <td>${r.status}</td><td>${r.site || ''}</td><td>${escapeHtml(r.title || '')}</td>
      <td>${r.brand ?? '—'}</td><td>${r.color ?? '—'}</td><td>${r.pattern ?? '—'}</td>
      <td>${r.fit ?? '—'}</td><td>${r.imageScore ?? '—'}</td><td>${r.textScore ?? '—'}</td>
      <td>${r.finalScore ?? '—'}</td><td>${r.reason ?? ''}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Compare failure — ${caseId}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
  h2 { margin-top: 24px; }
  pre { background: #f9fafb; padding: 12px; overflow: auto; }
</style></head><body>
  <h1>Compare regression — ${escapeHtml(caseId)}</h1>
  <h2>Source product</h2>
  <pre>${escapeHtml(JSON.stringify(report.sourceProduct, null, 2))}</pre>
  <h2>Source attributes</h2>
  <pre>${escapeHtml(JSON.stringify(report.sourceAttributes, null, 2))}</pre>
  <h2>Comparison table</h2>
  <table>${header}${body}</table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function collectPageErrors(page) {
  const errors = [];
  const onError = (err) => errors.push(String(err));
  const onPageError = (err) => errors.push(String(err?.message || err));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', onPageError);
  return {
    errors,
    detach: () => {
      page.off('pageerror', onPageError);
    },
  };
}

async function parseResultCards(popup) {
  return popup.evaluate(() => {
    const cards = [...document.querySelectorAll('#compare-results .result-card')];
    return cards.map((card) => {
      const site = card.querySelector('.result-site')?.textContent?.trim() || '';
      const title = card.querySelector('.result-title')?.textContent?.trim() || '';
      const scoreText = card.querySelector('.match-badge')?.textContent?.trim() || '';
      const scoreMatch = scoreText.match(/(\d+)/);
      const score = scoreMatch ? Number(scoreMatch[1]) : null;
      const img = card.querySelector('.result-thumb img');
      const link = card.querySelector('.result-view');
      return {
        site,
        title,
        score,
        hasImage: !!(img?.src),
        hasLink: !!(link?.href),
        linkHref: link?.href || '',
      };
    });
  });
}

async function waitForCompareComplete(popup, timeoutMs = 120_000) {
  const started = Date.now();
  let sawLoading = false;

  while (Date.now() - started < timeoutMs) {
    const state = await popup.evaluate(() => {
      const skeleton = document.querySelector('#compare-skeleton');
      const status = document.querySelector('#compare-status');
      const cards = document.querySelectorAll('#compare-results .result-card').length;
      const empty = document.querySelector('#compare-empty');
      const title = document.querySelector('#compare-title')?.textContent || '';
      const statusText = status?.textContent || '';
      const isLoading = status?.classList.contains('is-loading')
        || /searching/i.test(statusText)
        || (skeleton && !skeleton.hidden);
      return {
        isLoading,
        cards,
        emptyVisible: empty && !empty.hidden,
        title,
        noProduct: /open a product page/i.test(title),
      };
    });

    if (state.isLoading) sawLoading = true;

    if (!state.isLoading && (state.cards > 0 || state.emptyVisible || state.noProduct)) {
      return { ...state, sawLoading, elapsed: Date.now() - started };
    }

    await popup.waitForTimeout(1000);
  }

  throw new Error(`Compare did not complete within ${timeoutMs}ms`);
}

async function openComparePopup(extensionContext, popupUrl, productUrl) {
  const urlPattern = urlPatternFor(productUrl);

  const popup = await extensionContext.newPage();
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.locator('.onboarding .onboarding-skip, .onboarding button.primary').first().click().catch(() => {});

  await activateTab(extensionContext, urlPattern, productUrl);
  await popup.locator('#nav-compare').click();

  return { popup, urlPattern };
}

function verifyResultCards(cards) {
  const issues = [];
  if (!cards.length) issues.push('no result cards rendered');

  const scores = [];
  const urls = new Set();

  for (const card of cards) {
    if (!card.site) issues.push(`missing marketplace: ${card.title?.slice(0, 40)}`);
    if (!card.title) issues.push('missing title on result card');
    if (card.score == null || card.score < 0 || card.score > 100) {
      issues.push(`invalid score ${card.score} for ${card.title?.slice(0, 40)}`);
    } else scores.push(card.score);
    if (!card.hasImage) issues.push(`missing image: ${card.title?.slice(0, 40)}`);
    if (!card.hasLink) issues.push(`missing link: ${card.title?.slice(0, 40)}`);
    if (card.linkHref && urls.has(card.linkHref)) issues.push(`duplicate url: ${card.linkHref}`);
    if (card.linkHref) urls.add(card.linkHref);
  }

  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[i - 1]) {
      issues.push(`not sorted by score: ${scores[i]} > ${scores[i - 1]} at index ${i}`);
      break;
    }
  }

  return { issues, scores, count: cards.length };
}

module.exports = {
  EVIDENCE_ROOT,
  ensureEvidenceDir,
  writeEvidence,
  appendSummary,
  screenshot,
  urlPatternFor,
  activateTab,
  waitForProduct,
  runCompareWithDebug,
  printDebugReport,
  buildFailureTableHtml,
  collectPageErrors,
  parseResultCards,
  waitForCompareComplete,
  openComparePopup,
  verifyResultCards,
  sendRuntimeMessage,
};
