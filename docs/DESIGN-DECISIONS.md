# Design Decisions — TrueKart

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

## Focused two-tab popup: Scan and Settings

**Decision:** The popup has two tabs (Scan, Settings), not a broader "shopping assistant" panel.

**Why:** Earlier builds explored a four-tab layout (Scan / Compare / Tools / Settings). Compare (cross-marketplace search handoffs) and Tools (copy/share utilities) added surface area without strengthening the core pitch — a trustworthy AI/fake-photo signal — so they were removed in v1.8.0. A narrower product is easier to explain, easier to review for the Chrome Web Store, and easier for contributors to reason about.

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

**Coverage:** blocks loopback/private/link-local/multicast IPv4 and IPv6 (including `fc00::/7` unique-local, `fe80::/10` link-local, and IPv4-mapped `::ffff:a.b.c.d`) and `localhost`. Alternate IPv4 encodings (decimal, octal, hex, short-form) don't need explicit handling — the WHATWG `URL` parser already canonicalizes them to dotted-quad before the guard sees them. **Known limitation:** this is a hostname-string check, not a resolved-IP check, so DNS rebinding (a public hostname whose record points at a private address) isn't caught — there's no extension API to pin the resolved IP before `fetch()`. See [SECURITY.md](../SECURITY.md).

Unit tests: `test/unit/service-worker.test.cjs`.

---

## Active-tab-only popup messaging

**Decision:** Tab-specific actions (`GET_STATS`, `RESCAN`, `GET_PRODUCT`, …) target the **currently active tab** only.

**Why:** Prevents scan stats or product data from leaking between marketplace tabs when the user switches quickly.

---

## UMD dual-export modules

**Decision:** Shared utils export both `window.RMF_*` and `module.exports`.

**Why:** Same source runs in the browser and in Node unit tests without a test bundler. `defaults.js`, `report.js`, `model-store.js`, and other shared/worker-facing modules use this pattern consistently.

---

## `chrome.storage.sync` for settings, `local` for cache/history

**Decision:** User preferences sync across Chrome profile devices; caches and history stay local.

**Why:**
- Sync has quota limits (~100 KB); detection cache can reach thousands of entries.
- HF token in sync is acceptable — it's user-owned and profile-scoped, not sent to any TrueKart server.

---

## Concurrency and cost controls

| Mechanism | Value | Rationale |
|-----------|-------|-----------|
| Detection throttle | 3 concurrent | Avoid HF rate limits and main-thread jank |
| Cache TTL | 7 days | Same product image URL rarely changes |
| Viewport gating | IntersectionObserver | Don't scan off-screen infinite-scroll cards |
| Badge debounce | 300 ms | Batch toolbar updates during grid scan |
| Image load timeout | 12 s (content) | Free detection slots on broken images |

---

## Debug logging gated behind `RMF_DEBUG`

**Decision:** `utils/logger.js` only emits `info`/`warn`/`debug` when `localStorage.RMF_DEBUG = '1'` on a marketplace page. `error` always logs.

**Why:** Production users should not see console noise. Developers opt in per-tab.

---

## No telemetry or backend

**Decision:** Zero analytics, accounts, TrueKart-hosted API, or subscription infrastructure. Extension-only product.

**Why:** Privacy positioning and Chrome Web Store trust. Users should not depend on us staying online.

**Network (all user-initiated, direct from browser):**

| Destination | When | Required? |
|-------------|------|-----------|
| Marketplace pages/CDNs | Image fetch for scanning | Yes (core feature) |
| Hugging Face | AI detect (BYOK token) or on-device model download | No — preview heuristic works offline |

**BYOK:** `hfToken` is an optional user-provided credential stored in the extension (not sent to TrueKart).

**Explicitly out of scope:** hosted inference proxy, accounts, billing, entitlement API, telemetry pipeline.

---

## Site-specific selectors in separate files

**Decision:** Each marketplace has `content/sites/<name>.js` defining `window.RMF_SITE`.

**Why:** DOM structures differ radically; isolating selectors makes breakage obvious and fixes localized. `content.js` stays marketplace-agnostic.

---

## Playwright E2E with real extension loading

**Decision:** E2E tests use Chromium with `--load-extension`, not mocked Chrome APIs.

**Why:** Catches real MV3 issues (service worker lifecycle, messaging, permissions) that unit tests miss. Marketplace HTML served from fixtures — no live network dependency.

---

## ESLint plus a custom validator

**Decision:** `npm run lint` runs both ESLint (`eslint.config.mjs`) and a project-specific `scripts/validate.js`.

**Why:** ESLint catches general JS correctness/style issues; `validate.js` checks things ESLint doesn't know about — manifest integrity, file references, `package.json`/`manifest.json` version sync, and `debugger` statements in shipped code. No bundler is involved in either step.

---

## Historical naming (`RMF_` prefix)

**Decision:** Keep `RMF_` prefixes on globals and message types.

**Why:** Renaming would touch every file and break stored cache keys (`rmf_cache_*`, `rmf_history`). Product rebranded to TrueKart; internal prefixes remain for stability.
