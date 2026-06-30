// Helpers that run Chrome extension APIs inside the service worker context.
const { waitForServiceWorker } = require('./extension-launcher.cjs');

async function getExtensionId(context) {
  const sw = await waitForServiceWorker(context);
  return new URL(sw.url()).host;
}

function extensionUrl(extensionId, pagePath) {
  return `chrome-extension://${extensionId}/${pagePath.replace(/^\//, '')}`;
}

/** Run `fn` inside the extension service worker. Pass a single serialisable `arg` if needed. */
async function inServiceWorker(context, fn, arg) {
  const sw = await waitForServiceWorker(context);
  return arg === undefined ? sw.evaluate(fn) : sw.evaluate(fn, arg);
}

async function sendTabMessage(context, urlPattern, message, exactUrl) {
  return inServiceWorker(context, async ({ pattern, msg, exact }) => {
    const tabs = await chrome.tabs.query({ url: pattern });
    if (!tabs.length) return null;
    const tab = exact ? tabs.find((t) => t.url === exact) || tabs[tabs.length - 1] : tabs[tabs.length - 1];
    if (!tab?.id) return null;
    try {
      return await chrome.tabs.sendMessage(tab.id, msg);
    } catch {
      return null;
    }
  }, { pattern: urlPattern, msg: message, exact: exactUrl });
}

async function getActionBadge(context, tabUrlPattern = 'https://www.myntra.com/*') {
  return inServiceWorker(context, async (pattern) => {
    const tabs = await chrome.tabs.query({ url: pattern });
    if (!tabs[0]?.id) return null;
    return chrome.action.getBadgeText({ tabId: tabs[0].id });
  }, tabUrlPattern);
}

async function getManifestVersion(context) {
  return inServiceWorker(context, () => chrome.runtime.getManifest().version);
}

module.exports = {
  waitForServiceWorker,
  getExtensionId,
  extensionUrl,
  inServiceWorker,
  sendTabMessage,
  getActionBadge,
  getManifestVersion,
};
