// utils/defaults.js — single source of truth for extension settings and storage keys.
/**
 * @typedef {Object} SyncSettings
 * @property {boolean} enabled
 * @property {'all'|'badge'|'hide'} mode
 * @property {'heuristic'|'huggingface'} provider
 * @property {string} hfToken
 * @property {string} hfModel
 * @property {boolean} hfVerified
 * @property {string} hfUser
 * @property {number} minConfidence
 * @property {string[]} disabledSites
 * @property {string[]} compareSites
 * @property {string} serpApiKey
 * @property {boolean} notifyOnAI
 * @property {boolean} compareUseTabs
 * @property {boolean} compareUseClip
 * @property {boolean} compareDebugLog
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_Defaults = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const ALL_COMPARE_SITES = ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa'];

  /** @type {SyncSettings} */
  const SYNC_DEFAULTS = {
    enabled: true,
    mode: 'badge',
    provider: 'heuristic',
    hfToken: '',
    hfModel: 'haywoodsloan/ai-image-detector-deploy',
    hfVerified: false,
    hfUser: '',
    minConfidence: 70,
    disabledSites: [],
    compareSites: [...ALL_COMPARE_SITES],
    serpApiKey: '',
    notifyOnAI: false,
    compareUseTabs: false,
    compareUseClip: true,
    compareDebugLog: false,
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
  const CONTENT_SITES = ['myntra', 'flipkart', 'meesho', 'nykaa'];

  return {
    ALL_COMPARE_SITES,
    SYNC_DEFAULTS,
    CONTENT_PREF_DEFAULTS,
    CACHE_PREFIX,
    HISTORY_KEY,
    AI_THRESHOLD,
    CONTENT_SITES,
  };
}));
