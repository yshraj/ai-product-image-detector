#!/usr/bin/env node
// Build Tier A/B markdown tables from compare-real-products test evidence.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(process.cwd(), 'test-results', 'compare-real-products');
const tierA = path.join(ROOT, 'tier-a-summary.json');
const tierB = path.join(ROOT, 'tier-b-summary.json');

function loadJson(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function tierATable(rows) {
  const brands = [...new Set(rows.map((r) => r.brand))];
  const lines = [
    '### Tier A — Scraper mechanics',
    '| Brand | Amazon | Myntra | Flipkart |',
    '|---|---|---|---|',
  ];
  for (const brand of brands) {
    const cells = ['amazon', 'myntra', 'flipkart'].map((plat) => {
      const r = rows.find((x) => x.brand === brand && x.platform === plat);
      if (!r) return '—';
      if (r.candidates > 0) return `✅ ${r.candidates} candidates`;
      return `❌ ${r.status || 'empty'}`;
    });
    lines.push(`| ${brand} | ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

function tierBTable(rows) {
  const lines = [
    '### Tier B — Live end-to-end',
    '| Brand | Source product | Top match found | Score | Notes |',
    '|---|---|---|---|---|',
  ];
  for (const r of rows) {
    lines.push(`| ${r.brand} | ${(r.sourceTitle || '').slice(0, 50)} | ${r.topMatch || '—'} | ${r.topScore ?? '—'} | failed: ${(r.failedSites || []).join(', ') || 'none'} |`);
  }
  return lines.join('\n');
}

const a = loadJson(tierA);
const b = loadJson(tierB);

if (!a.length && !b.length) {
  console.error('No evidence found. Run: npm run test:compare-real');
  process.exit(1);
}

console.log(tierATable(a));
console.log('');
console.log(tierBTable(b));
