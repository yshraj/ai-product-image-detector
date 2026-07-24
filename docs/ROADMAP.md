# TrueKart — Roadmap

_Last updated: 2026-07-24_

TrueKart flags AI-generated and fake-looking product photos on shopping sites. The
product is deliberately narrow: a trustworthy detection signal, not a general shopping
assistant. Earlier builds explored broader "shopping assistant" features (cross-marketplace
compare, copy/share tools); those were removed in v1.8.0 to keep the product focused and
easy to trust.

---

## Current state (v1.8.0)

| Area | Status | Notes |
|---|---|---|
| Two-tab popup (Scan / Settings) | ✅ Shipped | Bottom nav, detection-first |
| AI badges + "Why flagged?" popover | ✅ Shipped | HF + on-device preview engines, per-layer breakdown |
| Export JSON/CSV, history, notifications | ✅ Shipped | Local-only |
| Options page (display mode, threshold, marketplaces, data & privacy) | ✅ Shipped | |
| Hugging Face via router endpoint | ✅ Shipped | Live token validation |
| False-positive correction loop ("Mark wrong") | ✅ Shipped | |
| Playwright E2E + Node unit tests, axe-core a11y checks, CI | ✅ Shipped | |
| MIT license, public repo, OSS contribution files | ✅ Shipped | |
| Site selectors | ⚠️ Fragile | Hashed CSS classes drift — re-check periodically |
| On-device ONNX engine | ⚠️ Gated | UI/download pipeline built; disabled pending shipped runtime + hosted weights (see [ONDEVICE.md](ONDEVICE.md)) |
| Chrome Web Store listing | ⬜ Not submitted | See [CHROMEWEBSTORE.md](../CHROMEWEBSTORE.md) |

---

## Near term

- [ ] Chrome Web Store submission (screenshots, demo GIF, privacy review, permission justifications).
- [ ] Publish a public accuracy/methodology page from `research/accuracy-test/`.
- [ ] Re-validate site selectors on live AliExpress / Temu / Shein / Amazon / Myntra / Flipkart / Meesho / Nykaa pages.
- [ ] Finish and ship the on-device ONNX engine as a no-token, fully local detection path.

---

## Later

- [ ] `forced-colors` (Windows High Contrast) support for badges.
- [ ] Light-theme variant for the injected "Why flagged?" popover.
- [ ] i18n — the string module (`utils/strings.js`) is translation-ready; no locales shipped yet.
- [ ] More marketplaces, community-contributed via `content/sites/`.
- [ ] Firefox port (the `web-ext` tooling already supports this).

**Not planned:** TrueKart-hosted backend, accounts, or an inference proxy. Detection stays BYOK (user's own Hugging Face token) or fully on-device.

---

## Positioning

**Wedge:** the only privacy-first, shopping-native, open-source AI-photo detector — most
competitors (Hive, Is It AI?, BitMind) are cloud-upload, general-purpose, on-demand tools
with no marketplace awareness.

---

## Open decisions

1. **Default HF model:** keep the current two-model ensemble or evaluate alternatives once accuracy is benchmarked and published.
2. **On-device engine:** finish and ship (flagship no-token privacy path) vs. keep gated indefinitely — see [ONDEVICE.md](ONDEVICE.md).

---

## Sources

See [research/competitor-analysis.md](../research/competitor-analysis.md) and
[research/feature-plan.md](../research/feature-plan.md) for background research.
