# Project Brief — TrueKart (premium-saas-design)

## What We're Building

Chrome extension for Indian e-commerce shoppers. Core job: **flag AI-generated product photos** on Myntra, Flipkart, Meesho, Nykaa.

## Primary Audience

- Online shoppers in India who want real product photos before buying
- Power users who browse category/listing pages with many products

## Goals

1. **Trust** — make it obvious which image was flagged and why
2. **Speed** — scan progress visible; popup loads in <1s
3. **Clarity** — minimal popup UI; no jargon

## Non-goals (v1.8)

- Cross-marketplace price comparison (removed from UI)
- Broken “Similar products” until quality is fixed or feature removed

## Brand

- **Mark:** Product frame + verify badge (photo trust)
- **Colors:** Ink `#0C1222`, emerald `#059669`
- **Voice:** Direct, second person, no hype

## Requirements

- 360×540 popup, keyboard accessible
- `prefers-reduced-motion` respected
- Works offline for scan; compare needs network
