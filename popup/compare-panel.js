// popup/compare-panel.js — Compare tab UI (results, skeleton, filters, sort).
// Sends RMF_COMPARE_SEARCH to the service worker, which runs compare/search.js.
(function () {
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
    resultsFingerprint: '',
    stale: false,
    compareVisible: false,
  };

  const $ = (id) => document.getElementById(id);
  const S = () => window.RMF_STRINGS;
  const MP = () => window.RMF_CompareConfig?.MARKETPLACES || {};

  function productFp(product) {
    if (!product) return '';
    if (product.fingerprint) return product.fingerprint;
    return window.RMF_ProductFingerprint?.productFingerprint?.(product) || '';
  }

  function clearCompareUI() {
    state.data = null;
    const resultsEl = $('compare-results');
    if (resultsEl) {
      resultsEl.textContent = '';
      resultsEl.hidden = true;
      resultsEl.classList.remove('is-stale');
    }
    $('compare-skeleton') && ($('compare-skeleton').hidden = true);
    $('compare-toolbar') && ($('compare-toolbar').hidden = true);
    $('compare-display-filters') && ($('compare-display-filters').hidden = true);
    $('compare-site-status') && ($('compare-site-status').hidden = true);
    $('compare-empty') && ($('compare-empty').hidden = true);
    $('compare-manual') && ($('compare-manual').hidden = true);
    const staleEl = $('compare-stale-badge');
    if (staleEl) staleEl.hidden = true;
  }

  function showStaleBadge() {
    let el = $('compare-stale-badge');
    if (!el) {
      el = document.createElement('p');
      el.id = 'compare-stale-badge';
      el.className = 'compare-stale-badge';
      el.setAttribute('role', 'status');
      $('compare-actions')?.insertAdjacentElement('afterend', el);
    }
    el.textContent = S()?.compare?.staleResults || 'Product changed — refresh to update';
    el.hidden = false;
    $('compare-results')?.classList.add('is-stale');
  }

  function siteStatusLine(results, ranked) {
    if (!results?.length) return '';
    const rankedSites = new Set((ranked || []).map((r) => r.site));
    const errLabel = (err) => {
      if (!err) return '';
      if (/timeout/i.test(err)) return 'timeout';
      if (/HTTP/i.test(err)) return 'unreachable';
      return 'failed';
    };
    return results.map((r) => {
      const name = MP()[r.site]?.name || r.site;
      if (!r.ok) return `${name} ✗${errLabel(r.error) ? ` (${errLabel(r.error)})` : ''}`;
      if (rankedSites.has(r.site)) return `${name} ✓`;
      if (r.candidates?.length) return `${name} ○`;
      return `${name} ○`;
    }).join(' · ');
  }

  function showSearchingStatus(sites) {
    const statusEl = $('compare-site-status');
    const s = S();
    if (!statusEl || !sites?.length) return;
    statusEl.hidden = false;
    statusEl.textContent = sites.map((site) => {
      const name = MP()[site]?.name || site;
      return s?.compare?.searchingSite ? s.compare.searchingSite(name) : `${name} …`;
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
    const ranked = state.data?.ranked || [];
    if (!wrap || !ranked.length) { if (wrap) wrap.hidden = true; return; }
    wrap.hidden = false;
    wrap.textContent = '';
    const sites = [...new Set(ranked.map((m) => m.site))];
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

  function sortedRanked() {
    const ranked = state.data?.ranked || [];
    let list = ranked.filter((m) => state.filterSites.has(m.site));
    if (state.sort === 'price-asc') {
      list = [...list].sort((a, b) => parsePriceNum(a.price) - parsePriceNum(b.price));
    } else if (state.sort === 'price-desc') {
      list = [...list].sort((a, b) => parsePriceNum(b.price) - parsePriceNum(a.price));
    } else {
      list = [...list].sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0));
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
    const matches = sortedRanked();

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

    for (const item of matches) {
      const mp = MP()[item.site] || {};
      const badge = badgeForMatch(item.match, s);
      const score = item.match?.score || 0;

      const card = document.createElement('article');
      card.className = 'result-card';

      const thumb = document.createElement('div');
      thumb.className = 'result-thumb';
      if (item.image) {
        const img = document.createElement('img');
        img.src = item.image;
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
      site.textContent = mp.name || item.site;
      const scoreBadge = document.createElement('span');
      scoreBadge.className = `match-badge ${badge.cls}`;
      scoreBadge.textContent = s ? s.compare.matchScore(score) : `${score}%`;
      scoreBadge.title = badge.text;
      head.append(site, scoreBadge);

      const title = document.createElement('div');
      title.className = 'result-title';
      title.textContent = item.title;

      const price = document.createElement('div');
      price.className = 'result-price';
      price.textContent = s ? s.compare.price(item.price) : (item.price || '—');

      const view = document.createElement('a');
      view.className = 'result-view';
      view.href = item.url;
      view.target = '_blank';
      view.rel = 'noopener noreferrer';
      view.textContent = s ? s.compare.viewOn(mp.name || item.site) : `View on ${item.site}`;

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
    state.stale = false;
    state.resultsFingerprint = productFp(state.product);
    hideSkeleton();

    const staleEl = $('compare-stale-badge');
    if (staleEl) staleEl.hidden = true;
    $('compare-results')?.classList.remove('is-stale');

    const statusEl = $('compare-site-status');
    const noteEl = $('compare-status');
    if (statusEl) {
      statusEl.textContent = siteStatusLine(r.results, r.ranked);
      statusEl.hidden = !r.results?.length;
    }

    const failed = (r.failed || []).length > 0;
    const hasMatches = (r.ranked || r.matches || []).length > 0;
    const hasCandidates = (r.results || []).some((x) => x.candidates?.length);

    if (noteEl) {
      let text = '';
      let variant = '';
      if (hasMatches && failed) {
        text = s?.compare?.partialResults?.(
          r.failed.map((f) => MP()[f.site]?.name || f.site).join(', '),
        ) || '';
        variant = 'warn';
      } else if (!hasMatches && hasCandidates) {
        text = s?.compare?.weakMatches || '';
        variant = 'warn';
      } else if (!hasMatches) text = s?.compare?.noMatches || '';
      else if (r.serpFailed) { text = s?.compare?.serpFallback || ''; variant = 'warn'; }
      setCompareStatus(noteEl, text, variant);
    }

    state.filterSites = new Set((r.ranked || r.matches || []).map((m) => m.site));
    renderDisplayFilters();
    const toolbar = $('compare-toolbar');
    if (toolbar) toolbar.hidden = !hasMatches;
    renderResults();
    renderManualLinks(state.product, failed || (!hasMatches && hasCandidates));
  }

  async function runSearch(product) {
    if (state.searching) return;
    const s = S();
    const btn = $('compare-search');
    const refreshBtn = $('compare-refresh');

    clearCompareUI();
    state.stale = false;
    state.searching = true;
    state.product = product;
    btn?.setAttribute('aria-busy', 'true');
    if (btn) btn.disabled = true;
    if (refreshBtn) refreshBtn.disabled = true;

    $('compare-empty') && ($('compare-empty').hidden = true);
    $('compare-manual') && ($('compare-manual').hidden = true);
    const noteEl = $('compare-status');
    if (noteEl) {
      noteEl.hidden = false;
      setCompareStatus(noteEl, s?.compare?.searching || 'Searching…', 'loading');
    }
    $('compare-site-status') && ($('compare-site-status').hidden = true);
    showSkeleton();

    const sites = [...state.searchSites].filter((site) => site !== product.site);
    if (!sites.length) {
      state.searching = false;
      btn?.setAttribute('aria-busy', 'false');
      if (btn) btn.disabled = false;
      if (refreshBtn) refreshBtn.disabled = false;
      hideSkeleton();
      setCompareStatus(noteEl, s?.compare?.noSitesSelected || 'Select at least one marketplace.', 'warn');
      return;
    }

    showSearchingStatus(sites);

    const { serpApiKey = '' } = await chrome.storage.sync.get({ serpApiKey: '' });

    try {
      const r = await sendCompare({
        type: 'RMF_COMPARE_SEARCH',
        product,
        sites,
        serpApiKey,
      });

      if (!r?.ok) {
        hideSkeleton();
        setCompareStatus(noteEl, r?.error || s?.compare?.searchFailed || 'Search failed', 'error');
        renderManualLinks(product, true);
        return;
      }
      applySearchResult(r);
    } catch (err) {
      hideSkeleton();
      setCompareStatus(noteEl, String(err?.message || err) || s?.compare?.searchFailed || 'Search failed', 'error');
      renderManualLinks(product, true);
    } finally {
      state.searching = false;
      btn?.setAttribute('aria-busy', 'false');
      if (btn) btn.disabled = false;
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  function bindCompareActions(product) {
    const btn = $('compare-search');
    const refreshBtn = $('compare-refresh');
    if (btn) btn.onclick = () => runSearch(product);
    if (refreshBtn) refreshBtn.onclick = () => runSearch(product);
  }

  function updateProductHeader(p, s) {
    const titleEl = $('compare-title');
    const metaEl = $('compare-meta');
    const actions = $('compare-actions');
    const btn = $('compare-search');
    const refreshBtn = $('compare-refresh');
    const note = $('compare-note');

    if (!p?.title) {
      titleEl.textContent = s?.compare?.noProduct || 'Open a product page.';
      titleEl.classList.add('muted');
      if (metaEl) metaEl.hidden = true;
      if (actions) actions.hidden = true;
      if (btn) btn.hidden = true;
      if (refreshBtn) refreshBtn.hidden = true;
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
    if (actions) actions.hidden = false;
    if (btn) {
      btn.hidden = false;
      btn.disabled = state.searching;
      $('compare-search-label').textContent = s?.compare?.findSimilar || 'Find similar products';
    }
    if (refreshBtn) {
      refreshBtn.hidden = false;
      refreshBtn.disabled = state.searching;
      refreshBtn.textContent = s?.compare?.refresh || '🔄 Refresh';
    }
    if (note) note.textContent = s?.compare?.note || '';
  }

  async function handleProductChange(product) {
    if (!product) return;
    const fp = productFp(product);
    if (fp && fp === state.resultsFingerprint && state.data && !state.stale) return;

    state.product = product;
    updateProductHeader(product, S());
    bindCompareActions(product);

    if (state.searching) return;

    if (state.compareVisible) {
      await runSearch(product);
      return;
    }

    clearCompareUI();
    state.stale = true;
    state.resultsFingerprint = '';
  }

  function onCompareTabHidden() {
    state.compareVisible = false;
  }

  async function render(getProduct) {
    const s = S();
    state.compareVisible = true;
    const p = await getProduct();
    const fp = productFp(p);
    const productChanged = fp && state.resultsFingerprint && fp !== state.resultsFingerprint;

    if (productChanged) {
      clearCompareUI();
      state.stale = true;
    } else if (fp && state.product && productFp(state.product) !== fp) {
      clearCompareUI();
      state.stale = true;
    }

    state.product = p;

    const emptyEl = $('compare-empty');
    $('compare-status').hidden = true;

    if (!p?.title) {
      clearCompareUI();
      if (emptyEl) {
        buildEmptyState(
          emptyEl,
          s?.compare?.noProduct || 'Open a product page',
          p?.isProductPage === false
            ? (s?.compare?.listingPage || s?.compare?.emptyHint || '')
            : (s?.compare?.emptyHint || ''),
        );
      }
      updateProductHeader(p, s);
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    updateProductHeader(p, s);
    bindCompareActions(p);

    const settingsSites = window.__compareSettingsSites || ALL_SITES;
    state.searchSites = new Set(settingsSites.filter((site) => site !== p.site));
    renderFilterChips(p);
    const filtersEl = $('compare-filters');
    if (filtersEl) filtersEl.hidden = false;

    if (state.searching) return;

    if (state.stale || productChanged) {
      await runSearch(p);
      return;
    }

    if (!state.data) {
      await runSearch(p);
      return;
    }

    const dataFp = state.resultsFingerprint || productFp(state.product);
    if (dataFp && fp && dataFp === fp) {
      applySearchResult(state.data);
    } else {
      await runSearch(p);
    }
  }

  function setupSort() {
    const sel = $('compare-sort');
    if (!sel) return;
    sel.addEventListener('change', () => {
      state.sort = sel.value;
      renderResults();
    });
  }

  window.RMF_ComparePanel = {
    render,
    runSearch,
    setupSort,
    handleProductChange,
    onCompareTabHidden,
    productFp,
  };
})();
