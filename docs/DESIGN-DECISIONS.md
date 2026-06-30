# Design Decisions — ShopShield

This document records **why** the extension is built the way it is. For structure and file locations, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Vanilla JavaScript, no build step

**Decision:** Ship source files directly; no Webpack, Vite, or TypeScript compile step.

**Why:**
- Chrome loads the repo folder as-is in developer mode — zero setup for contributors.
- MV3 extensions are sensitive to bundler misconfiguration (service worker scope, `importScripts` paths).
- The codebase is ~50 shipped JS files; a bundler would add complexity without meaningful size wins (zip is ~110 KB).

**Trade-off:** No static type checking. JSDoc typedefs in `utils/defaults.js` and key modules provide partial documentation. `node --check` validates syntax via `npm run validate`.

---

## Shopping assistant first, AI detection as one feature

**Decision:** Popup has four tabs (Scan, Compare, Tools, Settings), not a single AI-focused panel.

**Why:** Users on Indian marketplaces benefit from compare and copy utilities even without connecting Hugging Face. Positioning as a "shopping assistant" keeps the extension useful on day one with heuristic preview mode.

---

## Hugging Face runs in the service worker, not the content script

**Decision:** All HF API calls go through `background/service-worker.js`.

**Why:**
1. **CORS** — content scripts cannot attach `Authorization: Bearer hf_…` to cross-origin requests the way a worker with `host_permissions` can.
2. **Secret handling** — token lives in `chrome.storage.sync`; worker reads it without exposing to page DOM.
3. **Centralized health tracking** — popup shows engine status via `RMF_ENGINE_HEALTH`.

Content script calls `RMF_RemoteDetect` → message → worker → `router.huggingface.co`.

---

## API-first detection with conservative preview fallback

**Decision:** When HF is connected, its verdict is **authoritative**. When not connected, a lightweight canvas heuristic runs locally, tagged `preview: true`.

**Why:**
- HF models are far more accurate than heuristics; falling through to preview after an HF error would show misleading badges.
- On HF failure, pipeline returns **inconclusive** (no badge) with a 60-second cache backoff — see `detection/pipeline.js`.
- Preview requires ≥75% confidence before flagging (`PREVIEW_FLAG`) to limit false positives.

**Removed:** Third-party "AI or Not" API (v1.2.0) — added cost and latency without clear benefit over HF free tier.

---

## EXIF as a decisive "real" signal only

**Decision:** EXIF can prove a photo is **real** (camera metadata present) but does not alone flag AI.

**Why:** AI images often lack EXIF; absence is inconclusive. Presence of `Make`/`Model`/`DateTime` is strong evidence of a real camera capture — skip expensive analysis.

---

## Image fetch through worker with SSRF guard

**Decision:** Content scripts request image bytes via `RMF_FETCH_IMAGE`; worker validates URL with `isAllowedHttpUrl`.

**Why:**
- Marketplace CDNs block direct canvas reads from content scripts (CORS/tainted canvas).
- Worker must not fetch `localhost`, private IPs, or non-http schemes — prevents abuse if a malicious page triggers fetches.

Unit tests: `test/unit/service-worker.test.cjs`.

---

## Compare search in the service worker

**Decision:** Cross-marketplace compare runs in the worker via `importScripts('compare/…')`.

**Why:**
- Compare needs `fetch()` to marketplace search URLs — blocked from extension pages and unreliable from content scripts.
- Sequential per-site search avoids bursting rate limits; SerpApi optional for reliability.

Popup only renders results; it never scrapes HTML directly.

---

## Active-tab-only popup messaging

**Decision:** Tab-specific actions (`GET_STATS`, `RESCAN`, `GET_PRODUCT`, …) target the **currently active tab** only.

**Why:** Prevents scan stats or product data from leaking between marketplace tabs when the user switches quickly.

---

## UMD dual-export modules

**Decision:** Shared utils export both `window.RMF_*` and `module.exports`.

**Why:** Same source runs in the browser and in Node unit tests without a test bundler. Compare and defaults modules use this pattern consistently.

---

## `chrome.storage.sync` for settings, `local` for cache/history

**Decision:** User preferences sync across Chrome profile devices; caches and history stay local.

**Why:**
- Sync has quota limits (~100 KB); detection cache can reach thousands of entries.
- HF token in sync is acceptable — it's user-owned and profile-scoped, not sent to any ShopShield server.

---

## Concurrency and cost controls

| Mechanism | Value | Rationale |
|-----------|-------|-----------|
| Detection throttle | 3 concurrent | Avoid HF rate limits and main-thread jank |
| Cache TTL | 7 days | Same product image URL rarely changes |
| Viewport gating | IntersectionObserver | Don't scan off-screen infinite-scroll cards |
| Badge debounce | 300 ms | Batch toolbar updates during grid scan |
| Compare timeout | 120 s (popup) | User feedback if search hangs |
| Image load timeout | 12 s (content) | Free detection slots on broken images |

---

## Debug logging gated behind `RMF_DEBUG`

**Decision:** `utils/logger.js` only emits `info`/`warn`/`debug` when `localStorage.RMF_DEBUG = '1'` on a marketplace page. `error` always logs.

**Why:** Production users should not see console noise. Developers opt in per-tab.

---

## No telemetry or backend

**Decision:** Zero analytics, accounts, or ShopShield-hosted API.

**Why:** Privacy positioning and Chrome Web Store trust. Outbound network: Hugging Face (optional), marketplace CDNs, SerpApi (optional user key), compare search pages.

---

## Site-specific selectors in separate files

**Decision:** Each marketplace has `content/sites/<name>.js` defining `window.RMF_SITE`.

**Why:** DOM structures differ radically; isolating selectors makes breakage obvious and fixes localized. `content.js` stays marketplace-agnostic.

---

## Playwright E2E with real extension loading

**Decision:** E2E tests use Chromium with `--load-extension`, not mocked Chrome APIs.

**Why:** Catches real MV3 issues (service worker lifecycle, messaging, permissions) that unit tests miss. Marketplace HTML served from fixtures — no live network dependency.

---

## Validation instead of ESLint

**Decision:** `npm run lint` runs `scripts/validate.js`, not ESLint.

**Why:** Vanilla JS without a bundler; ESLint setup cost outweighs benefit for this repo size. Validate checks manifest integrity, file references, syntax, version sync, and `debugger` statements in shipped code.

---

## Historical naming (`RMF_` prefix)

**Decision:** Keep `RMF_` prefixes on globals and message types.

**Why:** Renaming would touch every file and break stored cache keys (`rmf_cache_*`, `rmf_history`). Product rebranded to ShopShield; internal prefixes remain for stability.
