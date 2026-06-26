# RealModel Filter — Roadmap, Launch Plan & Competitor Research

_Last updated: 2026-06-26_

This doc answers three questions: **what's broken**, **who we compete with**, and **what we ship next** — with a concrete launch plan focused on making the API-based detection actually work and reliable for users.

---

## TL;DR — the most important thing

> **Our Hugging Face detection is broken because we call a dead endpoint.**

The code in [background/service-worker.js](../background/service-worker.js) calls:

```
https://api-inference.huggingface.co/models/<model>
```

Hugging Face **retired this endpoint**. It now returns:

> `https://api-inference.huggingface.co is no longer supported. Please use https://router.huggingface.co/hf-inference instead.`

So no matter what token a user pastes, **the HF path silently fails and we fall back to the preview heuristic** (which we openly admit is inaccurate). This explains "some features are not working" and "it doesn't detect properly."

**Fix (small, high priority):**

1. Change the endpoint to:
   ```
   https://router.huggingface.co/hf-inference/models/<model>
   ```
2. Add `https://router.huggingface.co/*` to `host_permissions` in [manifest.json](../manifest.json) (we currently only allow the dead `api-inference` host).
3. Re-test the 503 cold-start retry loop — the warm-up behaviour still applies on the new router.

Everything below assumes we land this fix **first** — there is no point launching while the headline feature is dead.

---

## 1. Honest state of the product

| Area | Status | Notes |
|---|---|---|
| Manifest V3, content scripts, overlays | ✅ Works | Solid foundation, no build step |
| Site selectors (Myntra/Flipkart/Meesho/Nykaa) | ⚠️ Fragile | Hashed CSS classes drift; need re-checking before launch |
| EXIF "real" signal | ✅ Works | Decisive but rarely present on CDN images (metadata stripped) |
| On-device heuristic | ⚠️ Preview only | Honestly labelled, but not a real detector |
| **Hugging Face engine** | ❌ **Broken** | Dead endpoint (see TL;DR) |
| AI or Not engine | ⚠️ Unverified | Needs a live key test; verify response shape still matches |
| Popup UI | ⚠️ Functional, not "SaaS" | See §4 |

**Bottom line:** the architecture is good, but the one accurate detection path is offline. That's the launch blocker.

---

## 2. Competitor research (2026)

The market splits into **general-purpose AI image detectors** (our nearest rivals) and **e-commerce trust tooling** (our actual positioning lane).

### General AI-image detectors

| Tool | Accuracy (indep. 2026) | Form factor | Free tier | Notes |
|---|---|---|---|---|
| **Hive Moderation** | ~94% (best overall) | API + Chrome ext | Limited | Can name *which* generator (MJ/DALL·E/SD). The benchmark to beat. |
| **TruthScan** | ≥97% across categories | Web + API | No | Strongest on fraud/deepfake imagery |
| **Illuminarty** | ~91% | Web | Yes (best free) | Region **heatmap** showing *why* flagged — great UX idea to borrow |
| **Google SynthID** | ~91% | Built into Chrome + Search (I/O 2026) | Free | **Strategic threat** — right-click any image to check. Only detects Google-watermarked AI though. |
| **Sightengine** | Enterprise | API | Trial | 120+ moderation categories; $29/mo Starter |
| **Hugging Face (sdxl-detector)** | Lower, but free | API/Space | **Free** | This is *our* engine — friction-free, no paywall |

### E-commerce-focused

- **Rewarx** — purpose-built for e-commerce; flags synthetic submissions in seller photo pipelines. Closest to our *domain*, but it's seller-side/B2B, not a shopper's browser extension.

### Where we actually fit (our wedge)

Nobody owns **"AI-image transparency for the Indian online shopper, in-page, on the marketplaces they already use."**

- Hive/TruthScan/Sightengine = developer APIs or generic checkers; you paste an image in.
- SynthID = only catches Google-watermarked images, and is generic.
- Rewarx = sells to sellers, not buyers.

