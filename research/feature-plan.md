# Feature Plan — Top 5 High-Value, Easy-Win Features

_Derived from `competitor-analysis.md`. Each passes the filter below._

**INCLUDE if:** high user value (real pain from reviews) · gap/weak in competitors · buildable
in 1–3 days here · works **without a backend / accounts / payments**.

**EXCLUDE if:** competitor-core (coupons/cashback/price comparison) · needs deals/coupon DB
(partnerships) · needs accounts or payments.

---

## Selected features (ordered by complexity, S → M)

### 1. Toolbar badge counter — **S**
- **Problem:** users can't tell, at a glance, whether the extension is working or what it found.
- **Competitor gap:** Capital One Shopping users specifically complain there's *"no persistent
  visual indicator that tracking remains active."* We fix exactly that.
- **What:** show the number of AI-flagged items on the current tab as a badge on the extension
  icon (`chrome.action.setBadgeText`/`setBadgeBackgroundColor`), per-tab, cleared on navigation.
- **Backend-free:** yes (Chrome action API + existing content-script counts).

### 2. Page scan summary + rescan — **S**
- **Problem:** no clear, honest answer to "what did you find on this page?"
- **Competitor gap:** competitors hide/auto-dismiss status (Capital One); we make it explicit.
- **What:** popup shows **"N of M product images look AI (P%)"** with a progress meter and a
  **Rescan page** action (clears scanned marks → re-runs, hitting cache so it's cheap).
- **Backend-free:** yes (existing `GET_STATS` + a new `RESCAN` message).

### 3. Activity history — **M**
- **Problem:** there's no record of what was flagged; users can't review later.
- **Competitor gap:** **no shopping extension keeps a transparent, local history** of its calls.
- **What:** a capped, local ring-buffer log (site, score, verdict, time, page/image URL) written
  on each flag; viewable + clearable in the Options page. Stored in `chrome.storage.local`.
- **Backend-free:** yes. No PII leaves the device.

### 4. Detection notifications (opt-in) — **M**
- **Problem:** shoppers may not notice flags if they don't open the popup.
- **Competitor gap:** Honey's notifications are intrusive (block the page); Rakuten's are loved
  because they're a quiet corner nudge. We do an **opt-in, OS-level, non-intrusive** notify.
- **What:** a Settings toggle (default **off**) → when a page finishes scanning and has new AI
  flags, fire one throttled `chrome.notifications` summary ("3 AI-looking images on this page").
- **Backend-free:** yes (`notifications` permission only).

### 5. "Why flagged?" badge details — **M**
- **Problem:** a bare badge gives no reason to trust the verdict.
- **Competitor gap:** competitors are **opaque** (the trust scandal stems from hidden behavior);
  radical transparency is our differentiator.
- **What:** clicking a badge opens a small inline card showing engine (Hugging Face / Preview),
  model, confidence, and source — with a one-line plain-English explanation. Keyboard/ARIA
  accessible; never blocks the product link.
- **Backend-free:** yes (data already present in the detection result; pass model through).

---

## Considered but EXCLUDED (filter working as intended)

| Idea | Why excluded |
|---|---|
| Coupon auto-apply / cashback | Competitor-core; needs coupon/deals DB + partnerships + payments. |
| Price comparison / price history | Competitor-core (Capital One, Camel); needs price data feeds. |
| **Universal right-click "check any image, any site"** | High value, but doing it *properly* needs broad/optional host permissions to fetch arbitrary cross-origin image bytes — conflicts with our minimal-permission/privacy stance and pushes it to **L** (>3 days). Revisit later via `optional_host_permissions` requested on demand. |
| User accounts / sync dashboard | Needs a backend + accounts; against the no-backend rule. |

---

## Cross-cutting standards for all 5
- All user-facing strings live in **`utils/strings.js`** (a UMD constants module).
- Content-script work stays **deferred / non-blocking**; nothing slows page load.
- Every feature **fails silently** on unsupported sites (guarded on `RMF_SITE` / try-catch).
- Tests: unit (`node:test`) for pure logic; Playwright e2e for Chrome-API/UI behavior.
