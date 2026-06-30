// utils/strings.js
// Single source of truth for user-facing text (easy to translate/edit later).
// UMD: attaches to the global (window in pages, self in the service worker) and
// also exports for Node unit tests.
(function (root) {
  const RMF_STRINGS = {
    app: {
      name: 'ShopShield',
      shortName: 'ShopShield',
      tagline: 'Shop smarter. Spot AI. Compare better.',
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
      close: 'Close',
    },

    // bottom navigation
    nav: { scan: 'Scan', compare: 'Compare', tools: 'Tools', settings: 'Settings' },

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
      confidence: (n) => `Flagging at ${n}% confidence or higher`,
      whyFlagged: 'Tap any flagged badge on the page for Why flagged?',
      engine: 'AI scanner',
    },

    // compare tab
    compare: {
      heading: 'Compare this product',
      note: 'We search other marketplaces automatically and score how closely each result matches.',
      noProduct: 'Open a product page to compare it elsewhere.',
      on: (site) => `Search on ${site}`,
      findSimilar: 'Find similar products',
      searching: 'Searching marketplaces…',
      searchingSite: (site) => `Searching ${site}…`,
      sameProduct: 'Same product',
      similarProduct: 'Similar product',
      possibleMatch: 'Possible match',
      matchScore: (n) => `${n}% match`,
      noMatches: 'No close matches found — try the manual search links below.',
      searchFailed: 'Could not search some sites — try again or use manual links.',
      cached: 'Showing cached results',
      manualSearch: 'Search manually on each site',
      viewOn: (site) => `View on ${site}`,
      price: (p) => p || 'Price unavailable',
    },

    // tools tab
    tools: {
      reverse: 'Reverse image search',
      copyShare: 'Copy & share',
      copyTitle: 'Copy title',
      copyDetails: 'Copy product details',
      copyUrl: 'Copy product URL',
      copyImageUrl: 'Copy image URL',
      downloadImage: 'Download image',
      share: 'Share product',
      copied: 'Copied to clipboard',
      downloaded: 'Image downloading…',
      shared: 'Share sheet opened',
      noProduct: 'Open a product page to use these tools.',
      noImage: 'No product image found on this page.',
      lens: 'Google Lens',
      bing: 'Bing Visual Search',
    },

    settings: {
      aiDetection: 'AI detection',
      compareSites: 'Compare marketplaces',
      compareSitesHint: 'Choose which sites appear in Compare.',
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
  };

  root.RMF_STRINGS = RMF_STRINGS;
  if (typeof module !== 'undefined' && module.exports) module.exports = RMF_STRINGS;
})(typeof self !== 'undefined' ? self : this);
