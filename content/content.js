// content/content.js — main orchestration injected into supported pages.
(async function () {
  const SITE = window.RMF_SITE;
  if (!SITE) return; // not a supported page (site config guard didn't match)

  const Log = window.RMF_Log;
  const limit = window.RMF_Throttle.createLimiter(3); // max 3 detections at once

  let prefs;
  try {
    prefs = await chrome.storage.sync.get({ mode: 'badge', enabled: true });
  } catch {
    prefs = { mode: 'badge', enabled: true };
  }

  let mode = prefs.mode;       // 'all' | 'badge' | 'hide'
  let enabled = prefs.enabled;

  // Live session counters surfaced to the popup.
  const session = { scanned: 0, ai: 0 };

  // --- overlay -------------------------------------------------------------
  function resolveOverlayTarget(card) {
    let target = card.querySelector(SITE.overlayTargetSelector) || card;
    // Can't append children to an <img>; climb to its parent.
    if (target.tagName === 'IMG') target = target.parentElement || card;
    if (getComputedStyle(target).position === 'static') {
      target.style.position = 'relative';
    }
    return target;
  }

  function injectOverlay(card, result) {
    const { isAI, confidence } = result;
    card.setAttribute('data-rmf-scanned', 'true');
    card.setAttribute('data-rmf-ai', isAI ? 'true' : 'false');

    if (!isAI) { applyMode(card); return; }

    const target = resolveOverlayTarget(card);
    target.querySelector('.rmf-badge')?.remove();
    target.querySelector('.rmf-bar')?.remove();

    const high = confidence > 85;
    const badge = document.createElement('div');
    badge.className = 'rmf-badge';
    badge.setAttribute('data-conf', high ? 'high' : 'med');
    if (result.preview) {
      badge.setAttribute('data-preview', 'true');
      badge.title = 'Heuristic preview — connect a model in the popup for accurate detection';
    }
    const label = document.createElement('span');
    label.className = 'rmf-label';
    label.textContent = (high ? '🤖 AI Generated' : '⚠️ Likely AI') + (result.preview ? ' ·preview' : '');
    const score = document.createElement('span');
    score.className = 'rmf-score';
    score.textContent = `${Math.round(confidence)}%`;
    badge.append(label, score);

    const bar = document.createElement('div');
    bar.className = 'rmf-bar';
    bar.style.width = `${Math.round(confidence)}%`;
    bar.style.background = high ? '#E24B4A' : '#EF9F27';

    target.append(badge, bar);
    applyMode(card);
  }

  // --- display mode --------------------------------------------------------
  function applyMode(card) {
    const isAI = card.getAttribute('data-rmf-ai') === 'true';
    // 'hide' removes AI cards entirely; 'all' and 'badge' both keep the card +
    // its badge visible (the badge is the whole point), so they behave the same.
    card.style.display = mode === 'hide' && isAI ? 'none' : '';
  }

  function applyModeAll() {
    document.querySelectorAll(`${SITE.cardSelector}[data-rmf-scanned]`).forEach(applyMode);
  }

  // --- per-card processing -------------------------------------------------
  async function processCard(card) {
    if (!enabled) return;
    if (card.getAttribute('data-rmf-scanned')) return;

    const imgEl = card.querySelector(SITE.imageSelector);
    if (!imgEl || !imgEl.src || imgEl.src.startsWith('data:')) return;

    // Mark immediately to avoid double-processing from rapid mutations.
    card.setAttribute('data-rmf-scanned', 'pending');

    if (!imgEl.complete) {
      await new Promise((resolve) => {
        imgEl.addEventListener('load', resolve, { once: true });
        imgEl.addEventListener('error', resolve, { once: true });
      });
    }

    try {
      const result = await limit(() => window.RMF_Detect(imgEl.currentSrc || imgEl.src));
      injectOverlay(card, result);
      session.scanned++;
      if (result.isAI) session.ai++;
    } catch (err) {
      Log?.debug('processCard error', err);
      card.removeAttribute('data-rmf-scanned'); // allow a retry later
    }
  }

  // --- scanning + observing ------------------------------------------------
  function scanAll() {
    const cards = document.querySelectorAll(SITE.cardSelector);
    Log?.debug(`scanning ${cards.length} cards on ${SITE.name}`);
    cards.forEach(processCard); // processCard skips already-scanned; limiter caps concurrency
  }

  // Coalesce many rapid triggers (mutations, scroll) into one idle rescan.
  let scanQueued = false;
  function scheduleScan() {
    if (scanQueued || !enabled) return;
    scanQueued = true;
    const run = () => { scanQueued = false; scanAll(); };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 500 });
    else setTimeout(run, 200);
  }

  let observer = null;
  let onScroll = null;
  function startObserver() {
    // Observe the whole document: infinite-scroll frameworks (React/Next) often
    // replace the grid container node, which would detach a narrower observer.
    observer = new MutationObserver(() => scheduleScan());
    observer.observe(document.body, { childList: true, subtree: true });

    // Scroll also drives a rescan — this is what catches lazy-loaded images
    // whose `src` is swapped in AFTER the card is inserted (an attribute change
    // a childList observer never sees).
    onScroll = () => scheduleScan();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function stopObserver() {
    observer?.disconnect();
    observer = null;
    if (onScroll) { window.removeEventListener('scroll', onScroll); onScroll = null; }
  }

  function teardownBadges() {
    document.querySelectorAll('.rmf-badge, .rmf-bar').forEach((el) => el.remove());
    document.querySelectorAll('[data-rmf-scanned]').forEach((c) => {
      c.removeAttribute('data-rmf-scanned');
      c.removeAttribute('data-rmf-ai');
      c.style.display = '';
    });
  }

  // --- messaging from popup ------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg?.type) {
      case 'SET_MODE':
        mode = msg.mode;
        applyModeAll();
        break;
      case 'SET_ENABLED':
        enabled = msg.enabled;
        if (enabled) { scanAll(); startObserver(); }
        else { stopObserver(); teardownBadges(); }
        break;
      case 'GET_STATS':
        sendResponse({ ...session });
        return true; // async-safe
      default:
        break;
    }
  });

  // --- init ----------------------------------------------------------------
  if (enabled) {
    await scanAll();
    startObserver();
  }
  Log?.info(`RealModel Filter active on ${SITE.name} (mode=${mode})`);
})();
