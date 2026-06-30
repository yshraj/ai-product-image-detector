// utils/chrome-runtime.js — promise wrapper for chrome.runtime.sendMessage.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RMF_Runtime = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  /**
   * @param {object} msg
   * @returns {Promise<object>}
   */
  function sendMessage(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (response) => {
          const err = chrome.runtime.lastError;
          if (err) resolve({ ok: false, error: err.message });
          else resolve(response ?? { ok: false, error: 'No response from extension' });
        });
      } catch (e) {
        resolve({ ok: false, error: String(e?.message || e) });
      }
    });
  }

  return { sendMessage };
}));
