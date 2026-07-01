// research/accuracy-test/metrics.cjs
// Shared scoring: given per-image AI scores (0-100) + ground-truth labels,
// print a confusion matrix, per-image table, and a threshold sweep.
// Positive class = "AI-generated".

const fs = require('fs');
const path = require('path');

function loadLabels(dir = __dirname) {
  const l = JSON.parse(fs.readFileSync(path.join(dir, 'labels.json'), 'utf8'));
  const truth = {};
  l.ai.forEach((id) => (truth[id] = 'ai'));
  l.real.forEach((id) => (truth[id] = 'real'));
  return { truth, unsure: new Set(l.unsure || []) };
}

// scoreMap: { "01": 87, "02": 12, ... }
function at(scoreMap, truth, T) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const [id, t] of Object.entries(truth)) {
    if (!(id in scoreMap)) continue;
    const predAI = scoreMap[id] >= T;
    if (t === 'ai' && predAI) tp++;
    else if (t === 'ai' && !predAI) fn++;
    else if (t === 'real' && predAI) fp++;
    else tn++;
  }
  const n = tp + fp + fn + tn;
  const acc = n ? (tp + tn) / n : 0;
  const prec = tp + fp ? tp / (tp + fp) : 0;
  const rec = tp + fn ? tp / (tp + fn) : 0;
  const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
  return { T, tp, fp, fn, tn, acc, prec, rec, f1 };
}

const pct = (x) => `${(x * 100).toFixed(0)}%`;

function printReport(name, scoreMap, defaultT, dir = __dirname) {
  const { truth, unsure } = loadLabels(dir);
  console.log(`\n${'='.repeat(58)}\n  ${name}\n${'='.repeat(58)}`);

  // Per-image table
  console.log('\n  id   truth   score   pred@' + defaultT + '   result');
  console.log('  ' + '-'.repeat(44));
  const ids = Object.keys(scoreMap).sort();
  for (const id of ids) {
    const t = unsure.has(id) ? 'unsure' : truth[id] || '?';
    const s = scoreMap[id];
    const pred = s >= defaultT ? 'AI' : 'real';
    let res = '';
    if (t === 'ai' || t === 'real') res = pred === t ? 'ok' : '  ✗ WRONG';
    console.log(
      `  ${id}   ${t.padEnd(6)}  ${String(s).padStart(3)}     ${pred.padEnd(5)}     ${res}`,
    );
  }

  // Confusion matrix at default + best-F1 threshold
  const sweep = [];
  for (let T = 40; T <= 95; T += 5) sweep.push(at(scoreMap, truth, T));
  const best = sweep.reduce((a, b) => (b.f1 > a.f1 ? b : a));
  const def = at(scoreMap, truth, defaultT);

  const show = (m, tag) => {
    console.log(`\n  ${tag} (threshold ${m.T}):`);
    console.log(`    TP ${m.tp}  FP ${m.fp}  FN ${m.fn}  TN ${m.tn}`);
    console.log(
      `    accuracy ${pct(m.acc)}   precision ${pct(m.prec)}   recall ${pct(m.rec)}   F1 ${m.f1.toFixed(2)}`,
    );
  };
  show(def, 'At extension default');
  show(best, 'Best achievable');

  console.log('\n  Threshold sweep (F1):');
  console.log('    ' + sweep.map((m) => `${m.T}:${m.f1.toFixed(2)}`).join('  '));
  return { def, best };
}

module.exports = { loadLabels, at, printReport };
