// Tier A/B brand definitions for live compare scraper tests.
// Tier A URLs are category/search pages — NOT the same SKU across platforms.

const TIER_A_BRANDS = [
  {
    id: 'allen-solly-shirts',
    name: 'Allen Solly (shirts)',
    amazon: { type: 'search', query: 'allen solly shirt' },
    myntra: { type: 'url', url: 'https://www.myntra.com/allen-solly-shirts' },
    flipkart: {
      type: 'url',
      url: 'https://www.flipkart.com/mens-shirts/allen-solly~brand/pr?sid=clo%2Cash%2Caxc%2Cmmk',
    },
  },
  {
    id: 'allen-solly-checked',
    name: 'Allen Solly (checked shirts)',
    amazon: { type: 'search', query: 'allen solly checked shirt' },
    myntra: { type: 'url', url: 'https://www.myntra.com/allen-solly-checked-shirts' },
    flipkart: { type: 'search', query: 'allen solly checked shirt' },
  },
  {
    id: 'van-heusen',
    name: 'Van Heusen (shirts)',
    amazon: { type: 'search', query: 'van heusen shirt men' },
    myntra: { type: 'url', url: 'https://www.myntra.com/van-heusen-shirts' },
    flipkart: { type: 'search', query: 'van heusen shirt' },
  },
  {
    id: 'us-polo',
    name: 'US Polo Assn (shirts)',
    amazon: { type: 'search', query: 'us polo assn shirt men' },
    myntra: { type: 'url', url: 'https://www.myntra.com/us-polo-assn-shirts' },
    flipkart: { type: 'search', query: 'us polo assn shirt' },
  },
  {
    id: 'peter-england',
    name: 'Peter England (shirts)',
    amazon: { type: 'search', query: 'peter england shirt men' },
    myntra: { type: 'url', url: 'https://www.myntra.com/peter-england-shirts' },
    flipkart: { type: 'search', query: 'peter england shirt' },
  },
  {
    id: 'levis',
    name: "Levi's (denim shirt)",
    amazon: { type: 'search', query: 'levis denim shirt men' },
    myntra: { type: 'url', url: 'https://www.myntra.com/levis-shirts' },
    flipkart: { type: 'search', query: 'levis shirt' },
  },
  {
    id: 'arrow',
    name: 'Arrow (formal shirts)',
    amazon: { type: 'search', query: 'arrow formal shirt men' },
    myntra: { type: 'url', url: 'https://www.myntra.com/arrow-shirts' },
    flipkart: { type: 'search', query: 'arrow shirt' },
  },
  {
    id: 'louis-philippe',
    name: 'Louis Philippe (shirts)',
    amazon: { type: 'search', query: 'louis philippe shirt men' },
    myntra: { type: 'url', url: 'https://www.myntra.com/louis-philippe-shirts' },
    flipkart: { type: 'search', query: 'louis philippe shirt' },
  },
  {
    id: 'hm',
    name: "H&M (men's shirts)",
    amazon: { type: 'search', query: 'hm men shirt' },
    myntra: { type: 'url', url: 'https://www.myntra.com/hm-shirts' },
    flipkart: { type: 'search', query: 'hm shirt' },
  },
  {
    id: 'roadster',
    name: 'Roadster (Myntra house brand)',
    amazon: { type: 'search', query: 'roadster shirt men' },
    myntra: { type: 'url', url: 'https://www.myntra.com/roadster-shirts' },
    flipkart: { type: 'search', query: 'roadster shirt' },
  },
];

const TIER_B_BRANDS = [
  { id: 'allen-solly-shirts', name: 'Allen Solly', amazonQuery: 'allen solly shirt' },
  { id: 'van-heusen', name: 'Van Heusen', amazonQuery: 'van heusen shirt men' },
  { id: 'roadster', name: 'Roadster', amazonQuery: 'roadster shirt men' },
];

const PLATFORMS = ['amazon', 'myntra', 'flipkart'];

module.exports = { TIER_A_BRANDS, TIER_B_BRANDS, PLATFORMS };
