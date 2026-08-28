# ADR 004: PostgreSQL and application-enforced tenancy

- Status: Accepted
- Date: 2026-08-28

## Context

ServiceOps requires relational modeling, transactions, booking conflict protection, organization isolation, deterministic tests, and a reproducible local environment. The GitHub-first `v1.0.0` release uses local PostgreSQL through Docker Compose and has no selected public database target; FastAPI remains the business API in every environment.

Development takes place from two locations, so local database files or Docker volumes cannot be the source of truth.

## Decision

- Use PostgreSQL for development, tests, and production-like environments.
- Run local PostgreSQL through Docker Compose.
- Use SQLAlchemy 2 and Alembic; every schema change requires a migration.
- Use a shared schema with `organization_id` on organization-owned records and enforce organization scope in repository/service queries.
- Add database constraints and integration tests for tenant boundaries and invariants.
- Store timestamps in UTC and store an IANA timezone per organization.
- Make booking conflict checks and writes atomic using the PostgreSQL exclusion constraint documented in [ADR 006](006-booking-conflict-protection.md).
- Treat migrations and deterministic seed data as portable development state. Do not synchronize or commit Docker volumes.
- An approved public deployment may use Supabase Free for PostgreSQL only; do not use Supabase Auth, generated APIs, or duplicated Edge Function business logic.

## Consequences

- FastAPI remains responsible for authorization and tenant scoping.
- Every organization-owned data path needs negative isolation tests.
- Both work locations can recreate equivalent development environments without sharing mutable database files.
- The public database provider can change without replacing application business logic.

## Validation

- Test cross-organization access for every role.
- Test concurrent or near-concurrent booking attempts against PostgreSQL rather than an in-memory substitute.
- Verify migrations and seed data from a clean database in CI.
