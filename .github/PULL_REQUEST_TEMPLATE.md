## What does this change?

<!-- One or two sentences on what and why. Link the issue it closes, if any. -->

## Type of change

- [ ] Bug fix
- [ ] New/updated marketplace selector
- [ ] New feature
- [ ] Documentation
- [ ] Refactor / cleanup (no behavior change)
- [ ] Other:

## Checklist

- [ ] `npm run lint` passes (ESLint + manifest/file-reference validation)
- [ ] `npm run test:unit` passes
- [ ] `npm test` passes (Playwright E2E)
- [ ] I smoke-tested this on a real marketplace page with the unpacked extension
      (automated tests use fixtures — a live DOM change won't always show up there)
- [ ] I did not introduce `innerHTML`/`eval`/`new Function`/`document.write`
- [ ] I did not add a new permission or host permission without explaining why below
- [ ] I did not add telemetry, a backend dependency, or scope beyond the extension's
      single purpose (detection) without discussing it in an issue first

## New permissions or host permissions (if any)

<!-- What was added and why. If nothing changed, delete this section. -->

## Test plan

<!-- How did you verify this works? What did you check manually? -->

## Screenshots (if UI-facing)

<!-- Before/after screenshots for popup, options, or on-page badge changes. -->
