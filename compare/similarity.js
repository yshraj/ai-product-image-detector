// compare/similarity.js — attribute-based text/image similarity, penalties, dedup.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const scoreConfig = require('./score-config.js');
    const attrParser = require('./attribute-parser.js');
    const query = require('../utils/product-query.js');
    const fingerprint = require('../utils/product-fingerprint.js');
    module.exports = factory(scoreConfig, attrParser, query, fingerprint);
  } else {
    root.RMF_CompareSimilarity = factory(
      root.RMF_ScoreConfig,
      root.RMF_AttributeParser,
      root.RMF_ProductQuery,
      root.RMF_ProductFingerprint,
    );
  }
}(typeof self !== 'undefined' ? self : this, function (scoreConfig, AttributeParser, ProductQuery, ProductFingerprint) {
  const {
    BRAND_WEIGHT, TITLE_WEIGHT, ATTRIBUTES_WEIGHT, COLOR_WEIGHT, PATTERN_WEIGHT, IMAGE_WEIGHT,
    COLOR_MISMATCH_PENALTY, PATTERN_MISMATCH_PENALTY, FIT_MISMATCH_PENALTY,
    CATEGORY_MISMATCH_PENALTY, GENDER_MISMATCH_PENALTY, BRAND_MISMATCH_CAP, DEDUP_THRESHOLD,
  } = scoreConfig;

  const { extractProductId } = ProductFingerprint || { extractProductId: () => '' };

  const { parseAttributes, normalizeColor, colorsMatch, brandInText, brandTokens } = AttributeParser;
  const { tokenize } = ProductQuery;

  function tokenizeText(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  function jaccardSimilarity(a, b) {
    const sa = new Set(tokenizeText(a));
    const sb = new Set(tokenizeText(b));
    if (!sa.size && !sb.size) return 0;
    let inter = 0;
    for (const t of sa) if (sb.has(t)) inter++;
    const union = sa.size + sb.size - inter;
    return union ? inter / union : 0;
  }

  function tfidfCosineSimilarity(a, b) {
    const docs = [tokenizeText(a), tokenizeText(b)];
    if (!docs[0].length && !docs[1].length) return 0;

    const df = new Map();
    for (const doc of docs) {
      for (const term of new Set(doc)) df.set(term, (df.get(term) || 0) + 1);
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

  function normalizedTitleSimilarity(srcAttrs, candAttrs) {
    const a = srcAttrs.normalizedTitle || '';
    const b = candAttrs.normalizedTitle || '';
    if (!a && !b) return 0;
    const tfidf = tfidfCosineSimilarity(a, b);
    const jaccard = jaccardSimilarity(a, b);
    return Math.max(0, Math.min(1, (tfidf * 0.65) + (jaccard * 0.35)));
  }

  /** @deprecated kept for tests — use normalizedTitleSimilarity via attributes */
  function textSimilarity(query, title) {
    const tfidf = tfidfCosineSimilarity(query, title);
    const jaccard = jaccardSimilarity(query, title);
    return Math.max(0, Math.min(1, (tfidf * 0.65) + (jaccard * 0.35)));
  }

  function scoreBrandFeature(srcAttrs, candAttrs, candidateTitle) {
    const brand = srcAttrs.brand;
    if (!brand) return 0.25;
    const inTitle = brandInText(brand, candidateTitle || candAttrs.rawTitle || '');
    const candBrand = candAttrs.brand;
    if (candBrand && brandInText(brand, candBrand)) return 1;
    return inTitle ? 1 : 0;
  }

  function brandMismatch(srcAttrs, candAttrs, candidateTitle) {
    const brand = srcAttrs.brand;
    if (!brand || brandTokens(brand).length === 0) return false;
    return scoreBrandFeature(srcAttrs, candAttrs, candidateTitle) < 0.5;
  }

  function scoreColorFeature(srcAttrs, candAttrs) {
    const sc = srcAttrs.color;
    const cc = candAttrs.color;
    if (!sc && !cc) return 0.5;
    if (!sc && cc) return 0.25;
    if (sc && !cc) return 0.25;
    return colorsMatch(sc, cc) ? 1 : 0;
  }

  function colorMatchOk(srcAttrs, candAttrs) {
    const sc = srcAttrs.color;
    const cc = candAttrs.color;
    if (!sc || !cc) return null;
    return colorsMatch(sc, cc) === true;
  }

  function colorMismatch(srcAttrs, candAttrs) {
    const ok = colorMatchOk(srcAttrs, candAttrs);
    return ok === false;
  }

  function scorePatternFeature(srcAttrs, candAttrs) {
    const sp = srcAttrs.pattern;
    const cp = candAttrs.pattern;
    if (!sp && !cp) return 0.5;
    if (!sp && cp) return 0.25;
    if (sp && !cp) return 0.25;
    return sp === cp ? 1 : 0;
  }

  function patternMatchOk(srcAttrs, candAttrs) {
    const sp = srcAttrs.pattern;
    const cp = candAttrs.pattern;
    if (!sp || !cp) return null;
    return sp === cp;
  }

  function patternMismatch(srcAttrs, candAttrs) {
    const ok = patternMatchOk(srcAttrs, candAttrs);
    return ok === false;
  }

  function fitMatchOk(srcAttrs, candAttrs) {
    const sf = srcAttrs.fit;
    const cf = candAttrs.fit;
    if (!sf || !cf) return null;
    return sf === cf;
  }

  function fitMismatch(srcAttrs, candAttrs) {
    const ok = fitMatchOk(srcAttrs, candAttrs);
    return ok === false;
  }

  function categoryMatchOk(srcAttrs, candAttrs) {
    const sc = srcAttrs.category;
    const cc = candAttrs.category;
    if (!sc || !cc) return null;
    return sc === cc;
  }

  function categoryMismatch(srcAttrs, candAttrs) {
    const ok = categoryMatchOk(srcAttrs, candAttrs);
    return ok === false;
  }

  function genderMatchOk(srcAttrs, candAttrs) {
    const sg = srcAttrs.gender;
    const cg = candAttrs.gender;
    if (!sg || !cg) return null;
    if (sg === 'unisex' || cg === 'unisex') return true;
    return sg === cg;
  }

  function genderMismatch(srcAttrs, candAttrs) {
    const ok = genderMatchOk(srcAttrs, candAttrs);
    return ok === false;
  }

  const ATTR_FIELDS = ['gender', 'category', 'fit', 'sleeve', 'collar', 'fabric', 'size', 'model'];

  function scoreAttributeFields(srcAttrs, candAttrs) {
    const scores = [];
    for (const field of ATTR_FIELDS) {
      const sv = srcAttrs[field];
      const cv = candAttrs[field];
      if (!sv) continue;
      if (!cv) scores.push(field === 'category' ? 0.12 : 0.30);
      else scores.push(sv === cv ? 1 : 0);
    }
    if (!scores.length) return 0.5;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
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

  /**
   * Score a candidate against the source product using structured attributes.
   * @returns {{ finalScore: number, breakdown: object, penalties: object[], sourceAttrs: object, candidateAttrs: object }}
   */
  function scoreCandidateMatch(source, candidate, imageScore = 0) {
    const sourceAttrs = parseAttributes(source);
    const candidateAttrs = parseAttributes({
      title: candidate.title,
      brand: candidate.brand,
      color: candidate.color,
    });

    const imgRaw = Math.max(0, Math.min(1, Number(imageScore) || 0));
    let img = imgRaw;
    const brandScore = scoreBrandFeature(sourceAttrs, candidateAttrs, candidate.title);
    const titleScore = normalizedTitleSimilarity(sourceAttrs, candidateAttrs);
    const attributesScore = scoreAttributeFields(sourceAttrs, candidateAttrs);
    const colorScore = scoreColorFeature(sourceAttrs, candidateAttrs);
    const patternScore = scorePatternFeature(sourceAttrs, candidateAttrs);

    if (categoryMismatch(sourceAttrs, candidateAttrs) || genderMismatch(sourceAttrs, candidateAttrs)) {
      img = Math.min(img, 0.2);
    } else if (brandMismatch(sourceAttrs, candidateAttrs, candidate.title) && img > 0.55) {
      img *= 0.5;
    }

    let raw =
      (BRAND_WEIGHT * brandScore) +
      (TITLE_WEIGHT * titleScore) +
      (ATTRIBUTES_WEIGHT * attributesScore) +
      (COLOR_WEIGHT * colorScore) +
      (PATTERN_WEIGHT * patternScore) +
      (IMAGE_WEIGHT * img);

    const penalties = [];
    if (colorMismatch(sourceAttrs, candidateAttrs)) {
      raw -= COLOR_MISMATCH_PENALTY;
      penalties.push({ type: 'color', amount: COLOR_MISMATCH_PENALTY });
    }
    if (patternMismatch(sourceAttrs, candidateAttrs)) {
      raw -= PATTERN_MISMATCH_PENALTY;
      penalties.push({ type: 'pattern', amount: PATTERN_MISMATCH_PENALTY });
    }
    if (fitMismatch(sourceAttrs, candidateAttrs)) {
      raw -= FIT_MISMATCH_PENALTY;
      penalties.push({ type: 'fit', amount: FIT_MISMATCH_PENALTY });
    }
    if (categoryMismatch(sourceAttrs, candidateAttrs)) {
      raw -= CATEGORY_MISMATCH_PENALTY;
      penalties.push({ type: 'category', amount: CATEGORY_MISMATCH_PENALTY });
    }
    if (genderMismatch(sourceAttrs, candidateAttrs)) {
      raw -= GENDER_MISMATCH_PENALTY;
      penalties.push({ type: 'gender', amount: GENDER_MISMATCH_PENALTY });
    }

    let finalScore = Math.max(0, Math.min(1, raw));
    let brandCapApplied = false;
    if (brandMismatch(sourceAttrs, candidateAttrs, candidate.title)) {
      if (finalScore > BRAND_MISMATCH_CAP) {
        finalScore = BRAND_MISMATCH_CAP;
        brandCapApplied = true;
      }
    }

    const breakdown = {
      brand: { ok: brandScore >= 0.5, score: brandScore },
      title: { score: titleScore },
      attributes: { score: attributesScore },
      color: { ok: colorMatchOk(sourceAttrs, candidateAttrs), score: colorScore },
      pattern: { ok: patternMatchOk(sourceAttrs, candidateAttrs), score: patternScore },
      fit: { ok: fitMatchOk(sourceAttrs, candidateAttrs), value: candidateAttrs.fit || '' },
      category: { ok: categoryMatchOk(sourceAttrs, candidateAttrs), value: candidateAttrs.category || '' },
      gender: { ok: genderMatchOk(sourceAttrs, candidateAttrs), value: candidateAttrs.gender || '' },
      image: { score: img, raw: imgRaw },
      brandCapApplied,
      penalties,
    };

    return {
      finalScore,
      breakdown,
      penalties,
      sourceAttrs,
      candidateAttrs,
      brandScore,
      titleScore,
      attributesScore,
      colorScore,
      patternScore,
      imageScore: img,
    };
  }

  /** @deprecated */
  function combinedScore(imageScore, textScore) {
    const img = Math.max(0, Math.min(1, Number(imageScore) || 0));
    const txt = Math.max(0, Math.min(1, Number(textScore) || 0));
    return (IMAGE_WEIGHT * img) + (TITLE_WEIGHT * txt);
  }

  function candidatePairSimilarity(a, b) {
    const src = { title: a.title || '', brand: a.brand, color: a.color };
    const cand = { title: b.title || '', brand: b.brand, color: b.color };
    const scored = scoreCandidateMatch(src, cand, 0);
    const imgA = a.imageEmbedding;
    const imgB = b.imageEmbedding;
    if (Array.isArray(imgA) && Array.isArray(imgB)) {
      const imgSim = cosineSimilarity(imgA, imgB);
      return Math.max(scored.finalScore, (IMAGE_WEIGHT * imgSim) + scored.finalScore * (1 - IMAGE_WEIGHT));
    }
    if (a.image === b.image && a.image) return Math.max(scored.finalScore, 0.95);
    return scored.finalScore;
  }

  function candidateDedupKey(c) {
    const site = c.site || '';
    const pid = extractProductId(c.url || '', site);
    if (pid && String(pid).length > 2) return `${site}:${pid}`;
    if (c.image) return `${site}:img:${c.image.split('?')[0]}`;
    return c.url || c.title || '';
  }

  function dedupCandidates(candidates, threshold = DEDUP_THRESHOLD) {
    const sorted = [...candidates].sort(
      (a, b) => (b.finalScore || 0) - (a.finalScore || 0),
    );
    const kept = [];
    const seenKeys = new Set();
    for (const cand of sorted) {
      const key = candidateDedupKey(cand);
      if (key && seenKeys.has(key)) continue;
      const dup = kept.some((k) => candidatePairSimilarity(k, cand) >= threshold);
      if (!dup) {
        kept.push(cand);
        if (key) seenKeys.add(key);
      }
    }
    return kept;
  }

  /**
   * Hard reject obvious mismatches before ranking output.
   */
  function isCompatibleCandidate(source, candidate, scored) {
    const srcAttrs = scored?.sourceAttrs || parseAttributes(source);
    const candAttrs = scored?.candidateAttrs || parseAttributes({
      title: candidate.title,
      brand: candidate.brand,
      color: candidate.color,
    });
    if (genderMismatch(srcAttrs, candAttrs)) return false;
    if (categoryMismatch(srcAttrs, candAttrs)) return false;
    return true;
  }

  function rankCandidates(source, candidates, imageScoresByUrl = {}) {
    return candidates.map((c) => {
      const imageScore = imageScoresByUrl[c.url] ?? c.imageScore ?? 0;
      const scored = scoreCandidateMatch(source, c, imageScore);
      return {
        ...c,
        imageScore: scored.imageScore,
        textScore: scored.titleScore,
        finalScore: scored.finalScore,
        breakdown: scored.breakdown,
        sourceAttrs: scored.sourceAttrs,
        candidateAttrs: scored.candidateAttrs,
      };
    });
  }

  function scoreLabel(finalScore) {
    const pct = Math.round((finalScore || 0) * 100);
    let label = 'possible';
    if (pct >= 90) label = 'same';
    else if (pct >= 70) label = 'similar';
    return { score: pct, label };
  }

  return {
    tokenize: tokenizeText,
    jaccardSimilarity,
    tfidfCosineSimilarity,
    textSimilarity,
    normalizedTitleSimilarity,
    cosineSimilarity,
    combinedScore,
    scoreCandidateMatch,
    scoreBrandFeature,
    scoreColorFeature,
    scorePatternFeature,
    scoreAttributeFields,
    brandMismatch,
    colorMismatch,
    patternMismatch,
    fitMismatch,
    categoryMismatch,
    genderMismatch,
    isCompatibleCandidate,
    candidateDedupKey,
    candidatePairSimilarity,
    dedupCandidates,
    rankCandidates,
    scoreLabel,
    parseAttributes,
    normalizeColor,
    BRAND_WEIGHT,
    TITLE_WEIGHT,
    ATTRIBUTES_WEIGHT,
    COLOR_WEIGHT,
    PATTERN_WEIGHT,
    IMAGE_WEIGHT,
    DEDUP_THRESHOLD,
  };
}));
