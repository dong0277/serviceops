# ServiceOps Phase 0C design spike

## Purpose

This document records the historical Phase 0C spike that validated one thin design system across a comfortable mobile customer flow and a compact desktop operations flow. The spike originally used static fictional data. As of Milestone 4, its customer, booking-list, and dashboard concepts have been connected to the local API and PostgreSQL; the seeded content remains fictional demo data.

## Screens

1. Customer service and slot selection at `/ko/booking` and `/en/booking`
2. Owner booking list at `/ko/owner/bookings` and `/en/owner/bookings`
3. Owner dashboard at `/ko/owner/dashboard` and `/en/owner/dashboard`

The localized preview index is available at `/ko` and `/en`.

## Foundation exercised

- Semantic color, radius, shadow, and focus tokens
- Pretendard-first font stack
- Shared Button, Input, Select, Card, Badge, and PageHeader primitives
- Customer profile: comfortable density, mobile-first layout, prominent booking CTA
- Operations profile: compact density, sidebar navigation, filters, table and metric patterns
- Explicit Korean and English locale routes with centralized messages
- Locale-aware date, number, currency, and timezone presentation
- Visible focus states, semantic headings, labels, radio groups, status regions, table markup, and progress-bar semantics
- Reduced-motion preference support

## Deliberately deferred components

- Full Calendar: the current customer flow uses a short date strip and calculated slots; a calendar-oriented operations view remains Milestone 3 work.
- Dialog: no spike interaction requires a blocking modal.
- Toast: the booking request uses an inline live status so the confirmation remains visible and accessible.
- Reusable DataTable abstraction: only one table exists; extract it after a second real use proves the API.
- Production navigation destinations: sidebar destinations outside the three spike screens remain non-functional and must not ship as final MVP navigation.

## Review questions

- Does the calm green foundation feel trustworthy without becoming generic?
- Is the customer flow comfortable enough on a narrow mobile viewport?
- Is the operations density efficient without reducing legibility or touch targets?
- Do Korean and English strings fit without layout breakage?
- Which patterns are genuinely reusable after the first vertical slice?

## Validation results

Validated on 2026-08-28:

- TypeScript strict type-check passed.
- ESLint passed with no warnings.
- The production build compiled and all Korean and English routes were statically generated using the Next.js Webpack build path.
- The default locale redirected to `/ko` for a request without a locale cookie.
- All six localized spike routes returned HTTP 200.
- Browser checks covered 390 × 844 mobile and 1440 × 1000 desktop viewports.
- Customer service/time selection and the inline confirmation status worked.
- Booking search and status filters updated the visible result count.
- Locale switching preserved the current screen and updated the URL and document language.
- Korean and English dashboard layouts had no horizontal overflow at the tested viewports.
- The final browser pass contained no console warnings or errors.

The Turbopack production build could not be exercised in the Codex execution sandbox because its CSS worker attempted to bind an internal port that the environment denied. The repository therefore uses the successful Webpack production build as its Milestone 0 quality gate. Re-evaluate Turbopack in a normal local terminal during Milestone 1 before changing that gate.
