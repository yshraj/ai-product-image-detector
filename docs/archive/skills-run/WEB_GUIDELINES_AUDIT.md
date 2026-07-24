# Web Design Guidelines Audit — TrueKart Popup

Date: 2026-07-02  
Scope: `popup/popup.html`, `popup/popup.css`, `popup/popup.js`

## Fixed

| Issue | Location | Fix |
|-------|----------|-----|
| Color contrast (WCAG AA) | `.brand-accent` on white topbar | `#059669` → `#047857` (4.5:1+) |
| Motion sensitivity | `popup.css` | `@media (prefers-reduced-motion: reduce)` disables progress animation |
| Dark mode | `popup.css` | `color-scheme: light dark` + dark token overrides |
| Touch targets | nav buttons, toggles | min-height 44px on interactive controls |

## Verified OK

- Semantic landmarks (`header`, `main`, `nav`)
- Tab pattern with `role="tablist"` / `aria-selected`
- Scan progress uses `role="progressbar"` + `aria-live="polite"`
- Skip link to `#main`

## Deferred (non-blocking)

- Options page uses separate stylesheet — audit separately if unified design system is desired
- Compare dead code in repo — not in shipped manifest
