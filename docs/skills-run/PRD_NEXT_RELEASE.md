# PRD — TrueKart v1.8

## Problem

Users don't trust listing photos. Extension scans pages and flags likely-AI images, but UX and secondary features (compare, logo) hurt credibility.

## Success metrics

- Popup open → first scan stat visible in <2s on supported PDP
- User can identify flagged image without confusion (qualitative)
- Chrome Web Store rating ≥4.2 (post UI refresh)

## Scope — In

1. **Brand:** Photo + verify icon (shipped in `icons/`)
2. **Popup:** Emerald/ink tokens, reduced motion, a11y pass
3. **Scan tab:** Progress bar, max 5 recent scans
4. **Decision:** Remove Similar products tab OR hide behind flag until RICE P0 compare work completes

## Scope — Out

- Price comparison across sites
- Backend / accounts / sync
- Mobile app

## User stories

| ID | Story | Acceptance |
|----|-------|------------|
| S1 | As a shopper I see which photo is AI | Flagged image has visible border; badge on that image |
| S2 | As a shopper I know scan progress | Animated bar + count while scanning |
| S3 | As a shopper I trust the extension brand | Icon readable at 16px; popup looks professional |

## Open questions

- Remove compare entirely vs fix matching?
- Publish under new name only (drop “Price Compare” from store listing)?

## Rollout

1. Internal test on Flipkart + Myntra PDPs
2. `npm run validate && npm test`
3. Bump to 1.8.0, update store screenshots with new icon
