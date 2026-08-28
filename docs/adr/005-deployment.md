# ADR 005: Provisional deployment topology

- Status: Provisional
- Date: 2026-08-28

## Context

The public portfolio needs a convincing demo, but local reproducibility and automated tests come first. Deployment must not introduce paid resources or production credentials without explicit approval.

## Decision

- Keep Docker Compose as the local development baseline in both work locations.
- Use GitHub as source control and CI, not as the production API or database.
- Evaluate the initial public topology as:
  - Vercel project for `apps/web`
  - Vercel project for `apps/api`
  - Supabase-hosted PostgreSQL only
- Do not deploy, create external projects, or incur costs without explicit approval.
- Keep normal lint, type-check, test, and build workflows independent of production credentials.
- If FastAPI on Vercel Functions causes measured limitations, record the evidence in a new ADR before proposing a container host.

## Consequences

- The topology stays inexpensive and simple enough for a portfolio if the vertical slice validates it.
- Serverless runtime constraints may affect database connections, startup behavior, background work, and observability.
- Deployment-domain choices affect authentication cookies, CORS, and CSRF configuration.

## Validation gate

Before accepting this ADR permanently, deploy one approved vertical slice and verify:

- FastAPI startup and request latency
- PostgreSQL connection behavior under the runtime model
- migrations and safe secret configuration
- cookie, CORS, and CSRF behavior between frontend and API
- logs, health checks, and rollback procedure
- actual hosting cost and free-tier limitations
