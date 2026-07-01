// Close marketplace tabs left open by prior tests in the same worker.
const { inServiceWorker } = require('./chrome-api.cjs');
const { MYNTRA_LISTING_URL } = require('./constants.cjs');

async function closeMarketplaceTabs(context) {
  return inServiceWorker(context, async () => {
    const tabs = await chrome.tabs.query({
      url: [
        'https://www.myntra.com/*',
        'https://www.flipkart.com/*',
        'https://www.meesho.com/*',
        'https://www.nykaa.com/*',
        'https://www.amazon.in/*',
      ],
    });
    await Promise.all(tabs.map((t) => chrome.tabs.remove(t.id)));
  });
}

async function activateMarketplaceTab(context, urlPart) {
  return inServiceWorker(context, async (needle) => {
    const tabs = await chrome.tabs.query({ url: ['https://www.myntra.com/*'] });
    const tab = tabs.find((t) => t.url.includes(needle)) || tabs[tabs.length - 1];
    if (tab?.id) await chrome.tabs.update(tab.id, { active: true });
    return tab?.url || null;
  }, urlPart);
}

module.exports = { closeMarketplaceTabs, activateMarketplaceTab, MYNTRA_LISTING_URL };
