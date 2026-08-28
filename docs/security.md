# Security

## Status and scope

The local MVP implements password authentication, revocable browser sessions, CSRF protection, organization memberships, service and availability management, customer-owned booking operations, staff assigned-work transitions, owner operations, organization-scoped audit logging, and responsive role surfaces. Milestone 5 keeps browser tests and portfolio capture workflows isolated from the development database. Password reset remains outside the MVP, and deployment-specific controls have not been validated because no public environment exists yet.

## Authentication design

- FastAPI is the authentication and authorization authority.
- Passwords use Argon2id through `pwdlib` with the current explicit encoded parameters `m=65536`, `t=3`, and `p=4`. Each hash contains its own random salt.
- A successful registration or login creates a database-backed session with two independent opaque credentials.
- The access credential expires after 15 minutes. The refresh credential expires after 7 days.
- Both credentials contain 384 bits of random input and only SHA-256 hashes are stored in PostgreSQL.
- Access and refresh credentials are sent in `HttpOnly`, `SameSite=Lax` cookies. Production-like environments must set `COOKIE_SECURE=true` so they are HTTPS-only.
- Refresh rotates the access credential, refresh credential, and CSRF token while locking the session row. The previous credentials stop matching immediately.
- Logout marks the server-side session as revoked before deleting browser cookies.
- Credentials are never returned to JavaScript and are never stored in `localStorage` or `sessionStorage`.

## CSRF and origin checks

- Login, registration, refresh, and logout reject an `Origin` value outside `CORS_ALLOWED_ORIGINS`.
- Refresh and logout additionally require the readable `serviceops_csrf` cookie to match the `X-CSRF-Token` header and the hash stored with the session.
- Requests without an `Origin` remain available to non-browser API clients. Browser deployment must keep the allow-list exact and use HTTPS.
- Service, staff, availability, time-off, booking, rescheduling, and cancellation mutations reuse the same origin and CSRF checks.
- Docker Compose injects the exact configured origin allow-list and cookie/session settings into the API container. The E2E target supplies test-only web and API origins instead of weakening origin validation.

## Authentication privacy and abuse controls

- Unknown email addresses and incorrect passwords return the same status, code, and message.
- A missing user still performs an Argon2id verification against a dummy hash to reduce timing-based account discovery.
- Failed logins are limited to 5 attempts per hashed email-and-client key in a 60-second window.
- Registration failures use a generic response when an email is already registered.
- Passwords, session credentials, and CSRF values must not be logged.

## Authorization and tenancy

- `memberships` has a unique constraint on `(organization_id, user_id)` and an explicit `owner`, `staff`, or `customer` role.
- Organization-scoped API dependencies first find the authenticated user's membership, then verify its role.
- A user without a membership receives the same organization-not-found response whether the organization exists or not.
- Owner member listing is scoped by the authorized organization's UUID, never by an untrusted UUID from the request.
- Service, staff, time-off, slot, and booking queries include the authorized organization's UUID. Customer booking reads additionally include the authenticated customer's user UUID.
- Customer API responses use an explicit schema that never includes `internal_note`; assigned staff and owners receive explicit operational response schemas.
- UI visibility is not treated as authorization.

## Booking integrity

- The API rejects past starts, bookings outside recurring staff availability, staff/service mismatches, and time-off overlaps.
- PostgreSQL atomically rejects overlapping non-cancelled bookings for the same staff profile through a partial GiST exclusion constraint.
- Booking ranges are half-open (`[start, end)`), so adjacent appointments are allowed.
- Cancelled bookings do not block availability.
- PostgreSQL integration tests exercise conflicts, customer isolation, internal-note protection, cancellation reuse, rescheduling, and near-concurrent inserts.

## Threat model

Controls currently address stolen database rows, password guessing, basic account enumeration, cross-site cookie mutations, refresh-token replay after rotation, revoked sessions, role escalation, cross-organization reads, cross-customer booking reads, and concurrent double-booking.

Remaining limitations:

- The login limiter is process-local. A multi-instance public deployment requires a shared limiter at the API gateway or a dedicated store.
- Same-site and cross-origin cookie behavior must be revalidated against the final web and API domains before deployment.
- There is no password reset, email verification, MFA, session-management screen, or password-change flow yet.
- Session cleanup is not automated; expired and revoked rows should be pruned by an approved operational job later.
- Audit metadata excludes credentials and internal-note contents. CSV export sanitizes leading spreadsheet formula characters and records the request.

## Local demo identities

`make seed` is restricted to `development` and `test` environments. It creates fictional `.test` identities, three services, two staff profiles, weekly availability, time off, and mixed bookings using the local-only password `ServiceOps-Demo-2026!`. These credentials are intentionally documented local seed data and must never be enabled as deployment defaults. Any approved public demo must use separately provisioned, resettable fictional identities and a deployment-specific secret.

`make e2e` creates a separate test Compose project and temporary PostgreSQL volume, then removes both after the run. Browser-created test users and records therefore never enter the normal development database.
