// compare/similarity.js — text/image similarity, combined score, dedup (pure JS text path).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const scoreConfig = require('./score-config.js');
    module.exports = factory(scoreConfig);
  } else {
    root.RMF_CompareSimilarity = factory(root.RMF_ScoreConfig);
  }
}(typeof self !== 'undefined' ? self : this, function (scoreConfig) {
  const { IMAGE_WEIGHT, TEXT_WEIGHT, DEDUP_THRESHOLD } = scoreConfig;

  function tokenize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  /** Jaccard similarity on token sets — 0..1 */
  function jaccardSimilarity(a, b) {
    const sa = new Set(tokenize(a));
    const sb = new Set(tokenize(b));
    if (!sa.size && !sb.size) return 0;
    let inter = 0;
    for (const t of sa) if (sb.has(t)) inter++;
    const union = sa.size + sb.size - inter;
    return union ? inter / union : 0;
  }

  /** TF-IDF cosine similarity between two strings — 0..1 */
  function tfidfCosineSimilarity(a, b) {
    const docs = [tokenize(a), tokenize(b)];
    if (!docs[0].length && !docs[1].length) return 0;

    const df = new Map();
    for (const doc of docs) {
      for (const term of new Set(doc)) {
        df.set(term, (df.get(term) || 0) + 1);
      }
    }
    const n = docs.length;

    function tfidfVector(tokens) {
      const tf = new Map();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
      const vec = new Map();
      for (const [term, count] of tf) {
        const idf = Math.log((n + 1) / ((df.get(term) || 0) + 1)) + 1;
        vec.set(term, (count / tokens.length) * idf);
      }
      return vec;
    }

    const va = tfidfVector(docs[0]);
    const vb = tfidfVector(docs[1]);
    const terms = new Set([...va.keys(), ...vb.keys()]);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (const term of terms) {
      const x = va.get(term) || 0;
      const y = vb.get(term) || 0;
      dot += x * y;
      na += x * x;
      nb += y * y;
    }
    if (!na || !nb) return jaccardSimilarity(a, b);
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  function textSimilarity(query, title) {
    const tfidf = tfidfCosineSimilarity(query, title);
    const jaccard = jaccardSimilarity(query, title);
    return Math.max(0, Math.min(1, (tfidf * 0.65) + (jaccard * 0.35)));
  }

  function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (!na || !nb) return 0;
    const sim = dot / (Math.sqrt(na) * Math.sqrt(nb));
    return Math.max(0, Math.min(1, (sim + 1) / 2));
  }

  function combinedScore(imageScore, textScore) {
    const img = Math.max(0, Math.min(1, Number(imageScore) || 0));
    const txt = Math.max(0, Math.min(1, Number(textScore) || 0));
    return (IMAGE_WEIGHT * img) + (TEXT_WEIGHT * txt);
  }

  function candidatePairSimilarity(a, b) {
    const titleSim = textSimilarity(a.title || '', b.title || '');
    const imgA = a.imageEmbedding;
    const imgB = b.imageEmbedding;
    const imageSim = (Array.isArray(imgA) && Array.isArray(imgB))
      ? cosineSimilarity(imgA, imgB)
      : (a.image === b.image && a.image ? 1 : 0);
    return combinedScore(imageSim, titleSim);
  }

  /** Cluster near-duplicates (mutual similarity > threshold), keep highest finalScore. */
  function dedupCandidates(candidates, threshold = DEDUP_THRESHOLD) {
    const sorted = [...candidates].sort(
      (a, b) => (b.finalScore || 0) - (a.finalScore || 0),
    );
    const kept = [];
    for (const cand of sorted) {
      const dup = kept.some((k) => candidatePairSimilarity(k, cand) >= threshold);
      if (!dup) kept.push(cand);
    }
    return kept;
  }

  function rankCandidates(query, candidates, imageScoresByUrl = {}) {
    return candidates.map((c) => {
      const imageScore = imageScoresByUrl[c.url] ?? c.imageScore ?? 0;
      const textScore = textSimilarity(query, c.title || '');
      const finalScore = combinedScore(imageScore, textScore);
      return { ...c, imageScore, textScore, finalScore };
    });
  }

  return {
    tokenize,
    jaccardSimilarity,
    tfidfCosineSimilarity,
    textSimilarity,
    cosineSimilarity,
    combinedScore,
    candidatePairSimilarity,
    dedupCandidates,
    rankCandidates,
    IMAGE_WEIGHT,
    TEXT_WEIGHT,
    DEDUP_THRESHOLD,
  };
}));
