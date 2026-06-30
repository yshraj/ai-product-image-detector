// content/content.js — main orchestration injected into supported pages.
(async function () {
  const SITE = window.RMF_SITE;
  if (!SITE) return; // not a supported page (site config guard didn't match)

  const Log = window.RMF_Log;
  const limit = window.RMF_Throttle.createLimiter(3); // max 3 detections at once

  const ContentDefaults = window.RMF_Defaults || {};
  const PREF_DEFAULTS = ContentDefaults.CONTENT_PREF_DEFAULTS || {
    mode: 'badge', enabled: true, minConfidence: 70, disabledSites: [], notifyOnAI: false,
  };

  // Badge tiers (confidence = P(AI), 0-100):
  //   confidence >= AI_THRESHOLD          → "AI Generated" (strong, red)
  //   minConfidence <= conf < AI_THRESHOLD → "Likely AI"    (amber)
  //   confidence < minConfidence           → not flagged (no badge)
  // minConfidence (default 70) is the user-tunable floor in Settings.
  const AI_THRESHOLD = ContentDefaults.AI_THRESHOLD ?? 90;

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
  let notifyOnAI = prefs.notifyOnAI === true;  // opt-in
  let notified = false;                        // one notification per page load
  let corrections = new Set();                 // image URLs marked "not AI"

  async function loadCorrections() {
    try {
      const { rmf_corrections: list = [] } = await chrome.storage.local.get('rmf_corrections');
      corrections = new Set((list || []).map((c) => c.imageUrl).filter(Boolean));
    } catch { corrections = new Set(); }
  }
  await loadCorrections();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.rmf_corrections) loadCorrections();
  });

  // Detection runs only when globally enabled AND this site isn't disabled.
  const isActive = () => enabled && siteEnabled;

  // Live session counters surfaced to the popup (with verdict breakdown).
  const session = { scanned: 0, ai: 0, aiHigh: 0, aiLikely: 0, total: 0, pending: 0 };
  let highlightFilter = null;
  let highlightTimer = null;

  // Report counts to the service worker so it can paint the toolbar badge.
  // Debounced so a burst of detections produces at most one update per tick.
  let badgeTimer = null;
  function reportBadge() {
    if (badgeTimer) return;
    badgeTimer = setTimeout(() => {
      badgeTimer = null;
      try {
        chrome.runtime.sendMessage({
          type: 'RMF_BADGE',
          ai: session.ai, aiHigh: session.aiHigh, aiLikely: session.aiLikely,
          scanned: session.scanned, active: isActive(),
        });
      } catch { /* worker unavailable */ }
      maybeNotify();
    }, 300);
  }

  // Fire one opt-in notification per page once AI is found (worker throttles).
  function maybeNotify() {
    if (!notifyOnAI || notified || session.ai <= 0 || !isActive()) return;
    notified = true;
    try { chrome.runtime.sendMessage({ type: 'RMF_NOTIFY', ai: session.ai }); } catch { /* noop */ }
  }

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
    badge.className = 'rmf-badge rmf-compact';
    badge.setAttribute('data-conf', high ? 'high' : 'med');
    // Announce to assistive tech (the host page's content, not ours).
    badge.setAttribute('role', 'img');
    const verdict = high ? 'AI generated' : 'Likely AI generated';
    badge.setAttribute('aria-label',
      `${(window.RMF_STRINGS?.app?.shortName) || 'ShopShield'}: ${verdict}, ${Math.round(confidence)}% confidence` +
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
    const compact = document.createElement('span');
    compact.className = 'rmf-compact-ico';
    compact.textContent = high ? '🤖' : '⚠️';
    const score = document.createElement('span');
    score.className = 'rmf-score';
    score.textContent = `${Math.round(confidence)}%`;
    badge.append(compact, label, score);

    const bar = document.createElement('div');
    bar.className = 'rmf-bar';
    bar.style.width = `${Math.round(confidence)}%`;
    bar.style.background = high ? '#E24B4A' : '#EF9F27';

    target.append(badge, bar);
    const img = card.querySelector(SITE.imageSelector);
    attachDetails(badge, target, {
      confidence, source: result.source, preview: !!result.preview, model: result.model,
      layers: result.layers || null,
      imageUrl: (img && (img.currentSrc || img.src)) || '',
      query: extractName(card) || '',
      card,
    });
    applyMode(card);
  }

  // --- "why flagged?" details popover --------------------------------------
  // Radical transparency: clicking a badge explains the verdict. Keyboard +
  // screen-reader accessible; never navigates the underlying product link.
  function attachDetails(badge, target, info) {
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('aria-expanded', 'false');
    badge.style.pointerEvents = 'auto';
    badge.style.cursor = 'pointer';
    const toggle = (e) => { e.preventDefault(); e.stopPropagation(); togglePopover(badge, target, info); };
    badge.addEventListener('click', toggle);
    badge.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') toggle(e);
    });
  }

  function togglePopover(badge, target, info) {
    const existing = target.querySelector('.rmf-pop');
    // Only one popover open at a time, anywhere on the page.
    document.querySelectorAll('.rmf-pop').forEach((p) => { if (p !== existing) p.remove(); });
    document.querySelectorAll('.rmf-badge[aria-expanded="true"]').forEach((b) => {
      if (b !== badge) b.setAttribute('aria-expanded', 'false');
    });
    if (existing) { existing.remove(); badge.setAttribute('aria-expanded', 'false'); return; }

    let cleanup = () => {};
    const close = () => { target.querySelector('.rmf-pop')?.remove(); badge.setAttribute('aria-expanded', 'false'); cleanup(); };
    const pop = buildPopover(info, close);
    target.appendChild(pop);
    badge.setAttribute('aria-expanded', 'true');

    const onKey = (e) => { if (e.key === 'Escape') { close(); badge.focus(); } };
    const onDoc = (e) => { if (!pop.contains(e.target) && e.target !== badge) close(); };
    cleanup = () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('click', onDoc, true);
    };
    // Registered synchronously: the opening click's capture phase has already
    // passed for this event, so these won't immediately self-close the popover.
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', onDoc, true);
  }

  function buildPopover(info, onClose) {
    const S = window.RMF_STRINGS;
    const t = (path, fallback) => (S ? path(S) : fallback);
    const pop = document.createElement('div');
    pop.className = 'rmf-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', t((s) => s.details.heading, 'Why flagged?'));

    const h = document.createElement('div'); h.className = 'rmf-pop-h';
    h.textContent = t((s) => s.details.heading, 'Why flagged?');

    const conf = document.createElement('div'); conf.className = 'rmf-pop-row';
    conf.textContent = t((s) => s.details.confidence(Math.round(info.confidence)), `${Math.round(info.confidence)}% AI`);

    const isPreview = info.preview || info.source === 'heuristic';
    const eng = document.createElement('div'); eng.className = 'rmf-pop-row';
    eng.textContent = isPreview
      ? t((s) => s.details.enginePreview, 'On-device preview')
      : t((s) => s.details.engineHuggingFace, 'Hugging Face');

    pop.append(h, conf, eng);

    if (info.model && !isPreview) {
      const m = document.createElement('div'); m.className = 'rmf-pop-sub';
      m.textContent = t((s) => s.details.modelNote(info.model), info.model);
      pop.appendChild(m);
    }
    if (isPreview) {
      const n = document.createElement('div'); n.className = 'rmf-pop-note';
      n.textContent = t((s) => s.details.previewNote, 'Preview heuristic — low accuracy.');
      pop.appendChild(n);
    }

    if (info.layers) {
      const layers = document.createElement('div');
      layers.className = 'rmf-pop-layers';
      const rows = [];
      if (info.layers.exif != null) {
        rows.push(t((s) => s.details.layerExif(info.layers.exif), `EXIF: ${info.layers.exif}% real`));
      } else rows.push(t((s) => s.details.layerNone, 'EXIF: not run'));
      if (info.layers.tfjs != null) {
        rows.push(t((s) => s.details.layerTfjs(info.layers.tfjs), `On-device: ${info.layers.tfjs}% AI`));
      }
      if (info.layers.hf != null) {
        rows.push(t((s) => s.details.layerHf(info.layers.hf), `Hugging Face: ${info.layers.hf}% AI`));
      }
      layers.textContent = rows.join(' · ');
      pop.appendChild(layers);
    }

    const actions = buildActions(info);
    if (actions) pop.appendChild(actions);

    const wrong = document.createElement('button');
    wrong.className = 'rmf-pop-wrong';
    wrong.type = 'button';
    wrong.textContent = t((s) => s.details.markWrong, 'Not AI? Mark wrong');
    wrong.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!info.imageUrl) return;
      const entry = {
        imageUrl: info.imageUrl,
        pageUrl: location.href,
        site: SITE.name,
        confidence: info.confidence,
      };
      try {
        const { rmf_corrections: list = [] } = await chrome.storage.local.get('rmf_corrections');
        const next = [{ ...entry, at: Date.now() }, ...list.filter((c) => c.imageUrl !== info.imageUrl)].slice(0, 200);
        await chrome.storage.local.set({ rmf_corrections: next });
        corrections.add(info.imageUrl);
        if (info.card) {
          info.card.querySelector('.rmf-badge')?.remove();
          info.card.querySelector('.rmf-bar')?.remove();
          info.card.setAttribute('data-rmf-ai', 'false');
          if (info.card.__rmfResult) info.card.__rmfResult.isAI = false;
        }
        onClose();
      } catch {
        wrong.textContent = 'Could not save — try again';
        setTimeout(() => {
          wrong.textContent = t((s) => s.details.markWrong, 'Not AI? Mark wrong');
        }, 2500);
      }
    });
    pop.appendChild(wrong);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'rmf-pop-close'; closeBtn.type = 'button';
    closeBtn.textContent = t((s) => s.details.close, 'Close');
    closeBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClose(); });
    pop.appendChild(closeBtn);
    return pop;
  }

  // Reverse image search + marketplace search handoffs (no backend — these just
  // open search/visual-search URLs in a new tab).
  function buildActions(info) {
    const S = window.RMF_STRINGS;
    const enc = encodeURIComponent;
    const wrap = document.createElement('div');
    wrap.className = 'rmf-pop-actions';
    let any = false;

    if (info.imageUrl) {
      wrap.appendChild(actionRow(S ? S.actions.findIdentical : 'Find identical', [
        popLink(S ? S.actions.lens : 'Google Lens', 'https://lens.google.com/uploadbyurl?url=' + enc(info.imageUrl)),
        popLink(S ? S.actions.bing : 'Bing', 'https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:' + enc(info.imageUrl)),
      ]));
      any = true;
    }
    if (info.query) {
      const q = enc(info.query);
      const sites = [
        { name: S ? S.actions.amazon : 'Amazon', site: 'amazon', url: 'https://www.amazon.in/s?k=' + q },
        { name: S ? S.actions.flipkart : 'Flipkart', site: 'flipkart', url: 'https://www.flipkart.com/search?q=' + q },
        { name: S ? S.actions.google : 'Google', site: 'google', url: 'https://www.google.com/search?q=' + q },
      ].filter((s) => s.site !== SITE.name); // don't search the site you're already on
      wrap.appendChild(actionRow(S ? S.actions.searchElsewhere : 'Search elsewhere', sites.map((s) => popLink(s.name, s.url))));
      any = true;
    }
    return any ? wrap : null;
  }

  function actionRow(label, links) {
    const row = document.createElement('div'); row.className = 'rmf-pop-arow';
    const l = document.createElement('div'); l.className = 'rmf-pop-alabel'; l.textContent = label;
    const box = document.createElement('div'); box.className = 'rmf-pop-alinks';
    links.forEach((a) => box.appendChild(a));
    row.append(l, box);
    return row;
  }

  function popLink(text, href) {
    const a = document.createElement('a');
    a.className = 'rmf-pop-link';
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = text;
    a.addEventListener('click', (e) => e.stopPropagation()); // keep the product link / popover intact
    return a;
  }

  // --- display mode --------------------------------------------------------
  function countCards() {
    return document.querySelectorAll(SITE.cardSelector).length;
  }

  function updateSessionCounts() {
    session.total = countCards();
    session.pending = document.querySelectorAll(`${SITE.cardSelector}[data-rmf-scanned="pending"]`).length;
  }

  function recordScanHistory() {
    if (!session.scanned) return;
    try {
      chrome.storage.local.get({ rmf_scan_history: [] }).then((data) => {
        const hist = Array.isArray(data.rmf_scan_history) ? data.rmf_scan_history : [];
        hist.unshift({
          site: SITE.name,
          scanned: session.scanned,
          ai: session.ai,
          aiHigh: session.aiHigh,
          aiLikely: session.aiLikely,
          at: Date.now(),
          url: location.href,
        });
        chrome.storage.local.set({ rmf_scan_history: hist.slice(0, 10) });
      });
    } catch { /* ignore */ }
  }

  function refilterFromCache() {
    session.scanned = 0; session.ai = 0; session.aiHigh = 0; session.aiLikely = 0;
    document.querySelectorAll(`${SITE.cardSelector}[data-rmf-scanned]`).forEach((card) => {
      const r = card.__rmfResult;
      if (!r) return;
      card.querySelector('.rmf-badge')?.remove();
      card.querySelector('.rmf-bar')?.remove();
      if (r.isAI && r.confidence >= minConfidence) injectOverlay(card, r);
      else {
        card.setAttribute('data-rmf-scanned', 'true');
        card.setAttribute('data-rmf-ai', 'false');
        applyMode(card);
        session.scanned++;
      }
    });
    updateSessionCounts();
    reportBadge();
  }

  function highlightCards(filter) {
    document.querySelectorAll('.rmf-highlight').forEach((c) => c.classList.remove('rmf-highlight'));
    if (highlightTimer) { clearTimeout(highlightTimer); highlightTimer = null; }
    if (!filter || filter === 'all') { highlightFilter = null; return; }
    highlightFilter = filter;
    const cards = document.querySelectorAll(`${SITE.cardSelector}[data-rmf-scanned="true"]`);
    let first = null;
    cards.forEach((card) => {
      const r = card.__rmfResult;
      if (!r) return;
      const flagged = r.isAI && r.confidence >= minConfidence;
      const high = flagged && r.confidence >= AI_THRESHOLD;
      const med = flagged && !high;
      const ok = !flagged;
      const match = (filter === 'high' && high) || (filter === 'med' && med) || (filter === 'ok' && ok);
      if (match) {
        card.classList.add('rmf-highlight');
        if (!first) first = card;
      }
    });
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightTimer = setTimeout(() => {
      document.querySelectorAll('.rmf-highlight').forEach((c) => c.classList.remove('rmf-highlight'));
      highlightFilter = null;
    }, 4000);
  }

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
      await Promise.race([
        new Promise((resolve) => {
          imgEl.addEventListener('load', resolve, { once: true });
          imgEl.addEventListener('error', resolve, { once: true });
        }),
        new Promise((resolve) => setTimeout(resolve, 12000)),
      ]);
      if (!imgEl.complete) {
        card.removeAttribute('data-rmf-scanned');
        return;
      }
    }

    const imgUrl = imgEl.currentSrc || imgEl.src;
    if (corrections.has(imgUrl)) {
      card.setAttribute('data-rmf-scanned', 'true');
      card.setAttribute('data-rmf-ai', 'false');
      applyMode(card);
      session.scanned++;
      updateSessionCounts();
      reportBadge();
      return;
    }

    try {
      const result = await limit(() => window.RMF_Detect(imgUrl));
      card.__rmfResult = result; // kept for the page-export report
      injectOverlay(card, result);
      session.scanned++;
      if (result.isAI && result.confidence >= minConfidence) {
        session.ai++;
        if (result.confidence >= AI_THRESHOLD) session.aiHigh++; else session.aiLikely++;
        logFlag(imgUrl, result);
        recordSellerStats(card, result);
        recordPriceTag(card, imgUrl);
      }
      updateSessionCounts();
      reportBadge();
      if (session.pending === 0 && session.scanned > 0) recordScanHistory();
    } catch (err) {
      Log?.debug('processCard error', err);
      card.removeAttribute('data-rmf-scanned'); // allow a retry later
    }
  }

  // Record a flagged item in the local activity history (worker dedupes/caps).
  function logFlag(imageUrl, result) {
    try {
      chrome.runtime.sendMessage({
        type: 'RMF_HISTORY_ADD',
        entry: {
          site: SITE.name,
          score: Math.round(result.confidence),
          high: result.confidence >= AI_THRESHOLD,
          source: result.source || '',
          preview: !!result.preview,
          imageUrl,
          pageUrl: location.href,
        },
      });
    } catch { /* worker unavailable */ }
  }

  // --- page export report --------------------------------------------------
  // Best-effort product name (brand + title), price (₹), and the AI verdict for
  // every scanned card. Name/price use generic text heuristics so they work
  // across sites without fragile per-site title selectors.
  const PRICE_RE = /₹\s?[\d,]+(?:\.\d+)?/;
  const NOISE_RE = /^(₹|\(?\d+%|.*%\s*off|rating|ratings|assured|hot deal|only \d+ left|sponsored|new|add to (bag|cart)|wishlist)/i;

  function extractPrice(card) {
    const m = (card.textContent || '').match(PRICE_RE);
    return m ? m[0].replace(/\s/g, '') : null;
  }

  function extractName(card) {
    const lines = (card.innerText || card.textContent || '')
      .split('\n').map((s) => s.trim())
      .filter((s) => s && !PRICE_RE.test(s) && !NOISE_RE.test(s));
    if (!lines.length) return null;
    return lines.slice(0, 2).join(' ').slice(0, 160);
  }

  function extractBrand(card) {
    const name = extractName(card) || '';
    const first = name.split(/\s+/)[0];
    return first && first.length > 2 ? first : '';
  }

  async function recordSellerStats(card, result) {
    const seller = extractBrand(card);
    if (!seller) return;
    const verdict = result.confidence >= AI_THRESHOLD ? 'high' : 'med';
    try {
      const { rmf_seller_trust: all = {} } = await chrome.storage.local.get('rmf_seller_trust');
      const key = seller.toLowerCase().slice(0, 80);
      const cur = all[key] || { name: seller, aiGenerated: 0, likelyAi: 0, normal: 0, lastSeen: 0 };
      if (verdict === 'high') cur.aiGenerated++; else cur.likelyAi++;
      cur.lastSeen = Date.now();
      cur.name = seller;
      all[key] = cur;
      await chrome.storage.local.set({ rmf_seller_trust: all });
      const total = cur.aiGenerated + cur.likelyAi + cur.normal;
      if (total >= 3) {
        const aiPct = Math.round(((cur.aiGenerated + cur.likelyAi) / total) * 100);
        let tag = card.querySelector('.rmf-trust');
        if (!tag) {
          tag = document.createElement('span');
          tag.className = 'rmf-trust';
          const anchor = card.querySelector('a') || card;
          anchor.insertAdjacentElement('afterbegin', tag);
        }
        tag.textContent = aiPct >= 50 ? `⚠ ${aiPct}% AI` : `✓ ${100 - aiPct}% real`;
        tag.title = `${seller}: ${cur.aiGenerated} AI, ${cur.likelyAi} likely, ${cur.normal} normal`;
      }
    } catch { /* ignore */ }
  }

  async function recordPriceTag(card, imgUrl) {
    const priceText = extractPrice(card);
    if (!priceText) return;
    const price = Number(String(priceText).replace(/[^\d.]/g, ''));
    if (!Number.isFinite(price)) return;
    const link = card.querySelector('a[href]');
    const id = link?.href ? new URL(link.href, location.href).pathname.slice(0, 120) : imgUrl.slice(-80);
    try {
      const { rmf_price_history: all = {} } = await chrome.storage.local.get('rmf_price_history');
      const hist = Array.isArray(all[id]) ? all[id] : [];
      const low = hist.length ? Math.min(...hist.map((h) => h.price)) : price;
      hist.push({ price, at: Date.now() });
      all[id] = hist.slice(-20);
      await chrome.storage.local.set({ rmf_price_history: all });
      if (price <= low) {
        const target = resolveOverlayTarget(card);
        let tag = target.querySelector('.rmf-price-tag');
        if (!tag) {
          tag = document.createElement('span');
          tag.className = 'rmf-price-tag';
          target.appendChild(tag);
        }
        tag.textContent = price < low ? 'Price drop' : 'Lowest seen';
      }
    } catch { /* ignore */ }
  }

  function engineOf(r) {
    if (r.source === 'huggingface') return 'huggingface';
    if (r.preview || r.source === 'heuristic') return 'preview';
    return r.source || '';
  }

  function buildReport() {
    const cards = document.querySelectorAll(`${SITE.cardSelector}[data-rmf-scanned="true"]`);
    const products = [];
    let aiFlagged = 0;
    cards.forEach((card) => {
      const r = card.__rmfResult;
      if (!r) return;
      const flagged = r.isAI && r.confidence >= minConfidence;
      if (flagged) aiFlagged++;
      const img = card.querySelector(SITE.imageSelector);
      products.push({
        name: extractName(card),
        price: extractPrice(card),
        verdict: flagged ? 'ai' : 'real',
        confidence: Math.round(r.confidence),
        engine: engineOf(r),
        model: r.model || '',
        imageUrl: (img && (img.currentSrc || img.src)) || null,
      });
    });
    return {
      app: (window.RMF_STRINGS?.app?.name) || 'ShopShield',
      site: SITE.name,
      pageUrl: location.href,
      scannedAt: new Date().toISOString(),
      count: products.length,
      aiFlagged,
      products,
    };
  }

  // Best-effort "current product" for the Compare/Tools tabs. Uses Open Graph /
  // standard meta + heuristics so it works on product pages of any site without
  // fragile per-site selectors; fields degrade to '' when unavailable.
  function walkJsonLd(fn) {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const found = fn(item);
          if (found) return found;
          if (item['@graph']) {
            for (const g of item['@graph']) {
              const f2 = fn(g);
              if (f2) return f2;
            }
          }
        }
      } catch { /* skip malformed blocks */ }
    }
    return '';
  }

  function cleanTitle(raw) {
    if (!raw) return '';
    return raw
      .replace(/\s*[-–—|]\s*Buy\b[^|]*$/i, '')
      .replace(/\s*[-–—|]\s*Online at Best Prices[^|]*$/i, '')
      .replace(/\s*\|\s*Flipkart\.com.*$/i, '')
      .replace(/\s*\|\s*Myntra.*$/i, '')
      .replace(/\s*\|\s*Nykaa.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getProduct() {
    const isProductPage = (window.RMF_MarketplaceUrl?.isMarketplaceProductUrl || (() => false))(location.href);
    if (!isProductPage) {
      return { site: SITE.name, title: '', isProductPage: false, url: location.href };
    }

    const meta = (sel) => document.querySelector(sel)?.getAttribute('content')?.trim() || '';
    const jsonTitle = walkJsonLd((item) => {
      if (item['@type'] === 'Product' && item.name) return String(item.name);
      return '';
    });
    const ogTitle = meta('meta[property="og:title"]') || meta('meta[name="twitter:title"]');
    const h1 = document.querySelector('h1')?.textContent || '';
    const title = cleanTitle(jsonTitle || ogTitle || h1 || document.title || '').slice(0, 200);

    let image = meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]');
    if (!image) {
      let best = '', area = 0;
      document.querySelectorAll('img').forEach((im) => {
        const src = im.currentSrc || im.src;
        if (!src || src.startsWith('data:')) return;
        const a = (im.naturalWidth || im.width || 0) * (im.naturalHeight || im.height || 0);
        if (a > area) { area = a; best = src; }
      });
      image = best;
    }

    const brand = meta('meta[property="product:brand"]') || meta('meta[property="og:brand"]') ||
      walkJsonLd((item) => (item['@type'] === 'Product' && item.brand?.name) || item.brand?.name || '');

    const priceMeta = meta('meta[property="product:price:amount"]') || meta('meta[property="og:price:amount"]');
    let price = priceMeta ? ('₹' + priceMeta).replace('₹₹', '₹') : '';
    if (!price) { const m = (document.body.innerText || '').match(/₹\s?[\d,]+(?:\.\d+)?/); if (m) price = m[0].replace(/\s/g, ''); }

    let rating = meta('meta[property="og:rating"]') || walkJsonLd((item) => {
      const ar = item.aggregateRating || (item['@type'] === 'AggregateRating' ? item : null);
      if (ar?.ratingValue) {
        const val = String(ar.ratingValue);
        return ar.bestRating ? `${val}/${ar.bestRating}` : val;
      }
      return '';
    });
    if (!rating) {
      const m = (document.body.innerText || '').match(/(\d(?:\.\d)?)\s*(?:★|out of 5|\/\s*5)/i);
      if (m) rating = m[1] + '/5';
    }

    let seller = meta('meta[property="product:retailer"]') || walkJsonLd((item) => {
      const offers = item.offers || (item['@type'] === 'Offer' ? item : null);
      const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
      for (const o of list) {
        if (o.seller?.name) return o.seller.name;
      }
      return '';
    });
    if (!seller) {
      const m = (document.body.innerText || '').match(/(?:sold by|seller[:\s]+)([A-Za-z0-9][A-Za-z0-9 &.'-]{1,40})/i);
      if (m) seller = m[1].trim();
    }

    return { site: SITE.name, title, brand, price, rating, seller, image, url: location.href, isProductPage: true };
  }

  function clearStalePending() {
    document.querySelectorAll(`${SITE.cardSelector}[data-rmf-scanned="pending"]`).forEach((card) => {
      card.removeAttribute('data-rmf-scanned');
    });
  }

  // --- scanning + observing ------------------------------------------------
  function scanAll() {
    const cards = document.querySelectorAll(SITE.cardSelector);
    Log?.debug(`scanning ${cards.length} cards on ${SITE.name}`);
    session.total = cards.length;
    cards.forEach(processCard);
    updateSessionCounts();
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
    reportBadge(); // keep the toolbar badge in sync with enabled/site state
  }

  // Re-evaluate already-scanned cards without new network calls (cache hits).
  // Used when the confidence threshold changes.
  function rerender() {
    teardownBadges();
    session.scanned = 0; session.ai = 0; session.aiHigh = 0; session.aiLikely = 0;
    reconcile();
  }

  function teardownBadges() {
    document.querySelectorAll('.rmf-badge, .rmf-bar, .rmf-pop').forEach((el) => el.remove());
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
        mode = cleanMode(msg.mode);
        applyModeAll();
        break;
      case 'SET_ENABLED':
        enabled = msg.enabled;
        reconcile();
        break;
      case 'RESCAN':
        rerender(); // clears badges + counts, then re-scans (cache hits)
        sendResponse?.({ ok: true });
        return true;
      case 'GET_STATS':
        updateSessionCounts();
        sendResponse({ ...session, active: isActive() });
        return true; // async-safe
      case 'HIGHLIGHT_FILTER':
        highlightCards(msg.filter);
        sendResponse?.({ ok: true });
        return true;
      case 'SET_MIN_CONFIDENCE':
        minConfidence = cleanConf(msg.minConfidence);
        refilterFromCache();
        sendResponse?.({ ok: true });
        return true;
      case 'GET_PAGE_REPORT':
        sendResponse(buildReport());
        return true;
      case 'GET_PRODUCT':
        sendResponse(getProduct());
        return true;
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
      refilterFromCache();
    }
    if (changes.notifyOnAI) notifyOnAI = changes.notifyOnAI.newValue === true;
  });

  // --- init ----------------------------------------------------------------
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && session.scanned > 0) reportBadge();
  });

  if (isActive()) {
    clearStalePending();
    await scanAll();
    startObserver();
  }
  Log?.debug(`${(window.RMF_STRINGS?.app?.shortName) || 'ShopShield'} on ${SITE.name} (mode=${mode}, active=${isActive()}, minConf=${minConfidence})`);
})();
