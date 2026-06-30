# ShopShield UX Improvements — v1.7.0

## Analysis summary

| Area | Before | After |
|------|--------|-------|
| Onboarding | Single wall-of-text overlay blocking all clicks | 3-step walkthrough with Skip, dots, Escape to dismiss; backdrop non-blocking |
| Navigation | No scan activity indicator | AI count badge on Scan tab (red/amber by severity) |
| Compare | Title only | Brand, price, site pill under title |
| Empty states | Plain text hints | Icon + instructional copy |
| Tools | Plain drop zone | Icon, aria-label, keyboard focusable |
| Settings | Notifications buried in options page | Notify toggle in popup Settings |
| Seller trust | Percent text only | Visual progress bars |
| Accessibility | Tab panels not focusable | Panel focus on tab switch, scroll reset |
| Visual | Light only | `prefers-color-scheme: dark` support |
| Link buttons | Inconsistent styling | Unified `.link-btn` with focus ring |

## Screenshots

- **Before:** `qa-screenshots/before/`
- **After:** `qa-screenshots/after/`

Regenerate: `npm run test:qa-screenshots`

## Tests

- Playwright: 78/78 passed
- Unit: 32/32 passed
