# Competitor Analysis — Shopping Browser Extensions

_Researched: 2026-06-29. Sources: Chrome Web Store, Trustpilot, independent reviews, Wikipedia, CRXaminer._

> **Context:** RealModel Filter is **not** a coupon/cashback/price tool. This analysis is to
> learn what shoppers *love* and *hate* about leading shopping extensions, then find
> high-value, backend-free wins that fit our niche: **AI-image authenticity / trust**.

---

## 1. PayPal Honey — _Automated Coupons & Rewards_

- **CWS:** ⭐ 4.6 · ~179.7K ratings · ~13M users (down from ~20M).
- **Core features:** auto-apply coupon codes at checkout, cashback "Gold" rewards, price-drop
  email alerts ("Droplist"), seller comparison.
- **Permissions:** `cookies`, `webRequest`, broad host access (all sites), `storage`, `tabs` —
  effectively full browsing surveillance capability.
- **Users LOVE:** one-click automatic savings; recognizable brand; "set and forget."
- **Users COMPLAIN:**
  - **Affiliate-link hijacking scandal** (Dec 2024, MegaLag): re-attributed affiliate sales
    ("cookie stuffing"), even with no discount; suppressed better creator codes. Lost ~8M users
    by end of 2025; class actions followed.
  - Declining coupon quality / fewer working codes over time.
  - PayPal login bugs; broken Droplist.
  - **Intrusive UI** that blocks the page's exit buttons.
  - Privacy: data aggregated across PayPal/Venmo/Fastlane for ad targeting.
- **Gaps users want:** trustworthy/transparent behavior, privacy, non-intrusive UI.

## 2. Capital One Shopping

- **CWS:** ⭐ ~4.x (high on CWS, **low on Trustpilot**) · millions of users.
- **Core features:** auto-coupon, **price comparison** across retailers, price-drop/watchlist,
  rewards as **gift-card-only** credits.
- **Permissions:** broad (shopping-site access, pricing, code injection), similar to Honey.
- **Users LOVE:** large "targeted offers"; easy/passive.
- **Users COMPLAIN:**
  - Unreliable reward tracking; **missing/delayed credits** (30–90 days).
  - **"No persistent visual indicator that tracking remains active"** — the confirmation banner
    vanishes; users can't tell if it's working.
  - Bait-and-switch: shows product images that are excluded from cashback in fine print.
  - Gift-card-only redemption; slow support.
- **Gaps users want:** a clear, persistent **status indicator**; reliability transparency.

## 3. Rakuten _(formerly Ebates)_ — Cash Back Button

- **CWS:** ⭐ ~4.x · 3M+ users · 45K+ reviews.
- **Core features:** cashback portal + browser "button" that lights up on partner sites,
  auto-activates cashback, tests coupons, shows a **cashback estimate in the corner**.
- **Users LOVE:** reliable quarterly payouts (20+ yrs); **non-intrusive** corner popup;
  shows expected savings *before* purchase; **explicitly does not sell browsing data**.
- **Users COMPLAIN:** quarterly payout wait (up to 3 months); tracking misses on mobile / with
  ad blockers; can nudge overspending; not all stores covered.
- **Gaps users want:** faster/real-time value; broader coverage.

## 4. Coupert — _Automatic Coupon Finder & Cashback_

- **CWS:** ⭐ 4.7 · ~11.1K ratings · Trustpilot 4.7 (15K) · 8M+ users.
- **Core features:** auto-test/apply coupons, cashback (direct payouts), price history +
  price-drop alerts, 200K+ stores.
- **Permissions:** shopping-site data access, code application, purchase-event tracking
  (collects anonymized behavioral data).
- **Users LOVE:** **higher coupon success rate** than rivals; broad coverage; easy UI;
  direct (not gift-card) payouts.
- **Users COMPLAIN:** coupons fail during sales; cashback less than shown / delayed payouts;
  behavioral data collection.
- **Gaps users want:** reliability honesty; less tracking.

## 5. CamelCamelCamel — _The Camelizer_

- **Free · Amazon-only** price tracker.
- **Core features:** historical **price charts**, email price-drop alerts. No coupons/cashback.
- **Users LOVE:** **transparent, minimal data, non-commercial**; trustworthy; price history.
- **Users COMPLAIN:** Amazon-only; dated UI; single-purpose.
- **Gaps users want:** more sites; richer signals beyond price.

---

## Cross-cutting themes (the real opportunities)

| Pain heard repeatedly | Who | Opportunity for us (backend-free) |
|---|---|---|
| **Privacy / surveillance** (cookies, webRequest, all-sites) | Honey, Cap One, Coupert | We already run client-side, no tracking, minimal permissions — lean into it. |
| **Trust erosion / opaque behavior** (affiliate hijack) | Honey | Be radically **transparent**: show *why* and *what* we flagged. |
| **Intrusive UI blocks the page** | Honey | Stay **inline + non-intrusive**; opt-in notifications only. |
| **"No persistent indicator it's working"** | Capital One | A **toolbar badge count** + clear popup status. |
| **No record of what the tool did** | all | An **activity history** of flagged items. |
| **Silent failures / can't tell status** | Cap One, Coupert | Surface engine health + a **page scan summary**. |

## The uncontested gap

**None of the top shopping extensions address AI-generated product imagery.** Honey/Coupert =
coupons; Rakuten = cashback; Capital One = price+coupons; Camel = Amazon price history. The
entire **"is this product photo real or AI?"** trust lane is open — and the highest-value wins
for us are the *transparency, status, and privacy* features shoppers already say competitors do
poorly, adapted to our niche.

> **Filter applied:** we deliberately ignore coupons, cashback, and price comparison — they are
> competitors' core identity, need deals/coupon databases (partnerships) or accounts/payments,
> and don't fit a privacy-first authenticity tool. See `feature-plan.md`.
