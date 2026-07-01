// compare/score-config.js — tunable weights for price-compare candidate ranking.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_ScoreConfig = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const IMAGE_WEIGHT = 0.55;
  const TEXT_WEIGHT = 0.45;
  const DEDUP_THRESHOLD = 0.9;
  const CLIP_MODEL = 'Xenova/clip-vit-base-patch32';

  return {
    IMAGE_WEIGHT,
    TEXT_WEIGHT,
    DEDUP_THRESHOLD,
    CLIP_MODEL,
  };
}));
