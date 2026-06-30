// Shared constants for extension E2E tests.
const path = require('path');

const EXT_DIR = path.resolve(__dirname, '../../..');
const ASSET_DIR = path.resolve(__dirname, '../../assets');
const MANIFEST = require(path.join(EXT_DIR, 'manifest.json'));

const DEFAULT_SYNC = {
  enabled: true,
  mode: 'badge',
  provider: 'heuristic',
  hfToken: '',
  hfModel: 'haywoodsloan/ai-image-detector-deploy',
  hfVerified: false,
  hfUser: '',
  minConfidence: 70,
  disabledSites: [],
  compareSites: ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa'],
  serpApiKey: '',
  notifyOnAI: false,
};

const MYNTRA_LISTING_URL = 'https://www.myntra.com/men-shirts';
const MYNTRA_PRODUCT_URL = 'https://www.myntra.com/shirts/test-brand/test-product/1234567/buy';

module.exports = {
  EXT_DIR,
  ASSET_DIR,
  MANIFEST,
  DEFAULT_SYNC,
  MYNTRA_LISTING_URL,
  MYNTRA_PRODUCT_URL,
  CACHE_PREFIX: 'rmf_cache_',
  HISTORY_KEY: 'rmf_history',
};
