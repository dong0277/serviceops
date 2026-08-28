# ADR 003: Authentication and session architecture

- Status: Accepted
- Date: 2026-08-28

## Context

The Next.js application and FastAPI service require password authentication, organization memberships, customer/staff/owner authorization, secure browser sessions, and protection against token theft and CSRF. Part A excludes Supabase Auth and requires business authorization to remain in FastAPI.

Authentication is a security-sensitive architecture choice and must be explicitly approved before implementation.

## Proposed decision

- FastAPI owns registration, login, logout, session refresh, and authorization.
- Hash passwords with Argon2id using a maintained library and documented parameters.
- Use short-lived access credentials and a rotated, revocable refresh/session credential.
- Keep long-lived credentials in `Secure`, `HttpOnly`, appropriately scoped cookies; never use `localStorage` for them.
- Protect cookie-authenticated state changes with origin checks and a documented CSRF mechanism.
- Store only hashes of refresh/session credentials when persistence is required, and support rotation and revocation.
- Return non-enumerating authentication errors and rate-limit login attempts.
- Enforce organization scope and roles in FastAPI services, not only in Next.js middleware or UI visibility.
- Use fictional local demo credentials only; never make them production defaults.

## Consequences

- The API remains the security authority for every client.
- Cookie, CORS, CSRF, and deployment-domain choices must be tested together.
- Session storage and rotation add database and integration-test requirements.

## Approval and validation required

- Approved by the developer's instruction to proceed with Milestone 1 on 2026-08-28.
- Validate same-site and cross-origin behavior against the actual preview deployment domains.
- Record final credential lifetimes, CSRF technique, password parameters, and revocation behavior in `docs/security.md`.
