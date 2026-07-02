# Production Audit — July 2026

Summary of production-grade improvements applied to TrueKart v1.7.0.

## Security

| Change | File(s) | Benefit |
|--------|---------|---------|
| Reject untrusted message senders | `background/service-worker.js` | Blocks cross-extension message abuse |
| Cap `RMF_DETECT_DATA` payload size (12 MiB) | `background/service-worker.js` | Prevents memory DoS from oversized data URLs |
| Unit tests for sender + payload guards | `test/unit/service-worker-security.test.cjs` | Regression coverage |

Existing SSRF guard on image fetch unchanged.

## Refactoring

| Change | File(s) | Benefit |
|--------|---------|---------|
| Trust writes via `utils/trust-storage.js` | `content/content.js`, `manifest.json` | Single implementation for seller/price history |
| Shared `isSupportedMarketplaceUrl` | `utils/marketplace-url.js`, `popup/popup.js` | No drift between popup and content URL logic |
| Remove dead SPA product watcher | `content/content.js` | Fewer observers, no `history` monkey-patching; `GET_PRODUCT` still reads live DOM |

## Performance

- Removed redundant `MutationObserver` + `pushState` wrapper on product pages (compare listener was unused).

## Testing

| Added | Coverage |
|-------|----------|
| `test/unit/cache.test.cjs` | Cache get/set/TTL/key isolation |
| `test/unit/service-worker-security.test.cjs` | Sender validation, payload cap |
| `test/unit/marketplace-url.test.cjs` | `isSupportedMarketplaceUrl` |

**Results:** validate PASS · unit 103/103 · affected E2E 19/19

## Documentation

- `README.md` — 2-tab popup, accurate product description
- `docs/ARCHITECTURE.md` — shipped vs dev-only compare, updated message protocol

## Remaining technical debt

1. **`compare/` split-brain** — Code + tests exist but not shipped; decide archive vs re-wire
2. **`content/content.js` god module** (~900 lines) — candidate for scan/overlay/product extraction split
3. **`detection/pipeline.js`** — no direct unit tests yet (highest-risk user path)
4. **Amazon host permissions** — only needed if compare returns
5. **Legacy `RMF_` prefix** — rename is cosmetic; keep for storage key compatibility
6. **`popup/compare-panel.js` + compare CSS** — orphaned but kept for optional re-enable

## Recommended future work

- Unit-test detection pipeline with mocked `chrome.runtime`
- E2E for options import/export round-trip
- Trim manifest host permissions after compare decision
- Split `content/content.js` into load-order modules (no bundler)
