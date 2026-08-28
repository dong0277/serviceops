# ADR 005: Provisional deployment topology

- Status: Provisional
- Date: 2026-08-28

## Context

The personal, non-commercial public portfolio needs a convincing demo, but local reproducibility and automated tests come first. The user requires a zero-cost deployment. It must not sell or fulfill services, solicit freelance work, collect payment, introduce paid resources, or use production credentials.

## Decision

- Keep Docker Compose as the local development baseline in both work locations.
- Use GitHub as source control and CI, not as the production API or database.
- Keep recurring hosting and domain cost at zero; use provider domains initially.
- Evaluate the initial public topology as:
  - Vercel Hobby project for `apps/web`
  - Vercel Hobby project for `apps/api`
  - Supabase Free-hosted PostgreSQL only
- Keep the deployment a personal, non-commercial product demonstration and show an explicit fictional-data/no-sale/no-payment notice on every route.
- Do not deploy, create external projects, or incur costs without explicit approval.
- Keep normal lint, type-check, test, and build workflows independent of production credentials.
- If FastAPI on Vercel Functions causes measured limitations, record the evidence in a new ADR before proposing a container host.

## Consequences

- The topology has no planned recurring cost and stays simple enough for a personal portfolio if the vertical slice validates it.
- Free-tier suspension, cold starts, quotas, and provider terms may reduce availability and must be accepted or addressed without silently adding cost.
- Serverless runtime constraints may affect database connections, startup behavior, background work, and observability.
- Deployment-domain choices affect authentication cookies, CORS, and CSRF configuration.

## Current validation status

The repository, local Docker workflow, deterministic seed data, isolated E2E environment, English portfolio assets, and clean-checkout setup have been validated. No Vercel or Supabase project has been created for ServiceOps, so this ADR remains provisional. Local seed credentials must not be reused in a deployed environment; an approved public demo requires separately provisioned, resettable fictional identities.

## Remaining validation gate

Before accepting this ADR permanently, deploy one approved vertical slice and verify:

- FastAPI startup and request latency
- PostgreSQL connection behavior under the runtime model
- migrations and safe secret configuration
- cookie, CORS, and CSRF behavior between frontend and API
- logs, health checks, and rollback procedure
- confirmed zero-dollar hosting cost and free-tier limitations
