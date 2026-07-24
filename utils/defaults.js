// utils/defaults.js — single source of truth for extension settings and storage keys.
/**
 * @typedef {Object} SyncSettings
 * @property {boolean} enabled
 * @property {'all'|'badge'|'hide'} mode
 * @property {'heuristic'|'huggingface'|'ondevice'} provider
 * @property {string} hfToken
 * @property {string} hfModel
 * @property {string} hfModel2 - optional 2nd model for the max-score ensemble
 * @property {boolean} hfEnsemble - run both models and take the higher AI score
 * @property {boolean} hfVerified
 * @property {string} hfUser
 * @property {number} minConfidence
 * @property {string[]} disabledSites
 * @property {boolean} notifyOnAI
 * @property {string} ondeviceModelUrl
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_Defaults = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  /** @type {SyncSettings} */
  const SYNC_DEFAULTS = {
    enabled: true,
    mode: 'badge',
    provider: 'heuristic',
    hfToken: '',
    hfModel: 'haywoodsloan/ai-image-detector-deploy',
    // Optional second model for a max-score ensemble. haywoodsloan and umm-maybe
    // both have 100% precision on our set but catch different AI images, so the
    // max lifts recall 50%→67% with zero extra false positives. Costs 2 API
    // calls/image, so it's opt-in (hfEnsemble).
    hfModel2: 'umm-maybe/AI-image-detector',
    hfEnsemble: true,
    hfVerified: false,
    hfUser: '',
    minConfidence: 70,
    disabledSites: [],
    notifyOnAI: false,
    // On-device (local ONNX) detector. URL of the hosted ONNX weights; empty
    // until the user (or a full build) configures it. See docs/ONDEVICE.md.
    ondeviceModelUrl: '',
  };

  const CONTENT_PREF_DEFAULTS = {
    mode: SYNC_DEFAULTS.mode,
    enabled: SYNC_DEFAULTS.enabled,
    minConfidence: SYNC_DEFAULTS.minConfidence,
    disabledSites: SYNC_DEFAULTS.disabledSites,
    notifyOnAI: SYNC_DEFAULTS.notifyOnAI,
  };

  const CACHE_PREFIX = 'rmf_cache_';
  const HISTORY_KEY = 'rmf_history';
  const AI_THRESHOLD = 90;
  const CONTENT_SITES = ['aliexpress', 'temu', 'shein', 'amazon', 'myntra', 'flipkart', 'meesho', 'nykaa'];

  // "Support the developer" target. Provider-agnostic on purpose: swapping to
  // GitHub Sponsors / Ko-fi / Stripe / Lemon Squeezy / Polar / Patreon or a
  // custom endpoint is a one-line change here — the popup reads `url` only.
  const SUPPORT = {
    provider: 'custom', // buymeacoffee | github | kofi | stripe | lemonsqueezy | polar | patreon | custom
    url: 'https://rzp.io/rzp/QPASy1V',
  };

  return {
    SYNC_DEFAULTS,
    CONTENT_PREF_DEFAULTS,
    CACHE_PREFIX,
    HISTORY_KEY,
    AI_THRESHOLD,
    CONTENT_SITES,
    SUPPORT,
  };
}));
