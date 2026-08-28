# ADR 005: GitHub-first portfolio delivery

- Status: Accepted
- Date: 2026-08-29
- Supersedes: Provisional Vercel Hobby and Supabase Free deployment proposal dated 2026-08-28

## Context

ServiceOps is a personal, non-commercial engineering portfolio. The public GitHub repository already provides bilingual documentation, screenshots, workflow GIFs, source history, automated tests, and a clean-checkout Docker workflow. A live free-tier deployment would improve click-through convenience but would also introduce provider suspension, cold starts, quotas, cookie-domain configuration, credential lifecycle, and ongoing maintenance that are not necessary to demonstrate the engineering work.

The user decided that GitHub is sufficient for the MVP portfolio and explicitly skipped live deployment validation. The user also chose not to make manual VoiceOver/additional-screen-reader and physical-device testing a release gate. The release must not imply that those deferred environments were validated.

## Decision

- Deliver the `v1.0.0` MVP through the public GitHub repository, bilingual README files, reproducible screenshots and GIFs, case study, and documented Docker Compose workflow.
- Keep Docker Compose as the runtime and verification baseline in both work locations.
- Do not create ServiceOps-specific Vercel, Supabase, custom-domain, or other hosting resources for this release.
- Keep normal formatting, lint, type-check, backend test, production build, and isolated Playwright workflows independent of external accounts and production credentials.
- Treat public hosting as optional post-MVP work. It requires a new explicit user decision and a new or superseding ADR before resources are created.
- If public hosting is reconsidered, require zero recurring cost and validate runtime limits, migrations, secrets, cookies, CORS, CSRF, rate limiting, logging, health checks, rollback, and resettable fictional demo identities against the actual domains.
- Keep the project a personal, non-commercial product demonstration with no real service fulfillment, payment, advertising, or freelance solicitation.

## Consequences

- Reviewers can evaluate the architecture, implementation, tests, media, and reproducibility without relying on a potentially sleeping or expired free-tier service.
- The repository has no live-demo availability claim and no deployment-specific security validation claim.
- Local seed credentials remain development/test-only and never become internet-facing defaults.
- Hosting maintenance and external-provider policy changes do not become MVP obligations.
- A future live demo remains possible, but it is a separate, explicitly approved experiment rather than unfinished `v1.0.0` work.

## Validation status

The repository, deterministic seed data, clean-checkout setup, local Docker runtime, isolated E2E environment, bilingual product media, and documented quality commands have been validated. Manual screen-reader and physical-device review have not been performed; automated axe, keyboard, reflow, forced-colors, reduced-motion, overflow, and touch-target geometry checks are the accessibility evidence claimed by this release.
