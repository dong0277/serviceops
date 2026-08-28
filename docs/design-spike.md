# ServiceOps Phase 0C design spike

## Purpose

This document records the historical Phase 0C spike that validated one thin design system across a comfortable mobile customer flow and a compact desktop operations flow. The spike originally used static fictional data. The current local product connects those customer, booking-list, and dashboard concepts to FastAPI and PostgreSQL; the seeded content remains fictional demo data.

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

## Historical deferrals and outcomes

- Full calendar: the customer flow intentionally retains a short date strip and calculated slots; Milestone 4 added the owner desktop month grid and mobile agenda.
- Dialog: later owner booking-detail and service-management interactions added accessible modal dialogs with focus trapping, Escape dismissal, scroll locking, and trigger focus restoration.
- Toast: the booking request still uses an inline live status so confirmation remains visible and accessible.
- Reusable DataTable abstraction: the MVP keeps purpose-built tables and lists because their data and responsive behavior differ; extraction remains post-MVP work only if another project proves a stable shared API.
- Production navigation: Milestone 4 removed non-functional destinations and retained only implemented routes.

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

The Turbopack production build could not be exercised in the Codex execution sandbox because its CSS worker attempted to bind an internal port that the environment denied. The verified Webpack production build remains the repository quality gate. Turbopack is an optional post-MVP evaluation and must not replace that gate without a successful local and CI comparison.
