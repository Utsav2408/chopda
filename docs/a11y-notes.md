# Accessibility notes (U5-05)

Short checklist of what was reviewed for Phase U5. Not a full audit.

## Checked

- **Labels:** Profile and company forms use `FormField` so every text/select
  control has a visible `<label htmlFor=…>`. Checkbox preferences use a wrapping
  `<label>`.
- **Button names:** Interactive controls expose accessible names (visible text
  or `aria-label` / `sr-only`), including menu toggle, nav overlay close,
  session revoke, bank actions, and reminders bell.
- **Tabs / landmarks:** Profile ↔ company header is a `<nav aria-label="Profile
  sections">` with `aria-current="page"`. App shell sidebar/nav have
  `aria-label`s. Section headings use `aria-labelledby`.
- **Dialogs:** Confirm and bank dialogs use `role="dialog"` /
  `role="alertdialog"`, `aria-modal`, and labelled titles.
- **New invoice form:** Inputs/selects gained matching `id`s so FormField labels
  associate correctly (keyboard + screen reader + Playwright `getByLabel`).
- **Status messages:** Save/error feedback uses `role="status"` or
  `role="alert"` where appropriate.
- **Keyboard:** Focusable controls are native buttons/links/inputs; Escape
  closes shell nav and confirm dialogs (existing behavior).

## Not exhaustively tested (follow-ups)

- Full keyboard-only walkthrough of flow builder drag/reorder and file upload
  flows.
- Automated axe/contrast scan in CI.
- Focus trap completeness inside every custom dialog on small screens.
- Screen-reader pass on invoice stepper + history with a real AT user.

## Quick re-check command ideas

- Manual: Tab through `/profile`, `/company`, `/invoices/new`, `/login`.
- Playwright: `pnpm test:e2e tests/e2e/phone-width.spec.ts` (layout, not a11y).
