# Changelog

All notable changes to RealModel Filter are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[Semantic Versioning](https://semver.org/).

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
