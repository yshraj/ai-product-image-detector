// Shared constants for extension E2E tests.
const path = require('path');
const { SYNC_DEFAULTS, CACHE_PREFIX, HISTORY_KEY } = require(path.join(__dirname, '../../../utils/defaults.js'));

const EXT_DIR = path.resolve(__dirname, '../../..');
const ASSET_DIR = path.resolve(__dirname, '../../assets');
const MANIFEST = require(path.join(EXT_DIR, 'manifest.json'));

const DEFAULT_SYNC = { ...SYNC_DEFAULTS };

const MYNTRA_LISTING_URL = 'https://www.myntra.com/men-shirts';
const MYNTRA_PRODUCT_URL = 'https://www.myntra.com/shirts/test-brand/test-product/1234567/buy';

module.exports = {
  EXT_DIR,
  ASSET_DIR,
  MANIFEST,
  DEFAULT_SYNC,
  MYNTRA_LISTING_URL,
  MYNTRA_PRODUCT_URL,
  CACHE_PREFIX,
  HISTORY_KEY,
};
