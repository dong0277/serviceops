# ADR 006: PostgreSQL exclusion constraint for booking conflicts

- Status: Accepted
- Date: 2026-08-28

## Context

ServiceOps must prevent overlapping active bookings for one staff member. A read-then-write application check alone is vulnerable when two requests inspect the same free slot before either transaction commits. The rule must also treat adjacent bookings as valid and cancelled bookings as non-blocking.

## Decision

- Enable PostgreSQL's `btree_gist` extension through Alembic.
- Represent each booking interval as the half-open range `[starts_at, ends_at)`.
- Add a GiST exclusion constraint combining staff equality with timestamp-range overlap.
- Apply the constraint only when `status <> 'cancelled'`.
- Keep application-level availability and time-off validation for useful error messages, but treat the database constraint as the final atomic authority.
- Translate exclusion violations into HTTP 409 with error code `booking_conflict`.

Equivalent database rule:

```sql
EXCLUDE USING gist (
  staff_profile_id WITH =,
  tstzrange(starts_at, ends_at, '[)') WITH &&
)
WHERE (status <> 'cancelled'::booking_status)
```

## Consequences

- Concurrent requests cannot create overlapping active bookings even when both observed the slot as available.
- A booking ending exactly when another begins is allowed.
- Cancelling a booking immediately releases its interval.
- PostgreSQL remains required for domain tests; an in-memory database cannot validate this invariant.
- A future reassignment or operational status update automatically receives the same database protection.

## Validation

- PostgreSQL integration tests cover overlap rejection, cancellation reuse, rescheduling conflicts, and two near-simultaneous booking attempts.
- The concurrency test requires exactly one successful insert and one `booking_conflict` response.
