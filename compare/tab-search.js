// compare/tab-search.js — search marketplaces via hidden background tabs (no CORS).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const config = require('./config.js');
    module.exports = factory(config);
  } else {
    root.RMF_TabSearch = factory(root.RMF_CompareConfig);
  }
}(typeof self !== 'undefined' ? self : this, function (config) {
  const { MARKETPLACES, SCRAPE_TIMEOUT_MS } = config;
  const TAB_SETTLE_MS = 400;
  const PARSER_FILE = 'compare/tab-parser.js';

  function waitForTabComplete(tabId, timeoutMs) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        fn();
      };

      const timer = setTimeout(
        () => finish(() => reject(new Error('page load timeout'))),
        timeoutMs,
      );

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

  async function scrapeTabProducts(tabId, site, scrapeConfig) {
    await chrome.scripting.executeScript({ target: { tabId }, files: [PARSER_FILE] });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (s, cfg) => {
        if (typeof globalThis.RMF_waitAndParseSearchPage === 'function') {
          return await globalThis.RMF_waitAndParseSearchPage(s, cfg);
        }
        return typeof globalThis.RMF_parseSearchPage === 'function'
          ? globalThis.RMF_parseSearchPage(s)
          : [];
      },
      args: [site, scrapeConfig || {}],
    });
    return Array.isArray(result) ? result : [];
  }

  /**
   * Open a hidden tab, wait for SPA search results, scrape candidates, close tab.
   * @param {string} platform — marketplace key (amazon, flipkart, …)
   * @param {string} query — cleaned search query
   * @returns {Promise<{ platform: string, items: object[], ok: boolean, error?: string }>}
   */
  async function openHiddenSearchTab(platform, query, options = {}) {
    const mp = MARKETPLACES[platform];
    if (!mp) {
      return { platform, items: [], ok: false, error: `unknown platform: ${platform}` };
    }

    const url = mp.searchUrl(query);
    const scrapeConfig = mp.scrape || {};
    const timeoutMs = options.timeoutMs || SCRAPE_TIMEOUT_MS;
    let tabId = null;

    try {
      const tab = await chrome.tabs.create({ url, active: false });
      tabId = tab.id;
      await waitForTabComplete(tabId, timeoutMs);
      const items = await scrapeTabProducts(tabId, platform, scrapeConfig);
      return { platform, items, ok: true, query, url };
    } catch (err) {
      return {
        platform,
        items: [],
        ok: false,
        query,
        url,
        error: String(err?.message || err),
      };
    } finally {
      if (tabId != null) chrome.tabs.remove(tabId).catch(() => {});
    }
  }

  /** @deprecated Use openHiddenSearchTab(platform, query) */
  async function fetchSearchPageViaTab(url, site) {
    const query = decodeURIComponent((url.match(/[?&](?:q|k)=([^&]+)/) || [])[1] || '');
    const result = await openHiddenSearchTab(site, query);
    return result.items;
  }

  return {
    openHiddenSearchTab,
    fetchSearchPageViaTab,
    waitForTabComplete,
    scrapeTabProducts,
    SCRAPE_TIMEOUT_MS,
    TAB_SETTLE_MS,
  };
}));
