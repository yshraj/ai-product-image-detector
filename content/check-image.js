// content/check-image.js — injected on context-menu "Check this image" (any page).
(async function () {
  const src = window.__rmf_check_image_url;
  if (!src) return;

  const showBadge = (text, flagged, high) => {
    const existing = document.querySelector('.rmf-ctx-badge');
    if (existing) existing.remove();
    const wrap = document.createElement('div');
    wrap.className = 'rmf-ctx-badge';
    wrap.setAttribute('role', 'status');
    wrap.textContent = text;
    wrap.style.cssText = [
      'position:fixed', 'z-index:2147483647', 'padding:10px 14px', 'border-radius:10px',
      'font:600 13px -apple-system,sans-serif', 'box-shadow:0 4px 20px rgba(0,0,0,.25)',
      flagged ? (high ? 'background:#E24B4A;color:#fff' : 'background:#EF9F27;color:#2a1800') : 'background:#16a34a;color:#fff',
      'top:16px', 'right:16px', 'max-width:280px',
    ].join(';');
    document.body.appendChild(wrap);
    const img = [...document.images].find((i) => (i.currentSrc || i.src) === src) || null;
    if (img) {
      const r = img.getBoundingClientRect();
      wrap.style.top = `${Math.max(8, r.top)}px`;
      wrap.style.left = `${Math.max(8, r.left)}px`;
      wrap.style.right = 'auto';
    }
    setTimeout(() => wrap.remove(), 6000);
  };

  if (typeof window.RMF_Detect !== 'function') {
    showBadge('TrueKart could not load on this page', false, false);
    return;
  }

  try {
    const result = await window.RMF_Detect(src);
    const high = result.confidence >= 90;
    const flagged = result.isAI && result.confidence >= 70;
    const text = flagged
      ? `${high ? '🤖 AI Generated' : '⚠️ Likely AI'} · ${Math.round(result.confidence)}%`
      : `✓ Normal · ${Math.round(result.confidence)}%`;
    showBadge(text, flagged, high);
  } catch {
    showBadge('Image check failed — try again', false, false);
  }
})();
