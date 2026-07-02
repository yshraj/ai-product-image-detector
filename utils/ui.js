// utils/ui.js — shared UI primitives for the popup and options pages.
// Attaches to window.RMF_UI. Not loaded into content scripts.
(function (root) {
  // Transient status message. Locates #toast-host in the current page so the
  // same implementation works for both the popup and the options page.
  function toast(msg, isErr, isOk) {
    const host = document.getElementById('toast-host');
    if (!host) return;
    const t = document.createElement('div');
    t.className = 'toast' + (isErr ? ' err' : isOk ? ' ok' : '');
    t.textContent = msg;
    t.setAttribute('role', isErr ? 'alert' : 'status');
    host.appendChild(t);
    const dismiss = () => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 220);
    };
    setTimeout(dismiss, isErr ? 3200 : 2400);
  }

  // Roving-tabindex keyboard navigation for a segmented ".seg" button group.
  // `kind` picks the ARIA state attribute: 'tab' → aria-selected, 'radio' →
  // aria-checked. `onSelect(value)` fires on click or keyboard selection, where
  // value is the button's data-provider/data-mode.
  function rovingGroup(group, { kind = 'tab', onSelect } = {}) {
    if (!group) return;
    const btns = Array.from(group.querySelectorAll('.seg'));
    const ariaAttr = kind === 'tab' ? 'aria-selected' : 'aria-checked';
    const valueOf = (b) => b.dataset.provider || b.dataset.mode;
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        btns.forEach((b) => {
          const on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute(ariaAttr, String(on));
          b.tabIndex = on ? 0 : -1;
        });
        onSelect?.(valueOf(btn));
      });
      btn.addEventListener('keydown', (e) => {
        const i = btns.indexOf(btn);
        let j = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % btns.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + btns.length) % btns.length;
        if (j === null) return;
        e.preventDefault();
        btns[j].focus();
        btns[j].click();
      });
    });
  }

  root.RMF_UI = { toast, rovingGroup };
})(typeof self !== 'undefined' ? self : this);
