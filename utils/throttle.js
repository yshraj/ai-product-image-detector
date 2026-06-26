// utils/throttle.js
// Concurrency limiter + simple rate limiter for API calls.
(function () {
  // Runs at most `max` async tasks concurrently.
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

  // Token-bucket style rate limiter: at most `count` calls per `windowMs`.
  function createRateLimiter(count, windowMs) {
    const timestamps = [];
    return function allow() {
      const now = Date.now();
      while (timestamps.length && now - timestamps[0] > windowMs) timestamps.shift();
      if (timestamps.length >= count) return false;
      timestamps.push(now);
      return true;
    };
  }

  window.RMF_Throttle = { createLimiter, createRateLimiter };
})();
