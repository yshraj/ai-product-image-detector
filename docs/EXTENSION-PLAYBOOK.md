# TrueKart Extension-First Playbook

_Last updated: 2026-07-02_

**Product decision:** TrueKart stays **100% client-side**. No TrueKart backend, no accounts, no billing, no hosted proxies. Optional **BYOK** (bring your own key) for Hugging Face and SerpApi is fine — users connect directly from the extension.

This doc replaces the earlier SaaS playbook. Phases 3–5 (backend, Clerk, Stripe) are **out of scope**.

---

## Architecture invariants

| Rule | Meaning |
|------|---------|
| **No TrueKart server** | We never operate API, auth, or inference infrastructure |
| **Core works offline** | Preview heuristic + cached results need no network |
| **BYOK optional** | HF token / SerpApi key stored in extension; user → third party only |
| **Direct third-party calls** | Browser talks to HF, marketplaces, SerpApi — never through us |
| **No required API keys** | Free tier = on-device preview; HF/Serp are power-user upgrades |

### What runs where

```
User's Chrome
├── content scripts     → scan, badges, product extract (marketplace pages)
├── service worker      → HF detect (BYOK), compare scrape, image fetch
├── offscreen document  → CLIP ONNX (downloaded once from HF, then on-device)
├── popup / options     → UI, settings, export
└── chrome.storage      → prefs (sync), cache/history/secrets (prefer local for keys)
```

### Optional BYOK flows (user-initiated)

| Feature | Default (no key) | With BYOK |
|---------|------------------|-----------|
| AI scan | Preview heuristic (on-device) | Hugging Face inference (user token → HF) |
| Compare search | Direct marketplace scrape / hidden tabs | + SerpApi (user key → serpapi.com) |
| Image match | Text similarity only | + CLIP (model from HF CDN, runs locally) |

---

## Monetization without backend

If you ever charge, keep it **extension-only**:

- **Chrome Web Store** one-time purchase or IAP (no server)
- **Tip / donate** link in options (no entitlement checks)
- **No freemium gates** that require a server to verify subscription

Do **not** add: Clerk, Stripe webhooks, entitlement API, hosted HF proxy.

---

## Skills still useful (extension path)

| Skill | Use for |
|-------|---------|
| `extension-analyze` | Security & CWS audits |
| `chrome-extension-development` | MV3 patterns, permissions |
| `chrome-extensions` | Official Chrome guidance |
| `extension-ui` | Popup/options UX |
| `extension-test` | E2E strategy |
| `accessibility-a11y` | WCAG before CWS |
| `chrome-webstore-release-blueprint` | Store submission |
| `ai-product-strategy` | Positioning (not SaaS tiers) |

**Skip:** `saas-scaffolder`, `clerk-chrome-extension-patterns`, `clerk-billing`

---

## Security hardening (extension-only)

### Done

- [x] Redirect SSRF guard in `fetchImage`
- [x] `isSafeCompareUrl` for compare result links/images
- [x] Compare **Beta** badge

### Recommended (no backend required)

- [ ] Move `hfToken` / `serpApiKey` from `chrome.storage.sync` → `chrome.storage.local` (device-only secrets)
- [ ] Message sender validation in service worker
- [ ] Cap `RMF_DETECT_DATA` payload size
- [ ] Harden offscreen `RMF_CLIP` listener
- [ ] Validate HF model slug format
- [ ] Service worker reads SerpApi key from storage only (ignore `msg.serpApiKey`)

---

## Launch positioning

**Ship as:** “Real photo checker for Indian fashion e-commerce” (Myntra, Flipkart, Meesho, Nykaa).

**Hold back:** Leading with price compare until golden-set pass rate ≥70%.

**Privacy line:** “No account. No TrueKart server. Scans stay on your device unless you optionally connect Hugging Face.”

---

## CWS checklist (unchanged)

| Blocker | Action |
|---------|--------|
| 11 MB zip | Lazy-download ONNX/CLIP; target <5 MB |
| Compare quality | Golden PDP sprint; keep Beta label |
| Screenshots + GIF | Scan tab, badges, settings |
| Permission justification | `tabs`, `offscreen`, `scripting` for compare |

---

## Prompt sequence (extension-only)

1. `/extension-analyze` — Audit before each release
2. `/ai-product-strategy` — Refine shopping-assistant positioning
3. `/chrome-extension-development` — MV3 / permission review
4. `/extension-ui` — Popup polish, onboarding, BYOK UX
5. `/review-security` — Pre-release security pass
6. `/extension-test` — Extend E2E for new flows
7. `/accessibility-a11y` — A11y fixes
8. `/chrome-webstore-release-blueprint` — Store submit

---

## Related docs

- [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md) — No telemetry or backend
- [ARCHITECTURE.md](ARCHITECTURE.md) — Module map
- [PRIVACY.md](PRIVACY.md) — User-facing privacy copy
- [ROADMAP.md](ROADMAP.md) — Feature roadmap (no hosted proxy)
