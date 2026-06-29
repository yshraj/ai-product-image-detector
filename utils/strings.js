// utils/strings.js
// Single source of truth for user-facing text (easy to translate/edit later).
// UMD: attaches to the global (window in pages, self in the service worker) and
// also exports for Node unit tests.
(function (root) {
  const RMF_STRINGS = {
    // toolbar action badge
    badge: {
      color: '#e24b4a',
      // tooltips shown on the extension icon
      title: (ai, scanned) =>
        scanned > 0
          ? `ShopShield — ${ai} of ${scanned} image${scanned === 1 ? '' : 's'} look AI`
          : 'ShopShield',
      titleOff: 'ShopShield — detection paused',
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
      title: 'ShopShield',
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
