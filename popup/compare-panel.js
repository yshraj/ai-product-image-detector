// popup/compare-panel.js — Compare tab UI (results, skeleton, filters, sort).
// Sends RMF_COMPARE_SEARCH / RMF_COMPARE_CACHE to the service worker, which
// runs compare/search.js (HTML scrape or SerpApi). This file only renders results.
(function () {
  const COMPARE_CACHE_PREFIX = 'rmf_compare_';
  const ALL_SITES = window.RMF_Defaults.ALL_COMPARE_SITES;
  const parsePriceNum = window.RMF_Price.parsePriceForSort;
  const send = window.RMF_Runtime.sendMessage;
  const SEARCH_TIMEOUT_MS = 120000;

  async function sendCompare(msg) {
    return Promise.race([
      send(msg),
      new Promise((resolve) => setTimeout(
        () => resolve({ ok: false, error: (S()?.compare?.searchTimeout) || 'Search timed out' }),
        SEARCH_TIMEOUT_MS,
      )),
    ]);
  }

  const state = {
    product: null,
    data: null,
    searching: false,
    sort: 'score',
    filterSites: new Set(ALL_SITES),
    searchSites: new Set(ALL_SITES),
  };

  const $ = (id) => document.getElementById(id);
  const S = () => window.RMF_STRINGS;
  const MP = () => window.RMF_CompareConfig?.MARKETPLACES || {};

  async function updateCacheCount() {
    const all = await chrome.storage.local.get(null);
    const n = Object.keys(all).filter((k) => k.startsWith(COMPARE_CACHE_PREFIX)).length;
    const el = $('compare-cache-count');
    if (el) el.textContent = String(n);
  }

  function siteStatusLine(results) {
    if (!results?.length) return '';
    const s = S();
    const errLabel = (err) => {
      if (!err) return '';
      if (/timeout/i.test(err)) return 'timeout';
      if (/HTTP/i.test(err)) return 'unreachable';
      return 'failed';
    };
    return results.map((r) => {
      const name = MP()[r.site]?.name || r.site;
      if (!r.ok) return `${name} ✗${errLabel(r.error) ? ` (${errLabel(r.error)})` : ''}`;
      if (r.best) return `${name} ✓`;
      return `${name} ○`;
    }).join(' · ');
  }

  function showSkeleton() {
    const el = $('compare-skeleton');
    const results = $('compare-results');
    if (!el) return;
    el.hidden = false;
    el.textContent = '';
    results.hidden = true;
    for (let i = 0; i < 4; i++) {
      const card = document.createElement('div');
      card.className = 'skeleton-card';
      card.innerHTML = '<div class="sk-thumb"></div><div class="sk-lines"><div class="sk-line w80"></div><div class="sk-line w60"></div><div class="sk-line w40"></div></div>';
      el.appendChild(card);
    }
  }

  function hideSkeleton() {
    const el = $('compare-skeleton');
    if (el) { el.hidden = true; el.textContent = ''; }
  }

  function renderFilterChips(product) {
    const wrap = $('compare-filters');
    if (!wrap) return;
    wrap.textContent = '';
    const enabled = window.__compareSettingsSites || ALL_SITES;
    ALL_SITES
      .filter((site) => enabled.includes(site) && site !== product?.site)
      .forEach((site) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'filter-chip' + (state.searchSites.has(site) ? ' active' : '');
        chip.textContent = MP()[site]?.name || site;
        chip.dataset.site = site;
        chip.addEventListener('click', () => {
          if (state.searchSites.has(site)) {
            if (state.searchSites.size <= 1) {
              window.RMF_toast?.(S()?.compare?.noSitesSelected || 'Select at least one marketplace.', true);
              return;
            }
            state.searchSites.delete(site);
          } else {
            state.searchSites.add(site);
          }
          chip.classList.toggle('active');
        });
        wrap.appendChild(chip);
      });
  }

  function renderDisplayFilters() {
    const wrap = $('compare-display-filters');
    if (!wrap || !state.data?.matches?.length) { if (wrap) wrap.hidden = true; return; }
    wrap.hidden = false;
    wrap.textContent = '';
    const sites = [...new Set(state.data.matches.map((m) => m.site))];
    sites.forEach((site) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'filter-chip' + (state.filterSites.has(site) ? ' active' : '');
      chip.textContent = MP()[site]?.name || site;
      chip.addEventListener('click', () => {
        if (state.filterSites.has(site)) state.filterSites.delete(site);
        else state.filterSites.add(site);
        chip.classList.toggle('active');
        renderResults();
      });
      wrap.appendChild(chip);
    });
  }

  function sortedMatches() {
    if (!state.data?.matches) return [];
    let list = state.data.matches.filter((m) => state.filterSites.has(m.site) && m.best);
    if (state.sort === 'price-asc') {
      list = [...list].sort((a, b) => parsePriceNum(a.best.price) - parsePriceNum(b.best.price));
    } else if (state.sort === 'price-desc') {
      list = [...list].sort((a, b) => parsePriceNum(b.best.price) - parsePriceNum(a.best.price));
    } else {
      list = [...list].sort((a, b) => (b.best?.match?.score || 0) - (a.best?.match?.score || 0));
    }
    return list;
  }

  function badgeForMatch(match, s) {
    const label = match?.label || 'possible';
    if (label === 'same') return { cls: 'same', text: s ? s.compare.sameProduct : 'Same product' };
    if (label === 'similar') return { cls: 'similar', text: s ? s.compare.similarProduct : 'Similar' };
    return { cls: 'possible', text: s ? s.compare.possibleMatch : 'Possible' };
  }

  function renderResults() {
    const s = S();
    const resultsEl = $('compare-results');
    const emptyEl = $('compare-empty');
    const matches = sortedMatches();

    resultsEl.textContent = '';
    if (!matches.length) {
      resultsEl.hidden = true;
      if (emptyEl && state.data) {
        emptyEl.hidden = false;
        emptyEl.textContent = s?.compare?.noMatches || 'No matches for selected filters.';
      }
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    resultsEl.hidden = false;

    for (const entry of matches) {
      const best = entry.best;
      const mp = MP()[entry.site] || {};
      const badge = badgeForMatch(best.match, s);
      const score = best.match?.score || 0;

      const card = document.createElement('article');
      card.className = 'result-card';

      const thumb = document.createElement('div');
      thumb.className = 'result-thumb';
      if (best.image) {
        const img = document.createElement('img');
        img.src = best.image;
        img.alt = '';
        img.loading = 'lazy';
        thumb.appendChild(img);
      } else {
        thumb.classList.add('no-img');
        thumb.textContent = (mp.name || '?')[0];
      }

      const body = document.createElement('div');
      body.className = 'result-body';

      const head = document.createElement('div');
      head.className = 'result-head';
      const site = document.createElement('span');
      site.className = 'result-site';
      site.textContent = mp.name || entry.site;
      const scoreBadge = document.createElement('span');
      scoreBadge.className = `match-badge ${badge.cls}`;
      scoreBadge.textContent = s ? s.compare.matchScore(score) : `${score}%`;
      scoreBadge.title = badge.text;
      head.append(site, scoreBadge);

      const title = document.createElement('div');
      title.className = 'result-title';
      title.textContent = best.title;

      const price = document.createElement('div');
      price.className = 'result-price';
      price.textContent = s ? s.compare.price(best.price) : (best.price || '—');

      const view = document.createElement('a');
      view.className = 'result-view';
      view.href = best.url;
      view.target = '_blank';
      view.rel = 'noopener noreferrer';
      view.textContent = s ? s.compare.viewOn(mp.name || entry.site) : `View on ${entry.site}`;

      body.append(head, title, price, view);
      card.append(thumb, body);
      resultsEl.appendChild(card);
    }
  }

  function renderManualLinks(product, failedOnly) {
    const manual = $('compare-manual');
    const list = $('compare-list');
    if (!manual || !list) return;
    list.textContent = '';
    if (!failedOnly) { manual.hidden = true; return; }

    const s = S();
    const q = encodeURIComponent(product.title);
    const failedSites = new Set((state.data?.failed || []).map((f) => f.site));
    const sites = failedSites.size
      ? [...failedSites]
      : (window.__compareSettingsSites || ALL_SITES).filter((site) => site !== product.site);

    sites.forEach((site) => {
      const mp = MP()[site];
      if (!mp) return;
      const urlFn = mp.manualUrl || mp.searchUrl;
      list.appendChild(manualLink(s ? s.compare.on(mp.name) : mp.name, urlFn(q)));
    });
    manual.hidden = !list.children.length;
    if (!manual.hidden) manual.open = true;
  }

  function manualLink(text, href) {
    const a = document.createElement('a');
    a.className = 'action-btn';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = text;
    return a;
  }

  function setCompareStatus(el, text, variant) {
    if (!el) return;
    el.className = 'compare-status' + (variant ? ` is-${variant}` : '');
    el.textContent = text || '';
    el.hidden = !text;
  }

  function buildEmptyState(container, title, body) {
    if (!container) return;
    container.hidden = false;
    container.className = 'empty-state';
    container.textContent = '';
    const ico = document.createElement('span');
    ico.className = 'empty-state-ico';
    ico.setAttribute('aria-hidden', 'true');
    ico.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><line x1="16" y1="16" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    if (title) {
      const h = document.createElement('p');
      h.className = 'empty-state-title';
      h.textContent = title;
      container.append(ico, h);
    } else {
      container.appendChild(ico);
    }
    const p = document.createElement('p');
    p.className = 'empty-state-body';
    p.textContent = body || '';
    container.appendChild(p);
  }

  function applySearchResult(r) {
    const s = S();
    state.data = r;
    hideSkeleton();

    const statusEl = $('compare-site-status');
    const noteEl = $('compare-status');
    if (statusEl) {
      statusEl.textContent = siteStatusLine(r.results);
      statusEl.hidden = !r.results?.length;
    }

    const failed = (r.failed || []).length > 0;
    const hasMatches = (r.matches || []).length > 0;

    if (noteEl) {
      let text = '';
      let variant = '';
      if (r.cached) { text = s?.compare?.cached || ''; variant = 'success'; }
      else if (hasMatches && failed) {
        text = s?.compare?.partialResults?.(
          r.failed.map((f) => MP()[f.site]?.name || f.site).join(', '),
        ) || '';
        variant = 'warn';
      } else if (!hasMatches) text = s?.compare?.noMatches || '';
      else if (r.serpFailed) { text = s?.compare?.serpFallback || ''; variant = 'warn'; }
      setCompareStatus(noteEl, text, variant);
    }

    state.filterSites = new Set((r.matches || []).map((m) => m.site));
    renderDisplayFilters();
    const toolbar = $('compare-toolbar');
    if (toolbar) toolbar.hidden = !hasMatches;
    renderResults();
    renderManualLinks(state.product, failed || !hasMatches);
    updateCacheCount();
  }

  async function runSearch(product) {
    if (state.searching) return;
    const s = S();
    const btn = $('compare-search');
    state.searching = true;
    state.product = product;
    btn?.setAttribute('aria-busy', 'true');
    if (btn) btn.disabled = true;

    $('compare-empty') && ($('compare-empty').hidden = true);
    $('compare-manual') && ($('compare-manual').hidden = true);
    const noteEl = $('compare-status');
    if (noteEl) { noteEl.hidden = false; setCompareStatus(noteEl, s?.compare?.searching || 'Searching…', 'loading'); }
    $('compare-site-status') && ($('compare-site-status').hidden = true);
    showSkeleton();

    const sites = [...state.searchSites].filter((site) => site !== product.site);
    if (!sites.length) {
      state.searching = false;
      btn?.setAttribute('aria-busy', 'false');
      if (btn) btn.disabled = false;
      hideSkeleton();
      setCompareStatus(noteEl, s?.compare?.noSitesSelected || 'Select at least one marketplace.', 'warn');
      return;
    }

    const r = await sendCompare({ type: 'RMF_COMPARE_SEARCH', product, sites, cache: false });

    state.searching = false;
    btn?.setAttribute('aria-busy', 'false');
    if (btn) btn.disabled = false;

    if (!r?.ok) {
      hideSkeleton();
      setCompareStatus(noteEl, r?.error || s?.compare?.searchFailed || 'Search failed', 'error');
      renderManualLinks(product, true);
      return;
    }
    applySearchResult(r);
  }

  async function loadCached(product) {
    const r = await send({ type: 'RMF_COMPARE_CACHE', product });
    if (r?.ok && (r.matches?.length || r.results?.length)) {
      state.data = r;
      state.product = product;
      applySearchResult(r);
      return true;
    }
    return false;
  }

  async function render(getProduct) {
    const s = S();
    const p = await getProduct();
    if (p?.title !== state.product?.title || p?.url !== state.product?.url) {
      state.data = null;
    }
    state.product = p;

    const titleEl = $('compare-title');
    const metaEl = $('compare-meta');
    const btn = $('compare-search');
    const note = $('compare-note');
    const emptyEl = $('compare-empty');

    $('compare-results').hidden = true;
    $('compare-skeleton').hidden = true;
    $('compare-display-filters').hidden = true;
    $('compare-site-status').hidden = true;
    $('compare-status').hidden = true;
    $('compare-manual').hidden = true;
    if (emptyEl) emptyEl.hidden = true;

    if (!p?.title) {
      titleEl.textContent = s?.compare?.noProduct || 'Open a product page.';
      titleEl.classList.add('muted');
      if (metaEl) metaEl.hidden = true;
      if (btn) btn.hidden = true;
      if (emptyEl) {
        buildEmptyState(
          emptyEl,
          s?.compare?.noProduct || 'Open a product page',
          p?.isProductPage === false
            ? (s?.compare?.listingPage || s?.compare?.emptyHint || '')
            : (s?.compare?.emptyHint || ''),
        );
      }
      if (note) note.textContent = '';
      return;
    }

    titleEl.textContent = p.title;
    titleEl.classList.remove('muted');
    if (metaEl) {
      metaEl.textContent = '';
      if (p.site) {
        const pill = document.createElement('span');
        pill.className = 'site-pill';
        pill.textContent = p.site;
        metaEl.appendChild(pill);
        metaEl.appendChild(document.createTextNode(' '));
      }
      if (p.brand) {
        metaEl.appendChild(document.createTextNode(p.brand));
        if (p.price) metaEl.appendChild(document.createTextNode(' '));
      }
      if (p.price) metaEl.appendChild(document.createTextNode(p.price));
      metaEl.hidden = !(p.site || p.brand || p.price);
    }
    if (btn) {
      btn.hidden = false;
      btn.disabled = state.searching;
      $('compare-search-label').textContent = s?.compare?.findSimilar || 'Find similar products';
      btn.onclick = () => runSearch(p);
    }
    if (note) note.textContent = s?.compare?.note || '';

    const settingsSites = window.__compareSettingsSites || ALL_SITES;
    state.searchSites = new Set(settingsSites.filter((site) => site !== p.site));
    renderFilterChips(p);
    const filtersEl = $('compare-filters');
    if (filtersEl) filtersEl.hidden = false;
    await updateCacheCount();

    if (!state.searching && !state.data) await loadCached(p);
  }

  function setupSort() {
    const sel = $('compare-sort');
    if (!sel) return;
    sel.addEventListener('change', () => {
      state.sort = sel.value;
      renderResults();
    });
  }

  window.RMF_ComparePanel = { render, runSearch, updateCacheCount, setupSort };
})();
