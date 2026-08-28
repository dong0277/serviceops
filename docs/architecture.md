# Architecture

## Status

Milestone 4 is implemented and the first Milestone 5 quality pass is complete. PostgreSQL persists the booking domain, status history, and immutable organization-scoped audit events. Customer, staff, and owner APIs enforce role and organization scope; the database atomically rejects overlapping active bookings. Responsive Korean/English product surfaces consume the live APIs, while critical role journeys, WCAG 2.1 AA axe checks, and keyboard-dialog checks run through Playwright against an isolated temporary Docker stack.

## Components

```mermaid
flowchart TB
    subgraph Client
        Browser[Responsive browser UI]
    end

    subgraph ServiceOps
        Web[Next.js App Router<br/>ko/en product surfaces]
        API[FastAPI<br/>REST and OpenAPI]
        DB[(PostgreSQL<br/>Docker Compose)]
    end

    Browser --> Web
    Web --> API
    API --> DB
```

## Current request flows

The customer booking screen manages customer bookings. The staff surface lists only the signed-in staff member's assigned work and exposes valid state transitions. Owner operations provide live dashboard aggregation, booking list and month-calendar views, service management, assignment and note editing, status changes, customer and team directories, audit history, and safe CSV export. Interactive pages expose loading, empty, success, authorization, failure, and retry states.

The current booking request flow is:

```text
Browser → Next.js customer UI → FastAPI role/CSRF checks → availability service → PostgreSQL exclusion constraint → booking response → owner list
```

Operational changes use the same request boundary and append status history plus audit events in the booking transaction before returning the updated role-specific response.

The dashboard endpoint aggregates a bounded 1–90 day interval ending today in the organization timezone. The calendar requests the visible month through the existing owner-booking filters and renders the same response as a desktop month grid or mobile agenda, avoiding a second scheduling data model.

Weekly local availability is interpreted in the organization's IANA timezone. Persisted booking and time-off timestamps are timezone-aware and normalized by PostgreSQL. Slot responses carry UTC instants and the web renders them in `Asia/Seoul` for the demo organization.

## Boundaries

- `apps/web` owns rendering, localized navigation, interaction states, and accessible presentation.
- `apps/api` owns validation, authentication, authorization, business rules, slot calculation, and transaction boundaries.
- PostgreSQL owns relational constraints, persistence, and final atomic overlap protection.
- `packages/tokens` owns stable semantic visual tokens shared by web surfaces.
- Docker Compose is the reproducible local baseline; hosted services must not become required for tests.
- Playwright owns critical browser-flow and automated accessibility coverage. Each E2E run uses an independent Compose project, PostgreSQL volume, ports, API origin allow-list, and public API build URL, then removes the temporary resources on exit. API integration tests remain the authority for concurrency, tenancy, and business-rule edge cases.

## Health model

- `GET /health` is a liveness check and does not contact dependencies.
- `GET /ready` reports whether configuration and PostgreSQL connectivity can receive traffic.

## Decisions

See `docs/adr/` for the monorepo, design system, authentication, database tenancy, booking conflict, and provisional deployment decisions.
