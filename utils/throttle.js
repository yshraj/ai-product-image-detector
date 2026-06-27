// utils/throttle.js
// Concurrency limiter for detection calls.
(function () {
  // Runs at most `max` async tasks concurrently; the rest queue and run as
  // slots free up. Used to cap how many image detections are in flight at once.
  function createLimiter(max) {
    let active = 0;
    const queue = [];
    const next = () => {
      if (active >= max || queue.length === 0) return;
      active++;
      const { fn, resolve, reject } = queue.shift();
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => { active--; next(); });
    };
    return function run(fn) {
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        next();
      });
    };
  }

  window.RMF_Throttle = { createLimiter };
})();
