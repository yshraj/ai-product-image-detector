# Security Policy

TrueKart runs with real browser privileges (`host_permissions` on shopping sites, a
service worker that fetches image bytes on the page's behalf, and an optional
user-provided Hugging Face token). We take reports about this attack surface
seriously.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Use [GitHub Security Advisories](https://github.com/yshraj/ai-product-image-detector/security/advisories/new)
to report privately. This lets us discuss and fix the issue before it's public.

If you're unable to use Security Advisories, open a regular issue asking for a
private contact channel — do not include exploit details in the issue itself.

We'll acknowledge new reports within a few days and aim to ship a fix or a
mitigation plan within 30 days for confirmed issues, faster for anything
actively exploitable. Severity and timeline are ultimately a judgment call by
the maintainers, since this is a volunteer-maintained open source project.

## Supported versions

Only the latest published version (see [manifest.json](manifest.json) /
[CHANGELOG.md](CHANGELOG.md)) is supported. There are no LTS branches.

## Scope

In scope:
- The extension's own code: `background/`, `content/`, `popup/`, `options/`,
  `detection/`, `offscreen/`, `utils/`.
- The manifest's permissions and content security policy.
- The Chrome Web Store listing once published (impersonation, listing tampering).

Out of scope:
- Vulnerabilities in Hugging Face's infrastructure or models — report those to
  Hugging Face directly.
- Vulnerabilities in the marketplaces TrueKart runs on (AliExpress, Temu,
  Shein, Amazon, Myntra, Flipkart, Meesho, Nykaa) — report those to the
  marketplace.
- Vulnerabilities that require the user to have already installed a malicious
  or modified build of the extension from outside the Chrome Web Store or this
  repository.

## Threat model

TrueKart is designed with **no backend and no accounts**. Data flow is:

| Data | Leaves the device? | Where | When |
|---|---|---|---|
| Product image bytes | Yes | Hugging Face | Only if you connect the Hugging Face engine |
| Product image bytes | No | — | On-device preview / ONNX engines run locally |
| Hugging Face access token | Yes | Hugging Face only (your own requests) | Every HF detection call |
| Detection cache, scan history | No | — | `chrome.storage.local`, this device only |
| Settings (display mode, threshold, etc.) | Yes | Google's Chrome Sync | Standard Chrome profile sync, not a TrueKart server |

The two most privileged code paths, and how they're defended:

**1. The service worker's image fetch bypasses page CORS** (needed to read
pixel data off marketplace CDNs). Every URL — the initial request and every
redirect hop — is checked by `isAllowedHttpUrl()` in
[`background/service-worker.js`](background/service-worker.js), which blocks
non-`http(s)` schemes and loopback/private/link-local/multicast addresses for
both IPv4 and IPv6 (including IPv4-mapped IPv6 and alternate IPv4 encodings,
which the URL parser itself normalizes before the check runs). This is
hostname-based, not resolved-IP-based — DNS rebinding is a known, accepted
limitation (see [docs/DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md)).

**2. Cross-context messaging.** All `chrome.runtime.onMessage` handlers verify
`sender.id === chrome.runtime.id` (`isTrustedSender()`) before acting, and the
extension declares no `externally_connectable`, so web pages cannot message it
directly.

We deliberately avoid `innerHTML`/`eval`/`new Function`/`document.write` in
first-party code — all DOM construction uses `createElement`/`textContent`.
If you find an exception to that, it's a bug; please report it.

## Known limitations (tracked, not silent)

- **Hugging Face token in `chrome.storage.sync`, not `.local`.** It's scoped
  to your own signed-in Chrome profile (never sent to TrueKart, always
  excluded from settings export), so this is a defense-in-depth gap rather
  than an active vulnerability — but a token confined to `.local` (this
  device only, no Google Sync roaming) would be tighter. Moving it requires
  touching config-loading in the popup, options page, and service worker
  together (see [docs/archive/EXTENSION-PLAYBOOK.md](docs/archive/EXTENSION-PLAYBOOK.md)
  for where this was first flagged); tracked as a deliberate follow-up, not
  forgotten.
- **SSRF guard is hostname-based, not resolved-IP-based** — see the DNS
  rebinding note above. No extension API exists to pin a resolved IP before
  `fetch()` runs.
- **No automated security scanning of devDependencies.** `npm audit` reports
  pre-existing vulnerabilities in devDependencies only (Playwright/ESLint
  toolchain — nothing that ships in the extension); not yet wired into CI.

## Disclosure

We'll credit reporters (with permission) in the CHANGELOG once a fix ships,
unless you'd prefer to stay anonymous.
