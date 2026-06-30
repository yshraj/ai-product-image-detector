// compare/tab-search.js — search marketplaces via background tabs (real browser context).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_TabSearch = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const TAB_LOAD_MS = 18_000;
  const TAB_SETTLE_MS = 800;
  const PARSER_FILE = 'compare/tab-parser.js';

  function waitForTabComplete(tabId, timeoutMs = TAB_LOAD_MS) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        fn();
      };

      const timer = setTimeout(() => finish(() => reject(new Error('page load timeout'))), timeoutMs);

      function onUpdated(id, info) {
        if (id === tabId && info.status === 'complete') {
          setTimeout(() => finish(resolve), TAB_SETTLE_MS);
        }
      }

      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.get(tabId).then((tab) => {
        if (tab.status === 'complete') setTimeout(() => finish(resolve), TAB_SETTLE_MS);
      }).catch((err) => finish(() => reject(err)));
    });
  }

  async function parseTabProducts(tabId, site) {
    await chrome.scripting.executeScript({ target: { tabId }, files: [PARSER_FILE] });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (s) => (typeof globalThis.RMF_parseSearchPage === 'function'
        ? globalThis.RMF_parseSearchPage(s)
        : []),
      args: [site],
    });
    return Array.isArray(result) ? result : [];
  }

  async function fetchSearchPageViaTab(url, site) {
    let tabId = null;
    try {
      const tab = await chrome.tabs.create({ url, active: false });
      tabId = tab.id;
      await waitForTabComplete(tabId);
      let items = await parseTabProducts(tabId, site);
      if (!items.length) {
        await new Promise((r) => setTimeout(r, 1500));
        items = await parseTabProducts(tabId, site);
      }
      return items;
    } finally {
      if (tabId != null) chrome.tabs.remove(tabId).catch(() => {});
    }
  }

  return { fetchSearchPageViaTab, waitForTabComplete, parseTabProducts, TAB_LOAD_MS };
}));
