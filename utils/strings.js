// utils/strings.js
// Single source of truth for user-facing text (easy to translate/edit later).
// UMD: attaches to the global (window in pages, self in the service worker) and
// also exports for Node unit tests.
(function (root) {
  const RMF_STRINGS = {
    app: {
      name: 'TrueKart',
      shortName: 'TrueKart',
      tagline: 'Real photos. Shop smarter in India.',
    },

    // toolbar action badge
    badge: {
      color: '#e24b4a',
      // tooltips shown on the extension icon
      title: (ai, scanned) => {
        const app = RMF_STRINGS.app.shortName;
        return scanned > 0
          ? `${app} — ${ai} of ${scanned} image${scanned === 1 ? '' : 's'} look AI`
          : app;
      },
      titleOff: () => `${RMF_STRINGS.app.shortName} — scanning paused`,
    },

    // popup page-scan summary
    summary: {
      none: 'No images scanned yet — open a category page.',
      paused: 'Detection is paused.',
      result: (ai, scanned) =>
        `${ai} of ${scanned} look AI` + (scanned ? ` (${Math.round((ai / scanned) * 100)}%)` : ''),
      rescan: 'Rescan page',
      rescanning: 'Rescanning…',
      rescanDone: 'Rescanning this page…',
    },

    // opt-in notifications
    notify: {
      title: () => RMF_STRINGS.app.shortName,
      body: (ai) => `${ai} AI-looking image${ai === 1 ? '' : 's'} on this page.`,
    },

    // badge popover actions (reverse image search + marketplace search handoff)
    actions: {
      findIdentical: 'Find identical',
      lens: 'Google Lens',
      bing: 'Bing',
      searchElsewhere: 'Search elsewhere',
      amazon: 'Amazon',
      flipkart: 'Flipkart',
      google: 'Google',
    },

    // "why flagged?" badge details
    details: {
      heading: 'Why flagged?',
      engineHuggingFace: 'Hugging Face',
      enginePreview: 'On-device preview',
      previewNote: 'Preview heuristic — low accuracy. Connect Hugging Face for a real verdict.',
      modelNote: (model) => `Model: ${model}`,
      confidence: (c) => `${c}% confidence it is AI-generated`,
      layerExif: (c) => `EXIF check: ${c}% real`,
      layerTfjs: (c) => `On-device model: ${c}% AI`,
      layerHf: (c) => `Hugging Face: ${c}% AI`,
      layerNone: 'Not run',
      close: 'Close',
      markWrong: 'Not AI? Mark wrong',
    },

    // bottom navigation
    nav: { scan: 'Scan', compare: 'Similar products', settings: 'Settings' },

    // scan breakdown
    scan: {
      complete: 'Scan complete',
      scanned: (n) => `${n} product${n === 1 ? '' : 's'} scanned`,
      aiGenerated: 'AI generated',
      likelyAI: 'Likely AI',
      normal: 'Normal',
      none: 'No products scanned yet — open a category page and scroll.',
      paused: 'Scanning is paused — turn it on to analyze images.',
      unsupported: 'Open a product or category page on Myntra, Flipkart, Meesho or Nykaa.',
      noActiveTab: 'No active tab — switch to a supported marketplace page.',
      starting: 'Scanner starting… If this persists, reload the page.',
      amazonLimited: 'Amazon has limited support — use Myntra, Flipkart, Meesho or Nykaa for full tools.',
      confidence: (n) => `Flagging at ${n}% confidence or higher`,
      whyFlagged: 'Tap any flagged badge on the page for Why flagged?',
      engine: 'AI scanner',
      scanning: (done, total) => `Scanning ${done} / ${total}…`,
      filterHint: 'Click a category to highlight matching products on the page.',
      history: 'Recent scans',
      historyEmpty: 'Scan a category page to see history here.',
      confidenceLabel: 'Flag threshold',
      scanAll: 'Scan whole page',
      scanAllCount: (n) => `Scan whole page · ${n} more`,
      scanningAll: 'Scanning page…',
    },

    // compare tab
    compare: {
      heading: 'Similar products',
      note: 'We search other marketplaces automatically and score how closely each result matches.',
      noProduct: 'Open a product page to find similar items elsewhere.',
      on: (site) => `Search on ${site}`,
      findSimilar: 'Find similar products',
      searching: 'Searching marketplaces…',
      searchingSite: (site) => `Searching ${site}…`,
      sameProduct: 'Same product',
      similarProduct: 'Similar product',
      possibleMatch: 'Possible match',
      matchScore: (n) => `${n}% match`,
      breakdownBrand: 'Brand',
      breakdownColor: 'Color',
      breakdownPattern: 'Pattern',
      breakdownFit: 'Fit',
      breakdownCategory: 'Category',
      breakdownImage: 'Image',
      breakdownFinal: 'Final',
      breakdownOk: '✔',
      breakdownMiss: '✖',
      breakdownUnknown: '—',
      noMatches: 'No close matches found — try the manual search links below.',
      weakMatches: 'Found products on other sites but none matched closely enough — try manual search or refresh.',
      searchFailed: 'Search failed — use the manual links below or reload the extension.',
      sitesFailed: (sites) => `Could not reach ${sites}`,
      partialResults: (sites) => `Some sites unavailable (${sites})`,
      cached: 'Showing cached results',
      manualSearch: 'Search manually on each site',
      viewOn: (site) => `View on ${site}`,
      emptyHint: 'Open a product page on Flipkart, Myntra, Meesho or Nykaa, then search for the same item elsewhere.',
      listingPage: 'This looks like a category page — open a specific product to find similar items.',
      noSitesSelected: 'Select at least one marketplace to search.',
      serpFallback: 'SerpApi unavailable — searched marketplaces directly.',
      searchTimeout: 'Search timed out — try fewer sites or use the manual links below.',
      filterSites: 'Sites to search',
      sortBy: 'Sort results',
      cachedCount: (n) => `${n} cached comparison${n === 1 ? '' : 's'}`,
      refresh: 'Refresh',
      staleResults: 'Product changed — rescanning…',
    },

    // "support the developer" footer (persistent, bottom of popup)
    support: {
      title: 'Buy me a coffee',
      subtitle: 'Support independent development',
      aria: 'Buy me a coffee — support independent development (opens in a new tab)',
    },

    settings: {
      aiDetection: 'AI detection',
      compareSites: 'Similar products marketplaces',
      compareSitesHint: 'Choose which sites appear in Similar products.',
      more: 'More',
    },

    // page export
    exportUI: {
      label: 'Export page',
      json: 'JSON',
      csv: 'CSV',
      empty: 'Nothing to export yet — scroll to scan products.',
      done: (n) => `Exported ${n} product${n === 1 ? '' : 's'}`,
    },

    // activity history (options page)
    history: {
      empty: 'Nothing flagged yet. Flagged items will appear here.',
      clear: 'Clear history',
      cleared: 'History cleared',
      heading: 'Recent detections',
    },

    options: {
      saveFailed: 'Could not save settings — try again.',
      readFileFailed: 'Could not read that file.',
      importInvalid: 'That file isn’t a valid settings export',
    },
  };

  root.RMF_STRINGS = RMF_STRINGS;
  if (typeof module !== 'undefined' && module.exports) module.exports = RMF_STRINGS;
})(typeof self !== 'undefined' ? self : this);
