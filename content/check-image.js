// content/check-image.js — injected on context-menu "Check this image" (any page).
(async function () {
  const src = window.__rmf_check_image_url;
  if (!src || typeof window.RMF_Detect !== 'function') return;

  const existing = document.querySelector('.rmf-ctx-badge');
  if (existing) existing.remove();

  const img = [...document.images].find((i) => (i.currentSrc || i.src) === src) || null;
  const anchor = img || document.body;

  const result = await window.RMF_Detect(src);
  const wrap = document.createElement('div');
  wrap.className = 'rmf-ctx-badge';
  wrap.setAttribute('role', 'status');
  const high = result.confidence >= 90;
  const flagged = result.isAI && result.confidence >= 70;
  wrap.textContent = flagged
    ? `${high ? '🤖 AI Generated' : '⚠️ Likely AI'} · ${Math.round(result.confidence)}%`
    : `✓ Normal · ${Math.round(result.confidence)}%`;
  wrap.style.cssText = [
    'position:fixed', 'z-index:2147483647', 'padding:10px 14px', 'border-radius:10px',
    'font:600 13px -apple-system,sans-serif', 'box-shadow:0 4px 20px rgba(0,0,0,.25)',
    flagged ? (high ? 'background:#E24B4A;color:#fff' : 'background:#EF9F27;color:#2a1800') : 'background:#16a34a;color:#fff',
    'top:16px', 'right:16px', 'max-width:280px',
  ].join(';');

  document.body.appendChild(wrap);
  if (img) {
    const r = img.getBoundingClientRect();
    wrap.style.top = `${Math.max(8, r.top)}px`;
    wrap.style.left = `${Math.max(8, r.left)}px`;
    wrap.style.right = 'auto';
  }
  setTimeout(() => wrap.remove(), 6000);
})();
