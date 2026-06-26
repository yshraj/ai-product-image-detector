// utils/logger.js
// Lightweight dev logger. Toggle RMF_DEBUG in console: localStorage.RMF_DEBUG = '1'
(function () {
  const enabled = () => {
    try { return localStorage.getItem('RMF_DEBUG') === '1'; } catch { return false; }
  };
  const prefix = '%c[RMF]';
  const style = 'color:#639922;font-weight:600';

  window.RMF_Log = {
    debug(...args) { if (enabled()) console.log(prefix, style, ...args); },
    info(...args) { console.log(prefix, style, ...args); },
    warn(...args) { console.warn(prefix, style, ...args); },
    error(...args) { console.error(prefix, style, ...args); },
  };
})();
