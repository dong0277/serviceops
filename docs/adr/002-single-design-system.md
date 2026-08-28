# ADR 002: One design system with two experience profiles

- Status: Accepted
- Date: 2026-08-28

## Context

ServiceOps needs a mobile-first customer booking experience and a denser desktop operations experience. Maintaining separate design systems would duplicate primitives and make a one-person project harder to keep consistent.

The product must support Korean and English. Korean is initially the default, while the default may later change to English.

## Decision

- Use one code-first design system built from semantic tokens, shared primitives, and surface-specific patterns.
- Start with Tailwind CSS, shadcn/ui source, Radix UI where required, Lucide icons, and Pretendard as the initial Korean-capable font.
- Keep customer and operations profiles distinct through layout, density, theme, and composed patterns rather than separate foundations.
- Begin only with components required by the three-screen design spike and first vertical slice.
- Use explicit `/ko/...` and `/en/...` locale-prefixed routes.
- Store user-facing text in centralized locale message files; do not hard-code Korean or English copy inside reusable components.
- Use locale-aware formatting for dates, times, numbers, and organization timezones.
- Keep the default locale configurable so it can change from Korean to English without rewriting screens or business rules.
- Defer Storybook until approximately 8 to 10 components are stable in real screens.

## Consequences

- Shared behavior and accessibility fixes apply to both product surfaces.
- Components must be tested with text expansion and both locales early.
- Locale routing, metadata, validation messages, and formatting are cross-cutting requirements from the first screen.
- Figma records stable decisions but does not block code-first validation.

## Validation

Phase 0C and the completed local MVP validated customer mobile layouts, owner desktop layouts, keyboard focus, responsive behavior, and representative Korean and English content. The shared foundations now support customer, staff, and owner surfaces, while automated checks cover axe, focus containment and restoration, reflow, forced colors, reduced motion, overflow, and representative touch-target geometry. Human screen-reader and physical-device review were explicitly deferred from the GitHub-first `v1.0.0` scope and remain optional future validation.
