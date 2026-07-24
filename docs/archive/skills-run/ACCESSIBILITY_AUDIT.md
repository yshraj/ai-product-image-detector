# Accessibility Audit — TrueKart

Date: 2026-07-02  
Tool: `@axe-core/playwright` (wcag2a + wcag2aa tags)

## E2E results

| Surface | State | Serious/Critical violations |
|---------|-------|------------------------------|
| Popup | Preview engine | 0 |
| Popup | Hugging Face connected | 0 |
| Options | Default | 0 |

## Manual checks

- Keyboard: bottom nav tabs focusable; settings engine tabs switch with click
- Screen reader: scan progress announces via `aria-live="polite"`
- Onboarding overlay: skip + primary CTA buttons labeled

## Fix applied during audit

- **color-contrast:** `.brand-accent` green darkened from `#059669` to `#047857` on white header background

## Test command

```bash
npx playwright test test/e2e/a11y.spec.cjs
```