**Our differentiation:**
1. **Zero-friction, in-context** — badge appears right on the Myntra/Flipkart/Meesho/Nykaa grid while you shop. No copy-paste.
2. **India-first** — the exact marketplaces local shoppers use.
3. **Free to start** — bring-your-own free HF token; no subscription wall.
4. **Trust angle, not moderation** — we help *buyers* judge whether a product photo is a real garment on a real model vs. an AI render.

---

## 3. The API / onboarding strategy (the core of this launch)

The user-facing promise should be: **"Get a free key in 60 seconds, then see AI badges as you shop."** Detection accuracy lives or dies on the API path, so we make that path bulletproof and frictionless.

### Recommended provider tiers

| Tier | Provider | Cost to user | Why |
|---|---|---|---|
| **Default / recommended** | **Hugging Face Inference** (`Organika/sdxl-detector`) | **Free** token, hundreds of req/hour | No paywall, no card. Best friction-to-accuracy ratio. **Once the endpoint is fixed, this is the launch engine.** |
| Upgrade | HF **PRO** ($9/mo) | Cheap | Higher rate limits for power users |
| Alternative | **AI or Not** API | Small free tier, then paid | Already wired; good accuracy. Verify it still works. |
| Premium (future) | **Hive Moderation** API | Paid | Best accuracy + names the generator. Add as "Pro engine" later. |
| Fallback | On-device heuristic | Free | Keep, but always labelled **Preview** |

### Models to offer in the HF dropdown (all free)

- `Organika/sdxl-detector` — default; good on modern diffusion + non-art images
- `Smogy/SMOGY-Ai-images-detector` — fine-tune of the above on Reddit/Kaggle real+AI data; worth A/B testing as default
- `umm-maybe/AI-image-detector` — older baseline; keep as option

### "Get your free key here" onboarding (make this excellent)

The popup should literally walk the user through it (we already have the copy — make it shine):

1. Create free account → <https://huggingface.co/join>
2. New token (role **Read**) → <https://huggingface.co/settings/tokens>
3. Paste `hf_…`, press **Connect**
4. First scan warms the model (~20s, HF returns 503 + ETA; we auto-retry)

**Onboarding improvements to build:**
- **Validate the token on Connect** — make a tiny test call and show ✅/❌ immediately, instead of failing silently later. (Right now we only regex-check it starts with `hf_`.)
- **Surface real errors** — if HF returns 401/503/rate-limit, show it in the popup ("Token invalid", "Model warming up — retry in 20s", "Rate limit hit"). Today these die in `console.warn`.
- **Rate-limit awareness** — cache aggressively (we already cache per-URL ✅) and optionally cap scans/minute so a free token lasts.
- **Don't claim "Accurate" until a real verdict comes back** — the status pill should reflect a *verified* connection, not just a saved token.

> Note on "predefined / shared API keys": **do not ship a hard-coded shared key.** It would be scraped from the extension bundle within hours, instantly rate-limited/banned, and could violate provider ToS. The right pattern is **bring-your-own free key** with great onboarding (above). If we ever want a true zero-key experience, the correct way is a **thin proxy backend** we host (keeps the key server-side, lets us rate-limit per user) — that's a post-launch infra project, noted in §6.

---

## 4. UI: make it actually look like SaaS

Current popup is functional but reads as a "settings dialog," not a product. Concrete upgrades:

**Visual system**
- Define design tokens: a real color palette (one brand accent + neutral grays), 4/8px spacing scale, consistent radius, one type scale. Put them as CSS variables in `popup/popup.css`.
- Replace flat sections with **cards** that have subtle elevation/borders.
- Add the brand mark + product name in a proper header bar.

**Status hero (top of popup)**
- Big, confident status card: engine name, a **live "Connected ✓ / Preview ⚠"** pill, and the active model.
- Show **session stats** as stat tiles: _Scanned · AI-flagged · Cached_ (we already collect these — present them as a dashboard, not text).

