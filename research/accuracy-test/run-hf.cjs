// research/accuracy-test/run-hf.cjs
// Runs the Hugging Face model against ./images and prints accuracy vs labels.
// Mirrors background/service-worker.js exactly: raw-bytes POST to the
// hf-inference router, same label parsing. Your token never leaves your shell.
//
//   HF_TOKEN=hf_xxx node research/accuracy-test/run-hf.cjs
//   HF_TOKEN=hf_xxx HF_MODEL=haywoodsloan/ai-image-detector-deploy node research/accuracy-test/run-hf.cjs

const fs = require('fs');
const path = require('path');
const { printReport } = require('./metrics.cjs');

const TOKEN = process.env.HF_TOKEN;
const MODEL = process.env.HF_MODEL || 'haywoodsloan/ai-image-detector-deploy';
const BASE = 'https://router.huggingface.co/hf-inference/models/';
const SET = process.argv[2] || '.'; // e.g. "set2"
const DIR = path.join(__dirname, SET);
const IMG = path.join(DIR, 'images');

if (!TOKEN) {
  console.error('Set HF_TOKEN=hf_... (a free Read token). Aborting.');
  process.exit(1);
}

const AI = /(^|[^a-z])(ai|artificial|fake|deepfake|gan|generated|synthetic|midjourney|stable|dalle)/i;
const REAL = /(real|human|authentic|photo|nature|genuine)/i;

function parseHf(data) {
  const arr = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : data;
  if (!Array.isArray(arr)) throw new Error('unexpected response ' + JSON.stringify(data).slice(0, 120));
  let aiScore = null;
  for (const it of arr) if (AI.test(String(it.label || '').toLowerCase())) aiScore = Math.max(aiScore ?? 0, it.score);
  if (aiScore === null) for (const it of arr) if (REAL.test(String(it.label || '').toLowerCase())) aiScore = 1 - it.score;
  if (aiScore === null) throw new Error('no AI/real labels: ' + JSON.stringify(arr).slice(0, 120));
  return Math.round(aiScore * 100);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function detect(file) {
  const bytes = fs.readFileSync(path.join(IMG, file));
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(BASE + MODEL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json', 'Content-Type': 'image/jpeg' },
      body: bytes,
    });
    if (res.status === 503) { const j = await res.json().catch(() => ({})); await wait(Math.min((j.estimated_time || 6) * 1000, 12000)); continue; }
    if (res.status === 429) { await wait(3000); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 100)}`);
    return parseHf(await res.json());
  }
  throw new Error('model still warming up after retries');
}

(async () => {
  const files = fs.readdirSync(IMG).filter((f) => /^\d+\.jpg$/.test(f)).sort();
  const scoreMap = {};
  for (const f of files) {
    const id = f.replace('.jpg', '');
    try {
      scoreMap[id] = await detect(f);
      process.stdout.write(`  ${id}:${scoreMap[id]}  `);
    } catch (e) {
      console.log(`\n  ${id} FAILED: ${e.message}`);
    }
    await wait(400); // be gentle on the free tier
  }
  console.log('');
  fs.writeFileSync(path.join(DIR, 'hf-scores.json'), JSON.stringify(scoreMap, null, 2));
  // Extension flags HF AI at confidence >= 50, badges at the user's floor (70).
  printReport(`HUGGING FACE — ${MODEL} — ${SET}`, scoreMap, 50, DIR);
})();
