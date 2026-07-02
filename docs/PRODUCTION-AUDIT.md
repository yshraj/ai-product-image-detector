# Production Audit — TrueKart v1.7.0

Final release-readiness audit completed **2026-06-30**.

## Verdict: **READY FOR RELEASE** (Compare production pass 2026-07-01)

All automated checks pass. Compare pipeline hardened: cross-platform `ranked` scoring, brand inference, SerpApi path, MV3 module load order, and UI error recovery.

---

## Checklist

### Build & validation

| Check | Status | Notes |
|-------|--------|-------|
| `npm run validate` | ✅ PASS | Manifest parse, file refs, JS syntax, version sync, no `debugger` |
| `npm run test:unit` | ✅ 89/89 | Compare ranking, matcher brand inference, SW import order guard |
| `npm test` (Playwright) | ✅ 93+ | Extension, compare-hardening, shopping-assistant, regression |
| `npm run build` (web-ext) | ✅ | Produces `dist/truekart_ai_photo_check_price_compare-1.7.0.zip` |
| `npm run lint:firefox` (web-ext lint) | ⚠️ N/A | Chrome MV3 target; Firefox lint expects Gecko manifest |
| TypeScript errors | ✅ N/A | Project is JavaScript; no `tsc` |
| ESLint errors | ✅ N/A | No ESLint config; validate + tests substitute |
| package.json ↔ manifest version | ✅ | Both `1.7.0` |

### Manifest & permissions

| Check | Status | Notes |
|-------|--------|-------|
| Manifest V3 | ✅ | Service worker background |
| CSP `script-src 'self'` | ✅ | No remote scripts in extension pages |
| Permissions minimal | ✅ | `activeTab`, `storage`, `scripting`, `tabs`, `notifications`, `contextMenus` |
| Host permissions scoped | ✅ | 4 marketplaces + CDNs + HF + SerpApi + Amazon compare |
| Content scripts scoped | ✅ | 4 Indian marketplaces only, `document_idle` |
| Icons 16/48/128 | ✅ | Present in `icons/` |
| Options UI | ✅ | `options/options.html` |

### Security

| Check | Status | Notes |
|-------|--------|-------|
| SSRF guard (`isAllowedHttpUrl`) | ✅ | Blocks loopback, private IPs, non-http |
| Image fetch via service worker | ✅ | Content scripts never fetch arbitrary URLs with auth |
| HF token local only | ✅ | Never in export/import |
| XSS in popup | ✅ | `textContent` / DOM APIs (compare meta, seller list, scan history) |
| No `eval` / remote code | ✅ | All scripts bundled locally |
| Corrections/history local only | ✅ | `chrome.storage.local` |

### Production hygiene (this audit)

| Check | Status | Notes |
|-------|--------|-------|
| Console noise removed | ✅ | Install/update logs removed from SW |
| Debug logging gated | ✅ | `RMF_Log` info/warn/debug require `localStorage.RMF_DEBUG=1` |
| SerpApi fallback silent | ✅ | No `console.warn` on expected fallback |
| Context menu errors | ✅ | User-facing badge only, no console spam |
| Critical errors retained | ✅ | Compare module load failure still `console.error` |
| `debugger` statements | ✅ | None in shipped JS |
| Package excludes dev files | ✅ | `web-ext-config.cjs` ignores test, docs, qa-screenshots, research |

### Bundle / size

| Asset | Size (approx) | Notes |
|-------|---------------|-------|
| `libs/exifr.min.js` | ~45 KB | Vendored EXIF parser, lite UMD build |
| `libs/transformers.min.js` | ~880 KB | Transformers.js runtime for CLIP embeddings |
| `libs/onnx/*.wasm` | ~37 MB | ONNX Runtime WASM (CLIP image similarity) — bundle driver |
| `detection/tfjs-detector.js` | ~5 KB | Heuristic canvas analysis, not full TF.js |
| Packaged zip (web-ext) | **~11 MB** | `dist/truekart_ai_photo_check_price_compare-1.7.0.zip` — dominated by ONNX WASM; lazy-load planned (ROADMAP) to trim before public launch |
| No npm runtime deps | ✅ | DevDeps only: Playwright, web-ext, axe |

### Dependencies

| Package | Role | Production? |
|---------|------|-------------|
| `@playwright/test` | E2E | Dev only |
| `@axe-core/playwright` | A11y tests | Dev only |
| `web-ext` | Lint/build/run | Dev only |

No unused npm dependencies identified.

### Code & assets

| Item | Status | Notes |
|------|--------|-------|
| Dead `MARKETPLACES` fallback in popup | ✅ Removed (prior refactor) |
| Shared utils (`defaults`, `price`, `marketplace-url`) | ✅ Used |
| `research/`, `qa-screenshots/` | Excluded from zip | Dev/QA artifacts |
| `dist/*.zip` old builds | Gitignored | Clean locally before publish |
| All manifest-referenced files exist | ✅ | 23 files |

### Performance

| Area | Status | Notes |
|------|--------|-------|
| Detection throttle (3 concurrent) | ✅ | `utils/throttle.js` |
| Cache 7-day TTL + soft cap 3000 | ✅ | `utils/cache.js` |
| Viewport gating | ✅ | Off-screen cards deferred |
| Image load timeout 12s | ✅ | Prevents slot leak |
| Compare search timeout 120s | ✅ | Client-side in popup |
| Badge updates debounced 300ms | ✅ | `content/content.js` |
| MV3 SW compare sequential sites | ⚠️ | By design; SerpApi reduces load |

### Documentation

| Doc | Purpose |
|-----|---------|
| `README.md` | Install, develop, test, build, release |
| `docs/ARCHITECTURE.md` | Module map, message protocol, storage |
| `docs/DESIGN-DECISIONS.md` | Rationale for major technical choices |
| `CHANGELOG.md` | Version history |
| `docs/PRIVACY.md` / `docs/TERMS.md` | In-app legal |
| `docs/QA-REPORT.md` | v1.6 QA |
| `docs/EDGE-CASES.md` | Failure handling |
| `docs/PRODUCTION-AUDIT.md` | This file |

### CI (`.github/workflows/ci.yml`)

| Step | Status |
|------|--------|
| `npm ci` | ✅ |
| `npm run validate` | ✅ |
| `npm run test:unit` | ✅ |
| `npm test` (CI=true) | ✅ |

**Recommendation:** Add `npm run build` to CI before store submission (optional; not blocking).

---

## Known limitations (documented, not blockers)

1. **Context-menu image check** — the right-click "Check this image" verdict needs Hugging Face connected in the worker; the on-device preview heuristic is not wired into that path.
2. **Amazon** — Compare host permission only; no content script on amazon.in.
3. **SerpApi** — Optional; user-provided key for reliable cross-site compare.
4. **No Chrome Web Store listing assets** in repo (promo copy). ⚠️ The `qa-screenshots/` are stale — they show the pre-rebrand **ShopShield** name, the old indigo theme, and a removed 4-tab layout. Capture fresh screenshots of the current teal, 3-tab TrueKart build before publishing.

---

## Pre-publish commands

```bash
npm ci
npm run validate
npm run test:unit
npm test
npm run build          # → dist/truekart_ai_photo_check_price_compare-1.7.0.zip (~11 MB)
# npm run lint:firefox  # optional; Chrome-only — Firefox lint not applicable
```

Upload the zip from `dist/` to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) or distribute unpacked for enterprise.

---

*Audit performed after refactor, edge-case hardening, and UI polish passes.*
