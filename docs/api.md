# API

All domain routes are versioned under `/api/v1`. Expected API failures use this envelope:

```json
{
  "error": {
    "code": "invalid_credentials",
    "message": "Email or password is incorrect."
  }
}
```

The ServiceOps API is a FastAPI application. With the local API running, generated OpenAPI documentation is available at <http://localhost:8000/docs> and the schema at <http://localhost:8000/api/v1/openapi.json>.

## System endpoints

### `GET /health`

Liveness check. A successful response means the API process can serve HTTP requests.

```json
{
  "status": "ok",
  "service": "serviceops-api",
  "version": "0.5.0"
}
```

### `GET /ready`

Readiness check. Returns HTTP 200 when configuration and PostgreSQL connectivity are ready, or HTTP 503 with `database: "error"` when PostgreSQL cannot be reached.

```json
{
  "status": "ready",
  "checks": {
    "configuration": "ok",
    "database": "ok"
  }
}
```

## Authentication

Authentication uses opaque, database-backed credentials in HttpOnly cookies. Browser calls must use credentials mode `include`. Refresh and logout require the `serviceops_csrf` cookie value in the `X-CSRF-Token` header.

### `POST /api/v1/auth/register`

Creates a new user and customer membership in an existing organization, signs the user in, and returns the current identity. Required JSON fields are `email`, `password` (12–128 characters), `display_name`, and `organization_slug`.

### `POST /api/v1/auth/login`

Signs in an active user. Failed attempts return the same `invalid_credentials` response for unknown emails and wrong passwords. Repeated failures return HTTP 429 with `Retry-After`.

### `POST /api/v1/auth/refresh`

Validates CSRF, locks the session row, and rotates the access, refresh, and CSRF credentials.

### `POST /api/v1/auth/logout`

Validates CSRF, revokes the server session, and deletes all session cookies. The operation is idempotent when no matching session remains.

### `GET /api/v1/auth/me`

Returns the active user and every organization membership available to that identity.

## Representative local requests

The examples below use only the fictional local seed identity. Start and seed the stack first with `make start` followed by `make seed`. Capture the customer session cookies:

```bash
curl -i \
  -c /tmp/serviceops-customer-cookies.txt \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  --data '{"email":"customer.sora@serviceops.test","password":"ServiceOps-Demo-2026!"}' \
  http://localhost:8000/api/v1/auth/login
```

Read the active services, then request slots using a returned service UUID and an inclusive date range:

```bash
curl http://localhost:8000/api/v1/organizations/demo-services/services

curl --get \
  --data-urlencode 'service_id=<service-uuid>' \
  --data-urlencode 'date_from=2026-08-29' \
  --data-urlencode 'date_to=2026-09-04' \
  http://localhost:8000/api/v1/organizations/demo-services/slots
```

For a cookie-authenticated mutation, copy the CSRF cookie into the matching header. Use service, staff, and start values returned by the service and slot requests:

```bash
CSRF_TOKEN=$(awk '$6 == "serviceops_csrf" {print $7}' /tmp/serviceops-customer-cookies.txt)

curl -i \
  -b /tmp/serviceops-customer-cookies.txt \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -H "X-CSRF-Token: ${CSRF_TOKEN}" \
  --data '{"service_id":"<service-uuid>","staff_profile_id":"<staff-uuid>","starts_at":"<UTC-slot-start>"}' \
  http://localhost:8000/api/v1/organizations/demo-services/bookings
```

Log in with `owner@serviceops.test` using a separate cookie jar to inspect filtered owner results. This read does not require a CSRF header:

```bash
curl -i \
  -c /tmp/serviceops-owner-cookies.txt \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  --data '{"email":"owner@serviceops.test","password":"ServiceOps-Demo-2026!"}' \
  http://localhost:8000/api/v1/auth/login

curl -b /tmp/serviceops-owner-cookies.txt \
  'http://localhost:8000/api/v1/organizations/demo-services/owner/bookings?status=requested'
```

Never reuse these local seed credentials or cookie files for an approved public deployment. The generated OpenAPI page remains the authority for complete request and response schemas.

## Organizations

### `GET /api/v1/organizations/{organization_slug}/members`

Returns members for the authorized organization. Requires an active owner membership. Staff and customers receive HTTP 403; users outside the organization receive HTTP 404 without revealing whether the organization exists.

## Services

### `GET /api/v1/organizations/{organization_slug}/services`

Publicly lists active services. Each item includes its duration and an optional display-only price in cents.

### Owner service routes

- `GET /api/v1/organizations/{organization_slug}/owner/services`
- `POST /api/v1/organizations/{organization_slug}/owner/services`
- `PATCH /api/v1/organizations/{organization_slug}/owner/services/{service_id}`
- `DELETE /api/v1/organizations/{organization_slug}/owner/services/{service_id}`

These routes require an owner membership. Delete is a soft deactivation so historical bookings retain their service relationship. Create, update, and delete require CSRF validation.

## Staff availability

Owner-only routes manage staff profiles, service assignments, weekly availability, and time off:

