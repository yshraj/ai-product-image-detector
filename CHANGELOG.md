# Changelog

All notable changes to RealModel Filter are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Toolbar badge counter** — per-tab count of AI-flagged images on the extension icon.
- **Page scan summary + rescan** in the popup ("N of M look AI (P%)").
- **"Why flagged?" popover** — click a badge for engine, model, confidence and a plain
  explanation (accessible; never navigates the product link).
- **Activity history** — a local, on-device log of flagged items on the Settings page.
- **Opt-in notifications** — one quiet OS notification per page when AI is found (off by default).
- Shared user-facing **strings module** (`utils/strings.js`) and competitor research under
  `research/`.

### Fixed
- **Detection accuracy on real photos.** The previous default model
  `Organika/sdxl-detector` over-flags studio/e-commerce photography (benchmarked
  ~60% accuracy / ~17% FPR), so connected users saw almost everything flagged.
  - Default model switched to `haywoodsloan/ai-image-detector-deploy` (verified
    served on the free hf-inference tier); existing installs are migrated off the
    old default and their stale cache is dropped.
  - Popup model picker now lists **only served (warm) models**; switching a model
    **auto-clears the per-URL cache** so the change takes effect on reload.

### Changed
- Badge tiers are stricter: **≥ 95% → "AI Generated"**, **70–94% → "Likely AI"**,
  **< 70% → no badge**. Default minimum-confidence floor raised 50% → **70%**.

## [1.3.0] — 2026-06-27

### Added
- **Settings page** (`options_ui`, opens in a tab; reachable from the popup footer).
- **Detection preferences** (autosave, applied live via `chrome.storage.onChanged`):
  minimum-confidence threshold (50–95%), per-marketplace enable/disable, display mode,
  master enable.
- **Data & privacy controls:** local cache stats, export/import settings (token never
  exported), clear cache, reset all settings.
- **In-app Privacy Policy and Terms of Use**, plus `docs/PRIVACY.md` / `docs/TERMS.md`.
- `LICENSE` (proprietary) and package metadata; `CHANGELOG.md`.

### Changed
- Removed the **AI or Not** engine — Hugging Face is the single accurate engine, with the
  on-device **Preview** heuristic as the no-key fallback.
- **Optimised Hugging Face usage:** viewport-gated detection now only analyses images
  scrolled into view, sharply reducing API calls (with the existing per-URL cache,
  concurrency cap, and error backoff).

### Fixed
- Malformed/corrupt stored or imported settings can no longer crash the content script —
  all preference values are validated and coerced safely.
- Removed unused rate-limiter (dead code).

## [1.2.0] — 2026-06-27

### Changed
- Hugging Face–only engines (AI or Not removed); viewport-gated scanning.

## [1.1.0] — 2026-06-27

### Fixed
- **Hugging Face detection restored:** migrated from the retired
  `api-inference.huggingface.co` (HTTP 410) to the current
  `router.huggingface.co/hf-inference` endpoint.

### Added
- Live token validation on Connect (whoami) with success/error states.
- Engine-health surfacing so remote errors show in the popup instead of failing silently.
- SaaS-grade popup redesign, accessibility pass, axe + unit tests, CI, keyboard shortcut
  (Alt+Shift+R), and an SSRF allowlist in the service worker.

## [1.0.0]

- Initial release: MV3 extension with badge overlays, EXIF + on-device heuristic, and
  initial Hugging Face / AI or Not wiring.
