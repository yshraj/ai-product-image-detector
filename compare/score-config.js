// compare/score-config.js — tunable weights and penalties for attribute-based compare ranking.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_ScoreConfig = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const BRAND_WEIGHT = 0.25;
  const TITLE_WEIGHT = 0.20;
  const ATTRIBUTES_WEIGHT = 0.20;
  const COLOR_WEIGHT = 0.15;
  const PATTERN_WEIGHT = 0.10;
  const IMAGE_WEIGHT = 0.10;

  const COLOR_MISMATCH_PENALTY = 0.20;
  const PATTERN_MISMATCH_PENALTY = 0.15;
  const FIT_MISMATCH_PENALTY = 0.10;
  const CATEGORY_MISMATCH_PENALTY = 0.30;
  const GENDER_MISMATCH_PENALTY = 0.25;
  const BRAND_MISMATCH_CAP = 0.38;

  const DEDUP_THRESHOLD = 0.9;
  const CLIP_MODEL = 'Xenova/clip-vit-base-patch32';
  const TOP_RANKED = 10;
  const MIN_FINAL_SCORE = 0.32;
  const MIN_FALLBACK_SCORE = 0.22;
  /** Max ranked results kept per marketplace site. */
  const MAX_PER_SITE = 2;

  const MAX_CANDIDATES_PER_SITE = 25;
  /** Run CLIP only on the top text-scored candidates after pre-ranking. */
  const CLIP_TEXT_PREFILTER = 15;

  /** @deprecated use component weights above */
  const IMAGE_WEIGHT_LEGACY = IMAGE_WEIGHT;
  /** @deprecated use component weights above */
  const TEXT_WEIGHT_LEGACY = TITLE_WEIGHT;

  return {
    BRAND_WEIGHT,
    TITLE_WEIGHT,
    ATTRIBUTES_WEIGHT,
    COLOR_WEIGHT,
    PATTERN_WEIGHT,
    IMAGE_WEIGHT,
    COLOR_MISMATCH_PENALTY,
    PATTERN_MISMATCH_PENALTY,
    FIT_MISMATCH_PENALTY,
    CATEGORY_MISMATCH_PENALTY,
    GENDER_MISMATCH_PENALTY,
    BRAND_MISMATCH_CAP,
    DEDUP_THRESHOLD,
    MAX_PER_SITE,
    CLIP_MODEL,
    TOP_RANKED,
    MIN_FINAL_SCORE,
    MIN_FALLBACK_SCORE,
    MAX_CANDIDATES_PER_SITE,
    CLIP_TEXT_PREFILTER,
    IMAGE_WEIGHT_LEGACY,
    TEXT_WEIGHT_LEGACY,
  };
}));