- `GET|POST /api/v1/organizations/{organization_slug}/owner/staff`
- `PATCH /api/v1/organizations/{organization_slug}/owner/staff/{staff_profile_id}`
- `GET|POST /api/v1/organizations/{organization_slug}/owner/staff/{staff_profile_id}/availability`
- `DELETE /api/v1/organizations/{organization_slug}/owner/staff/{staff_profile_id}/availability/{rule_id}`
- `GET|POST /api/v1/organizations/{organization_slug}/owner/staff/{staff_profile_id}/time-off`
- `DELETE /api/v1/organizations/{organization_slug}/owner/staff/{staff_profile_id}/time-off/{time_off_id}`

Weekdays use Python's `0 = Monday` through `6 = Sunday` convention. Weekly rule times are local to the organization; time-off ranges require timezone-aware timestamps.

## Slots

### `GET /api/v1/organizations/{organization_slug}/slots`

Public query parameters are `service_id`, `date_from`, and `date_to`. The inclusive range is limited to 31 days. Results combine active staff assignments and weekly availability, then subtract time off, active bookings, and past times. Each slot includes staff identity plus UTC `starts_at` and `ends_at` instants.

## Customer bookings

The following routes require a customer membership in the path organization. Mutations require the `serviceops_csrf` cookie value in `X-CSRF-Token`.

- `POST /api/v1/organizations/{organization_slug}/bookings`
- `GET /api/v1/organizations/{organization_slug}/bookings`
- `GET /api/v1/organizations/{organization_slug}/bookings/{booking_id}`
- `PATCH /api/v1/organizations/{organization_slug}/bookings/{booking_id}`
- `POST /api/v1/organizations/{organization_slug}/bookings/{booking_id}/cancel`

Create accepts `service_id`, `staff_profile_id`, timezone-aware `starts_at`, and optional `customer_note`. The server derives `ends_at` from the service duration. Rescheduling accepts a new `staff_profile_id` and timezone-aware `starts_at`. Only requested or confirmed bookings may be rescheduled or cancelled. Customer responses never contain `internal_note`.

## Owner bookings

### `GET /api/v1/organizations/{organization_slug}/owner/dashboard`

Requires an owner membership. The optional `period_days` query parameter accepts 1–90 days and defaults to 7. The inclusive period ends on the current date in the organization timezone. The response includes period and today counts, completion and cancellation metrics, counts by booking status and service, non-cancelled workload by staff member, and today's ordered schedule.

### `GET /api/v1/organizations/{organization_slug}/owner/bookings`

Requires an owner membership and returns organization bookings with customer, service, and staff summaries. Optional filters are `status`, `service_id`, `staff_profile_id`, `date_from`, and `date_to`. Date boundaries are interpreted in the organization timezone.

Additional owner operations:

- `GET /api/v1/organizations/{organization_slug}/owner/bookings/export` returns the filtered CSV and records the export request.
- `GET|PATCH /api/v1/organizations/{organization_slug}/owner/bookings/{booking_id}` reads or updates assignment and internal note details.
- `PATCH /api/v1/organizations/{organization_slug}/owner/bookings/{booking_id}/status` applies a valid status transition.
- `GET /api/v1/organizations/{organization_slug}/owner/customers` lists customer activity summaries.
- `GET /api/v1/organizations/{organization_slug}/owner/audit-logs` lists organization-scoped audit events with optional action and entity filters.

## Staff bookings

- `GET /api/v1/organizations/{organization_slug}/staff/bookings`
- `GET /api/v1/organizations/{organization_slug}/staff/bookings/{booking_id}`
- `PATCH /api/v1/organizations/{organization_slug}/staff/bookings/{booking_id}/status`

Staff reads are limited to the authenticated user's active staff profile and assigned bookings. Status changes require CSRF and follow the explicit state machine `requested → confirmed → in_progress → completed`, with cancellation allowed from requested or confirmed.

## Audit and CSV safety

Booking, service, staff, assignment, status, cancellation, internal-note, and CSV-export actions write organization-scoped audit entries. Audit metadata excludes credentials and note contents. CSV cells beginning with spreadsheet formula characters are prefixed safely before standard CSV quoting.

## Error conventions

- `401 authentication_required` — no valid access session
- `401 invalid_credentials` — login failed without account enumeration
- `403 csrf_failed` — CSRF cookie, header, or session binding did not match
- `403 role_forbidden` — membership exists but lacks the required role
- `404 organization_not_found` — organization is missing or not visible to the user
- `404 booking_not_found` — booking is missing or is not owned by the current customer
- `409 booking_conflict` — another active booking overlaps the requested staff interval
- `409 staff_unavailable` — time off blocks the requested interval
- `409 booking_not_reschedulable` or `booking_not_cancellable` — current status disallows the action
- `409 invalid_status_transition` — requested status is not a valid next state
- `409 booking_not_reassignable` — terminal or in-progress booking cannot be reassigned
- `422 booking_in_past` — requested start is not in the future
- `422 outside_availability` — interval does not fit a weekly availability rule
- `422 staff_service_mismatch` — selected staff is not assigned to the service
- `422 validation_error` — one or more request fields are invalid
- `429 login_rate_limited` — failed-login window exceeded

The error and validation envelopes are part of the API contract. Audit logs expose bounded `limit` and `offset` parameters, but owner booking results do not yet expose pagination and shared client-selectable sorting. That gap must be implemented or explicitly deferred before the MVP release tag.
