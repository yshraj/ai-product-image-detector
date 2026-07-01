# End-to-End Test & Feature Plan — ShopShield

Comprehensive plan for user workflows, regression coverage, and compare-search improvements.

**Last updated:** 2026-06-30 · **Version:** 1.7.0

---

## Goals

1. Every major extension surface has automated regression coverage.
2. Compare search is **color-aware**, **parallel**, and **silent by default** (no background tabs unless opted in).
3. A new developer can trace any user journey from install → daily use → settings → restart.

---

## Coverage matrix

| Area | Scenarios | Test file(s) | Status |
|------|-----------|--------------|--------|
| **Installation & loading** | SW registers, manifest version, permissions granted, defaults on install, popup/options load without JS errors | `installation.spec.cjs` | ✅ |
| **Popup UI** | 4-tab nav, scan stats, HF connect, onboarding dismiss, confidence slider | `popup.spec.cjs`, `shopping-assistant.spec.cjs` | ✅ |
| **Options page** | Detection prefs, history, clear cache, import/export | `options.spec.cjs`, `history.spec.cjs` | ✅ |
| **Service worker** | HF validate, remote detect, SSRF guard, compare search, badge, toggle | `messaging.spec.cjs`, `compare.spec.cjs` | ✅ |
| **Content scripts** | Scan, badges, popover, product extraction, rescan | `badge.spec.cjs`, `product.spec.cjs`, `messaging.spec.cjs` | ✅ |
| **Chrome storage** | sync read/write, local cache, clear cache, survives profile restart | `storage-persistence.spec.cjs` | ✅ |
| **Message passing** | GET_STATS, GET_PRODUCT, GET_PAGE_REPORT, RESCAN, SET_ENABLED, RMF_* | `messaging.spec.cjs` | ✅ |
| **Permissions** | Declared perms + host patterns | `permissions.spec.cjs`, `installation.spec.cjs` | ✅ |
| **Context menus** | Image check injects badge; handler registered | `context-menu.spec.cjs` | ✅ |
| **Keyboard shortcuts** | Alt+Shift+R toggles enabled; syncs with popup | `keyboard-shortcut.spec.cjs` | ✅ |
| **Browser action** | Badge count, clears on disable | `keyboard-shortcut.spec.cjs`, `badge.spec.cjs` | ✅ |
| **User workflows** | Scan → details → HF → history → clear | `workflow.spec.cjs` | ✅ |
| **Compare** | SerpApi mock, filter chips, marketplace toggles, color in query | `compare.spec.cjs`, `shopping-assistant.spec.cjs`, `regression.spec.cjs` | ✅ |
| **Tools** | Lens/Bing links, copy actions | `shopping-assistant.spec.cjs`, `regression.spec.cjs` | ✅ |
| **Error / edge cases** | Unsupported tab, listing vs product, SSRF, HF errors, compare timeout | `huggingface-error.spec.cjs`, `regression.spec.cjs`, `docs/EDGE-CASES.md` | ✅ |
| **State after restart** | local storage persists across browser relaunch | `storage-persistence.spec.cjs` | ✅ |
| **Accessibility** | axe on popup + options | `a11y.spec.cjs` | ✅ |
| **Regression suite** | Cross-cutting journeys + tab isolation + compare cache | `regression.spec.cjs` | ✅ |

---

## User journeys (manual + automated)

### Journey 1 — First install

```
chrome://extensions → Load unpacked → pin icon
→ visit Myntra category → badges appear
→ open popup Scan tab → stats visible
```

**Automated:** `installation.spec.cjs`, `badge.spec.cjs`, `workflow.spec.cjs`

### Journey 2 — Accurate AI detection

```
popup Settings → paste HF Read token → Connect
→ rescan page → badges use HF (not preview)
```

**Automated:** `huggingface.spec.cjs`, `workflow.spec.cjs`

### Journey 3 — Price compare

```
open product page → popup Compare → auto-detect product
→ Search → results ranked by match score (color-aware)
→ filter by marketplace chip
```

**Automated:** `shopping-assistant.spec.cjs`, `compare.spec.cjs`, `regression.spec.cjs`

### Journey 4 — Tools & share

```
product page → Tools → Google Lens / copy details / share
```

**Automated:** `shopping-assistant.spec.cjs`, `regression.spec.cjs`

### Journey 5 — Power user settings

```
options page → adjust threshold → disable site → export settings
→ restart browser → settings persist
```

**Automated:** `options.spec.cjs`, `preferences.spec.cjs`, `storage-persistence.spec.cjs`

### Journey 6 — Context menu anywhere

```
right-click image → "Check this image with ShopShield"
→ badge overlay on page
```

**Automated:** `context-menu.spec.cjs`

### Journey 7 — Keyboard toggle

```
Alt+Shift+R → scanning off → badge clears
→ Alt+Shift+R → scanning on
```

**Automated:** `keyboard-shortcut.spec.cjs`

---

## Compare improvements (v1.7.1)

| Improvement | Implementation | Rationale |
|-------------|----------------|-----------|
| **Color-aware query** | `extractColorFromProduct()` in `product-query.js` | Same variant across sites |
| **Color match scoring** | `colorMatch()` in `product-matcher.js` | Prefer matching color in results |
| **Parallel site search** | `mapConcurrent()` in `compare/search.js` (concurrency 3) | Faster compare |
| **Silent search default** | Fetch-first; background tabs only when `compareUseTabs: true` | No tab-bar flash |
| **Product color field** | `getProduct()` returns `color` | Popup/compare use structured data |

---

## Running the full suite

```bash
npm ci
npx playwright install --with-deps chromium   # first time

npm run validate        # manifest + syntax + version
npm run test:unit       # unit tests (compare, matcher, color, SSRF, …)
npm test                # all Playwright E2E (~90 specs)
```

### CI

`.github/workflows/ci.yml` runs validate → unit → e2e on every push/PR.

---

## Gaps & future work

| Item | Priority | Notes |
|------|----------|-------|
| `npm run build` in CI | Low | Store zip validation |
| Real `chrome.commands` in E2E | Low | Playwright can't fire MV3 shortcuts; covered via `RMF_TOGGLE_ENABLED` |
| Lens API integration | Low | No public API; link-only is correct |
| Amazon content script | Medium | Compare-only today |
| Visual regression screenshots | Low | `npm run test:qa-screenshots` |

---

## Related docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — module map
- [EDGE-CASES.md](EDGE-CASES.md) — failure handling
- [test/e2e/README.md](../test/e2e/README.md) — Playwright setup