**Onboarding flow**
- Turn the HF setup into a clean **stepper** (1→2→3) with a primary CTA button, not a `<details>` accordion.
- Inline validation states (loading spinner on Connect → success check).

**Polish**
- Empty states ("No images scanned yet — visit a product page").
- Toasts already exist ✅ — restyle to match the new system.
- Consistent iconography (engine icons, status icons).

This is a styling + small-markup pass on `popup/popup.html` + `popup/popup.css` — no architecture change.

---

## 5. Launch plan — milestones

### 🔴 Milestone 0 — "Make it work" (launch blocker, days)
- [ ] Fix HF endpoint → `router.huggingface.co/hf-inference/models/<model>`
- [ ] Update `host_permissions` (+ remove dead `api-inference` host)
- [ ] Verify AI or Not path with a live key (confirm response shape)
- [ ] Re-validate the 4 site selectors against current live pages
- [ ] Surface API errors in the popup (no more silent fallback)

### 🟠 Milestone 1 — "Trustworthy onboarding" (1–2 weeks)
- [ ] Token validation on Connect (test call + ✅/❌)
- [ ] HF onboarding stepper UI
- [ ] Rate-limit handling + user-friendly messages
- [ ] A/B the default model (`Organika` vs `Smogy`)

### 🟡 Milestone 2 — "Looks like SaaS" (1–2 weeks, parallel)
- [ ] Design-token refactor of popup CSS
- [ ] Status hero + stat tiles dashboard
- [ ] Empty/loading/error states

### 🟢 Milestone 3 — "Differentiators" (post-launch)
- [ ] **Confidence heatmap** on flagged images (à la Illuminarty) — strong, visible "why"
- [ ] "Which generator?" labelling (needs Hive-class engine)
- [ ] More marketplaces (Ajio, Amazon.in, Tata Cliq)
- [ ] Optional hosted proxy for a true zero-key free tier (§3)
- [ ] Chrome Web Store listing assets (screenshots, demo GIF, privacy policy)

---

## 6. Open decisions for the team

1. **Default engine at launch:** HF free (recommended) vs. AI or Not. → _Recommend HF free, once fixed._
2. **Zero-key experience:** ship bring-your-own-key only, or invest in a hosted proxy later? → _BYO key for launch; proxy is a Milestone-3 infra bet._
3. **Default HF model:** `Organika/sdxl-detector` vs `Smogy/...` → _A/B test before deciding._
4. **Store launch scope:** soft launch (unpacked / friends) vs. full Chrome Web Store submission with privacy review.

---

## Sources

- [AI Image Detection Tools Comparison — Rewarx](https://www.rewarx.com/blogs/ai-generated-image-detection-tools-comparison)
- [Best AI Image Detectors in 2026 — ddiy.co](https://ddiy.co/ai-image-detection-tools/)
- [5 Best Tools to Detect AI-Generated Images in 2026 — usefulai](https://usefulai.com/tools/ai-image-detectors)
- [Best AI Image Detectors 2026 — Fastio](https://fast.io/resources/ai-image-detector-tools-2026/)
- [Organika/sdxl-detector — Hugging Face](https://huggingface.co/Organika/sdxl-detector)
- [Smogy/SMOGY-Ai-images-detector — Hugging Face](https://huggingface.co/Smogy/SMOGY-Ai-images-detector)
- [umm-maybe/AI-image-detector — Hugging Face](https://huggingface.co/umm-maybe/AI-image-detector)
- [Hugging Face Inference Free Tier Limits & Pricing 2026](https://klymentiev.com/blog/huggingface-inference-api)
- [HF Inference Providers docs](https://huggingface.co/docs/inference-providers/index)
- [HF Forum: api-inference no longer supported → use router.huggingface.co](https://discuss.huggingface.co/t/error-https-api-inference-huggingface-co-is-no-longer-supported-please-use-https-router-huggingface-co-hf-inference-instead/169870)
