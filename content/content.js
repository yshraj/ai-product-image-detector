// content/content.js — main orchestration injected into supported pages.
(async function () {
  const SITE = window.RMF_SITE;
  if (!SITE) return; // not a supported page (site config guard didn't match)

  const Log = window.RMF_Log;
  const limit = window.RMF_Throttle.createLimiter(3); // max 3 detections at once

  const PREF_DEFAULTS = { mode: 'badge', enabled: true, minConfidence: 70, disabledSites: [] };

  // Badge tiers (confidence = P(AI), 0-100):
  //   confidence >= AI_THRESHOLD          → "AI Generated" (strong, red)
  //   minConfidence <= conf < AI_THRESHOLD → "Likely AI"    (amber)
  //   confidence < minConfidence           → not flagged (no badge)
  // minConfidence (default 70) is the user-tunable floor in Settings.
  const AI_THRESHOLD = 95;

  // Coercers — never trust stored values (settings can be imported from a file
  // or synced from another device). A bad value must degrade safely, never throw.
  const cleanMode = (v) => (['all', 'badge', 'hide'].includes(v) ? v : 'badge');
  const cleanConf = (v) => (Number.isFinite(Number(v)) ? Math.min(100, Math.max(0, Number(v))) : 70);
  const siteDisabled = (v) => Array.isArray(v) && v.includes(SITE.name);

  let prefs;
  try {
    prefs = await chrome.storage.sync.get(PREF_DEFAULTS);
  } catch {
    prefs = { ...PREF_DEFAULTS };
  }

  let mode = cleanMode(prefs.mode);            // 'all' | 'badge' | 'hide'
  let enabled = prefs.enabled !== false;       // global on/off (default on)
  let minConfidence = cleanConf(prefs.minConfidence);
  let siteEnabled = !siteDisabled(prefs.disabledSites);

  // Detection runs only when globally enabled AND this site isn't disabled.
  const isActive = () => enabled && siteEnabled;

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
    // A card counts as flagged only if the model says AI *and* the confidence
    // clears the user's threshold — this is what the "minimum confidence" pref
    // controls. Below the threshold we treat it as not flagged (no badge).
    const flagged = isAI && confidence >= minConfidence;
    card.setAttribute('data-rmf-scanned', 'true');
    card.setAttribute('data-rmf-ai', flagged ? 'true' : 'false');

    if (!flagged) { applyMode(card); return; }

    const target = resolveOverlayTarget(card);
    target.querySelector('.rmf-badge')?.remove();
    target.querySelector('.rmf-bar')?.remove();

    const high = confidence >= AI_THRESHOLD;
    const badge = document.createElement('div');
    badge.className = 'rmf-badge';
    badge.setAttribute('data-conf', high ? 'high' : 'med');
    // Announce to assistive tech (the host page's content, not ours).
    badge.setAttribute('role', 'img');
    const verdict = high ? 'AI generated' : 'Likely AI generated';
    badge.setAttribute('aria-label',
      `RealModel Filter: ${verdict}, ${Math.round(confidence)}% confidence` +
      (result.preview ? ' (preview heuristic)' : ''));
    if (result.preview) {
      badge.setAttribute('data-preview', 'true');
      badge.title = 'Heuristic preview — connect a model in the popup for accurate detection';
    } else {
      badge.title = `${verdict} · ${Math.round(confidence)}% confidence`;
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

  // Viewport gate: only spend a detection (and, for remote engines, an API call)
  // on cards the user can actually see. Off-screen cards are left untouched and
  // get picked up by the scroll-driven rescan once they come into view. Combined
  // with the per-URL cache this is the single biggest lever for keeping remote
  // (Hugging Face) call volume low — we never analyse images nobody looks at.
  const VIEW_MARGIN = 300; // px above/below the viewport to scan slightly ahead
  function isInView(el) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false; // not laid out / hidden
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    return r.bottom >= -VIEW_MARGIN && r.top <= vh + VIEW_MARGIN &&
           r.right >= -VIEW_MARGIN && r.left <= vw + VIEW_MARGIN;
  }

  // --- per-card processing -------------------------------------------------
  async function processCard(card) {
    if (!isActive()) return;
    if (card.getAttribute('data-rmf-scanned')) return;
    // Skip without marking so it's retried when scrolled into view.
    if (!isInView(card)) return;

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
      if (result.isAI && result.confidence >= minConfidence) session.ai++;
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
    if (scanQueued || !isActive()) return;
    scanQueued = true;
    const run = () => { scanQueued = false; scanAll(); };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 500 });
    else setTimeout(run, 200);
  }

  let observer = null;
  let onScroll = null;
  function startObserver() {
    if (observer) return; // idempotent — never attach twice
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

  // Single source of truth: bring the DOM in line with the current settings.
  function reconcile() {
    if (isActive()) { scanAll(); startObserver(); }
    else { stopObserver(); teardownBadges(); }
  }

  // Re-evaluate already-scanned cards without new network calls (cache hits).
  // Used when the confidence threshold changes.
  function rerender() {
    teardownBadges();
    session.scanned = 0; session.ai = 0;
    reconcile();
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
        reconcile();
        break;
      case 'GET_STATS':
        sendResponse({ ...session, active: isActive() });
        return true; // async-safe
      default:
        break;
    }
  });

  // --- live settings sync (popup OR options page write to storage) ---------
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.mode) { mode = cleanMode(changes.mode.newValue); applyModeAll(); }
    if (changes.enabled) { enabled = changes.enabled.newValue !== false; reconcile(); }
    if (changes.disabledSites) {
      siteEnabled = !siteDisabled(changes.disabledSites.newValue);
      reconcile();
    }
    if (changes.minConfidence) {
      minConfidence = cleanConf(changes.minConfidence.newValue);
      rerender(); // recompute badges from cache against the new threshold
    }
  });

  // --- init ----------------------------------------------------------------
  if (isActive()) {
    await scanAll();
    startObserver();
  }
  Log?.info(`RealModel Filter on ${SITE.name} (mode=${mode}, active=${isActive()}, minConf=${minConfidence})`);
})();
