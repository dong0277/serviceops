# Accessibility

## Current scope

ServiceOps targets WCAG 2.1 Level AA for the public booking, authentication, customer, staff, and owner surfaces. The Milestone 5 baseline combines automated checks with keyboard and responsive browser checks; it is not a substitute for a formal assistive-technology audit before public deployment.

## Implemented baseline

- Every localized page provides a keyboard-visible skip link to `#main-content`.
- Mobile navigation drawers and booking/service dialogs expose dialog semantics, move focus into the opened surface, trap `Tab` and `Shift+Tab`, close on `Escape`, lock background scrolling, and restore focus to the trigger.
- Form fields retain visible labels, authentication mode controls expose their pressed state, icon-only controls have accessible names, and calendar day controls announce full localized dates.
- Focus-visible treatments are shared across customer and operations profiles.
- Korean remains the default locale and English remains available through locale-prefixed routes.
- Responsive smoke coverage uses a 390 × 844 viewport and rejects horizontal page overflow.

## Automated coverage

`make e2e` runs axe-core against representative public, customer, staff, and owner routes using the WCAG 2.0 A/AA and WCAG 2.1 A/AA rule tags. It also exercises dialog and drawer keyboard behavior and the critical cross-role browser flows.

The command creates a temporary `serviceops-e2e` Docker Compose project with its own PostgreSQL volume and ports, seeds that database, and removes the project and volume on exit. The normal development database is not mutated. If the default test ports are occupied, override them explicitly:

```bash
E2E_WEB_PORT=13001 E2E_API_PORT=18001 E2E_POSTGRES_PORT=15433 make e2e
```

## Remaining manual checks

Before a public release, verify the stable deployed build with VoiceOver and at least one additional screen reader/browser combination, browser zoom at 200%, reduced-motion preferences, forced-colors/high-contrast mode, and representative touch targets. Record any exceptions and remediation before tagging the MVP release.
