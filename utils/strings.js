// utils/strings.js
// Single source of truth for user-facing text (easy to translate/edit later).
// UMD: attaches to the global (window in pages, self in the service worker) and
// also exports for Node unit tests.
(function (root) {
  const RMF_STRINGS = {
    app: {
      name: 'TrueKart',
      shortName: 'TrueKart',
      tagline: 'Spot AI & fake product photos before you buy.',
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
      copyLink: 'Copy link',
      copied: 'Copied!',
      copyFailed: 'Copy failed',
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
      previewNote: 'On-device estimate — connect Hugging Face in Settings for a more confident verdict.',
      modelNote: (model) => `Model: ${model}`,
      confidence: (c) => `${c}% confidence it is AI-generated`,
      layerExif: (c) => `EXIF check: ${c}% real`,
      layerTfjs: (c) => `On-device model: ${c}% AI`,
      layerHf: (c) => `Hugging Face: ${c}% AI`,
      layerNone: 'Not run',
      close: 'Close',
      markWrong: 'Not AI? Mark wrong',
    },

    // engine status card (popup)
    status: {
      retry: 'Retry',
      retrying: 'Retrying…',
      retryAria: 'Retry the last failed scan',
    },

    // bottom navigation
    nav: { scan: 'Scan', settings: 'Settings' },

    // scan breakdown
    scan: {
      complete: 'Scan complete',
      scanned: (n) => `${n} product${n === 1 ? '' : 's'} scanned`,
      aiGenerated: 'AI generated',
      likelyAI: 'Likely AI',
      normal: 'Normal',
      none: 'No products scanned yet — open a category page and scroll.',
      paused: 'Scanning is paused — turn it on to analyze images.',
      unsupported: 'Open a product or category page on AliExpress, Temu, Shein, Amazon, Myntra, Flipkart, Meesho or Nykaa.',
      noActiveTab: 'No active tab — switch to a supported marketplace page.',
      starting: 'Scanner starting… If this persists, reload the page.',
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

    // "support the developer" footer (persistent, bottom of popup)
    support: {
      title: '❤️ Support us',
      subtitle: 'Help keep TrueKart free and open',
      aria: 'Support us — opens our Razorpay payment page in a new tab',
    },

    settings: {
      aiDetection: 'AI detection',
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
