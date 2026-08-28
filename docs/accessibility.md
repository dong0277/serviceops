# Accessibility

## Current scope

ServiceOps targets WCAG 2.1 Level AA for the public booking, authentication, customer, staff, and owner surfaces. The completed local Milestone 5 baseline combines automated axe checks with keyboard and responsive browser checks. The GitHub-first `v1.0.0` release does not claim manual assistive-technology or physical-device validation.

## Implemented baseline

- Every localized page provides a keyboard-visible skip link to `#main-content`.
- Mobile navigation drawers and booking/service dialogs expose dialog semantics, move focus into the opened surface, trap `Tab` and `Shift+Tab`, close on `Escape`, lock background scrolling, and restore focus to the trigger.
- Form fields retain visible labels, authentication mode controls expose their pressed state, icon-only controls have accessible names, and calendar day controls announce full localized dates.
- Focus-visible treatments are shared across customer and operations profiles.
- Korean remains the default locale and English remains available through locale-prefixed routes.
- Responsive smoke coverage uses a 390 × 844 viewport and rejects horizontal page overflow.
- Representative mobile customer, staff, and owner routes reject visible interactive targets smaller than 24 CSS pixels.

## Automated coverage

`make e2e` runs axe-core against representative public, customer, staff, and owner routes using the WCAG 2.0 A/AA and WCAG 2.1 A/AA rule tags. It also exercises dialog and drawer keyboard behavior and the critical cross-role browser flows.

The command creates a temporary `serviceops-e2e` Docker Compose project with its own PostgreSQL volume and ports, seeds that database, and removes the project and volume on exit. The normal development database is not mutated. If the default test ports are occupied, override them explicitly:

```bash
E2E_WEB_PORT=13001 E2E_API_PORT=18001 E2E_POSTGRES_PORT=15433 make e2e
```

## Validation status

### Environment-assisted review — 2026-08-28

| Check                                    | Result | Evidence                                                                                                                         |
| ---------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Keyboard order and skip link             | Pass   | Real-browser review plus Playwright dialog and mobile-drawer focus tests                                                         |
| Dialog focus containment and restoration | Pass   | `Tab`, `Shift+Tab`, `Escape`, initial focus, and trigger restoration coverage                                                    |
| 200%-equivalent reflow                   | Pass   | Owner dashboard, calendar, and services checked at a 640 CSS-pixel viewport with no horizontal document overflow                 |
| Reduced motion                           | Pass   | Entry animation runs only with `no-preference`; smooth scrolling and transition/animation duration are suppressed under `reduce` |
| Forced colors                            | Pass   | Key owner pages render under forced colors and focus-visible controls receive a system-color outline                             |
| Representative mobile layout             | Pass   | Customer booking and staff assigned-work views reviewed at 390 × 844 and captured without horizontal overflow                    |
| Minimum touch-target geometry            | Pass   | Representative customer, staff, and owner pages reject visible interactive targets below 24 CSS pixels at 390 × 844              |

### Deferred manual review — 2026-08-29

The user explicitly chose to ship the source-only portfolio without VoiceOver/additional-screen-reader auditory review or physical-device ergonomics confirmation. These checks are optional follow-up work and are not release gates for `v1.0.0`. Automated semantics and visual emulation still do not prove announcement quality, interpreted reading order, or real touch ergonomics, so the release must not claim those forms of validation. If live public hosting is reconsidered, use [manual-accessibility-review.md](manual-accessibility-review.md) and record findings before making broader accessibility claims.
