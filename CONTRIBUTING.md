# Contributing to TrueKart

Thanks for considering a contribution. TrueKart is a small, no-build Chrome
extension — most changes are a single file edit plus a test. This guide covers
what you need to get from clone to merged PR.

## Ground rules

- Be respectful. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- Discuss non-trivial changes in an issue before writing code — saves everyone
  a rewritten PR.
- Security issues go to [SECURITY.md](SECURITY.md), not a public issue.

## Setup

```bash
git clone https://github.com/yshraj/ai-product-image-detector.git
cd ai-product-image-detector
npm ci
npx playwright install --with-deps chromium   # first-time E2E setup
```

Load the extension unpacked at `chrome://extensions` (Developer mode → Load
unpacked → repo root) to test changes live, or run `npm start` for
auto-reload. Full developer walkthrough: [README.md](README.md#developer-guide).

## Before opening a PR

```bash
npm run lint          # ESLint + manifest/file-reference validation
npm run test:unit      # Node unit tests
npm test               # Playwright E2E (offline mocks, no live network)
```

All three must pass. Then smoke-test on a real marketplace page with the
unpacked extension — automated tests use fixtures and won't catch a live DOM
change.

## Code conventions

- **Vanilla JS, no build step.** No bundler, no TypeScript, no framework.
  Chrome loads the repo folder as-is — keep it that way. See
  [docs/DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md) for the reasoning.
- **Shared settings and storage keys** live in `utils/defaults.js`.
- **User-facing strings** live in `utils/strings.js` — don't hardcode copy
  inline if you can help it (this is also our translation-readiness path).
- **Per-marketplace DOM selectors** live in `content/sites/<name>.js` — see
  "Adding or fixing a marketplace" below.
- **No injection sinks.** Never use `innerHTML`, `outerHTML`,
  `insertAdjacentHTML`, `eval`, or `new Function`. Build DOM with
  `createElement` / `textContent`. This is enforced by review, not lint —
  treat it as a hard rule.
- **No `console.log` in shipped code.** Use the gated logger
  (`utils/logger.js`, `RMF_Log`) or remove it before merging.
- **Historical `RMF_` prefix.** Globals and message types still use the
  `RMF_` prefix from the extension's pre-rebrand name — this is intentional
  (see [docs/DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md)), not something to
  "fix" in an unrelated PR.

## Adding or fixing a marketplace

Marketplace DOM selectors break when a site redesigns — this is the most
common maintenance need and a great first contribution.

1. Edit or add `content/sites/<name>.js`, defining `window.RMF_SITE` per the
   existing files' shape.
2. Add the site's URL patterns to `manifest.json` (`content_scripts.matches`
   and `host_permissions`) if it's new.
3. Follow the verification protocol in [docs/SELECTORS.md](docs/SELECTORS.md)
   — selectors must be checked against the live site, not just a saved
   fixture, since hashed/dynamic class names are the usual failure mode.
4. Add or update a test fixture under `test/e2e/fixtures/` and a spec under
   `test/e2e/`.

## Tests

- **Unit** (`test/unit/*.test.cjs`, Node's built-in test runner): pure
  functions — detection pipeline, SSRF guard, cache, string formatting.
- **E2E** (`test/e2e/*.spec.cjs`, Playwright): loads the real unpacked
  extension in Chromium against served fixture HTML — no live network. See
  [test/e2e/README.md](test/e2e/README.md) for the Page Object Model and
  helpers.
- **Accessibility** (`test/e2e/a11y.spec.cjs`): axe-core audit of the popup
  and options page. Keep it green — a11y is a project priority, not an
  afterthought.

New behavior needs a test. Bug fixes should include a regression test where
practical.

## Pull requests

1. Fork and branch from `main`.
2. Keep PRs focused — one concern per PR is easier to review and revert.
3. Fill out the PR template (test plan matters more than a long description).
4. A maintainer will review; expect feedback on selector fragility, privacy
   implications, and permission scope in particular — these are the things
   most likely to block a merge.

## What we're looking for (and not)

TrueKart's goal is a trustworthy, privacy-first detector — not a general
shopping assistant. Before adding a feature, check
[docs/ROADMAP.md](docs/ROADMAP.md) for what's planned and what's explicitly
not planned. PRs that add scope (new permissions, a backend dependency,
telemetry, unrelated shopping utilities) are less likely to be merged than
PRs that make the existing detection experience more accurate, faster, more
accessible, or easier to trust.

## License

By contributing, you agree your contributions are licensed under the
project's [MIT License](LICENSE).
