// Message-passing helpers between popup, content scripts, and background.
const { inServiceWorker, sendTabMessage, getExtensionId, extensionUrl } = require('./chrome-api.cjs');

/** Dispatch a runtime message from an extension page (popup) so the SW listener receives it. */
async function sendRuntimeMessage(context, message) {
  const id = await getExtensionId(context);
  const page = await context.newPage();
  try {
    await page.goto(extensionUrl(id, 'popup/popup.html'), { waitUntil: 'domcontentloaded' });
    return await page.evaluate((msg) => new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (response) => {
        const err = chrome.runtime.lastError;
        resolve(err ? { ok: false, error: err.message } : response);
      });
    }), message);
  } finally {
    await page.close();
  }
}

async function getContentStats(context, tabUrl = 'https://www.myntra.com/*') {
  return sendTabMessage(context, tabUrl, { type: 'GET_STATS' });
}

async function getProduct(context, tabUrl = 'https://www.myntra.com/*', exactUrl) {
  return sendTabMessage(context, tabUrl, { type: 'GET_PRODUCT' }, exactUrl);
}

async function getPageReport(context, tabUrl = 'https://www.myntra.com/*') {
  return sendTabMessage(context, tabUrl, { type: 'GET_PAGE_REPORT' });
}

async function rescanTab(context, tabUrl = 'https://www.myntra.com/*') {
  return sendTabMessage(context, tabUrl, { type: 'RESCAN' });
}

async function setContentEnabled(context, enabled, tabUrl = 'https://www.myntra.com/*') {
  return sendTabMessage(context, tabUrl, { type: 'SET_ENABLED', enabled });
}

async function toggleDetection(context) {
  return sendRuntimeMessage(context, { type: 'RMF_TOGGLE_ENABLED' });
}

async function validateHfToken(context, token) {
  return sendRuntimeMessage(context, { type: 'RMF_VALIDATE', provider: 'huggingface', token });
}

async function fetchImageViaWorker(context, url) {
  return sendRuntimeMessage(context, { type: 'RMF_FETCH_IMAGE', url });
}

async function remoteDetectViaWorker(context, url) {
  return sendRuntimeMessage(context, { type: 'RMF_REMOTE_DETECT', url });
}

async function getEngineHealth(context) {
  return sendRuntimeMessage(context, { type: 'RMF_ENGINE_HEALTH' });
}

module.exports = {
  sendRuntimeMessage,
  getContentStats,
  getProduct,
  getPageReport,
  rescanTab,
  setContentEnabled,
  toggleDetection,
  validateHfToken,
  fetchImageViaWorker,
  remoteDetectViaWorker,
  getEngineHealth,
};
