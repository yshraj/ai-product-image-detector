# Extension Architecture Review (chrome-extension-development)

## Summary

TrueKart MV3 layout is **correct** for a scan-first extension.

## Strengths

- Content script per marketplace (`content/sites/`)
- Service worker handles HF API (CORS bypass)
- Tab-scoped messaging (`GET_STATS`, `RESCAN`) avoids wrong-tab stats
- Offscreen document for CLIP (compare only)

## Risks

| Risk | Mitigation |
|------|------------|
| Compare bundle size (~11MB zip) | Remove compare + offscreen + CLIP if feature dropped |
| Nykaa 403 → hidden tabs | Acceptable; document in README |
| Popup 360×540 scroll | OK for 3 tabs; consider 2 tabs if compare removed |

## Quick wins

1. Remove unused compare scripts from manifest if compare tab removed
2. Lazy-load `compare-panel.js` only when compare tab selected (future)
3. Keep `npm run validate` in CI before publish
