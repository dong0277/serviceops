# ServiceOps Master Brief for ChatGPT Codex

## 0. Document Authority

This document is the single working brief for building ServiceOps with ChatGPT Codex.

It combines:

- The product and engineering requirements for ServiceOps
- The personal, non-commercial portfolio goal
- The reusable one-person development process
- The initial design-system strategy
- The GitHub, deployment, and database strategy

When instructions conflict, follow this priority:

1. Security, privacy, and explicit user approval requirements
2. The strategic decisions in Part A of this document
3. The detailed product acceptance criteria in Part B
4. Optional recommendations and future ideas

Do not silently change a decision. Record proposed changes as an ADR and ask for approval when the change affects scope, architecture, hosting cost, authentication, or production data.

---

# Part A. Strategy and Current Decisions

## 1. Project Goal

ServiceOps is not only a demo application. It has two purposes.

### Primary purpose: personal public developer reference

Create a credible, production-quality personal portfolio application that demonstrates how one developer can understand a product problem, design an appropriate workflow, implement the full stack, test it, document it, and deploy a convincing non-commercial demo.

### Secondary purpose: reusable delivery process

Use ServiceOps to establish a repeatable development process for future personal or open-source projects. Future projects will have different requirements, branding, and workflows. The reusable assets should eventually include:

- Repository and monorepo structure
- GitHub issue and pull-request workflow
- CI and quality gates
- Authentication and organization isolation patterns
- Shared design tokens and UI primitives
- Customer-facing and operations-facing layout patterns
- API error conventions
- Audit logging
- Test infrastructure
- Docker development environment
- Deployment documentation
- Product brief and case-study templates

Do not build a generic framework before ServiceOps itself is complete. First solve the real ServiceOps use cases. Extract only patterns that have been proven by actual use.

## 2. Working Model

This is a one-person project with active AI assistance.

Codex should behave as a careful implementation partner, not as an autonomous product owner.

Required behavior:

- Work in small, reviewable increments.
- State assumptions and decisions explicitly.
- Do not expand scope to make the application look more impressive.
- Do not replace business rules with UI-only behavior.
- Run relevant tests after meaningful changes.
- Prefer one complete vertical slice over many unfinished modules.
- Produce a preview and evidence before declaring a feature complete.
- Do not create accounts, paid resources, deployments, commits, or pushes without explicit approval.
- Do not use real customer, payment, or personal data.

## 3. Product Presentation Goal

The final public demo should let a portfolio visitor understand the product without reading the source code.

The primary demo story is:

1. A customer selects a service and books an available time.
2. A staff member sees the assigned booking and updates its status.
3. An owner sees the operational result in the dashboard, booking views, and audit log.
4. The owner filters and exports booking information safely.

The final portfolio should include:

- A concise landing page explaining the business problem
- Safe fictional demo data
- Clearly labeled customer, staff, and owner demo paths
- Screenshots and a short demo recording
- Architecture diagram
- Security and tenancy explanation
- Testing and CI evidence
- A concise engineering case study
- Clear non-goals and tradeoffs

## 4. Current Architecture Decisions

### 4.1 Repository

Use one GitHub monorepo for ServiceOps.

Initial structure:

```text
serviceops-platform/
├── apps/
│   ├── web/                  # Next.js application
│   └── api/                  # FastAPI application
├── packages/
│   ├── tokens/               # Semantic design tokens
│   ├── ui/                   # Shared web UI components and patterns
│   └── config/               # Shared frontend configuration if justified
├── docs/
│   ├── adr/
│   ├── architecture.md
│   ├── api.md
│   ├── design-system.md
│   ├── security.md
│   └── case-study.md
├── infra/
│   └── docker/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── workflows/
│   └── pull_request_template.md
├── docker-compose.yml
├── .env.example
├── Makefile
├── AGENTS.md
├── README.md
└── LICENSE
```

Keep the monorepo simple. Do not add Turborepo, Nx, or another orchestration framework unless normal package-manager workspaces and the Makefile are demonstrably insufficient.

The current working directory is the repository root; do not create another nested `serviceops-platform/` directory. Initialize it as a new Git repository and connect it to a repository owned by the developer's personal GitHub account only when explicitly approved.

Development occurs from two work locations. GitHub is the synchronization point for source code and documentation. Work that must move between locations must be committed and pushed to a branch; local stashes, `.env` files, database volumes, secrets, and build outputs must not be treated as portable project state. Both environments must be reproducible from tracked migrations, seed data, lockfiles, and documented setup commands.

Release the public repository under the MIT License.

### 4.2 Frontend and product surfaces

Use one Next.js application with route groups for the public, customer, staff, and owner surfaces.

```text
apps/web/app/
├── (public)/
├── (customer)/
├── (staff)/
└── (owner)/
```

Do not split the customer site and back office into separate applications at the beginning. Split them only if deployment, security boundaries, or independent release cycles later provide a concrete reason.

The web application must support internationalization from the beginning. Korean (`ko`) is the initial default locale, and English (`en`) must be supported without hard-coded user-facing copy. Use explicit locale-prefixed routes such as `/ko/...` and `/en/...`, centralized message keys, and locale-aware date, time, number, and timezone formatting. The architecture must allow English to become the default locale later without rewriting product screens or business logic.

### 4.3 Backend

Keep the custom FastAPI backend from the original brief.

Reasons include demonstrating:

- REST API design
- Secure authentication
- Role-based authorization
- Multi-tenant query scoping
- Relational modeling
- Transactional booking conflict handling
- State-machine enforcement
- Auditability
- Backend testing

Do not replace the FastAPI service with generated Supabase APIs.

### 4.4 Database

Use PostgreSQL.

Development starts with PostgreSQL in Docker Compose. The likely public-demo target is Supabase-hosted PostgreSQL, used as a managed database only.

Initial Supabase rule:

- PostgreSQL may be used.
- Supabase Auth should not be used initially.
- Supabase-generated REST APIs should not replace FastAPI.
- Supabase Edge Functions should not duplicate FastAPI business logic.
- Supabase Storage should be added only if a real file-storage requirement appears.

The local Docker environment must remain the reproducible baseline even if a hosted database is later connected.

Docker Desktop and Docker Compose must be available in both work locations. Do not synchronize local PostgreSQL volumes between locations; reconstruct development state from migrations and deterministic seed data.

### 4.5 Deployment

Local development and automated tests come first.

User decision (2026-08-28): public deployment is for a personal, non-commercial portfolio and must have no recurring hosting cost. The deployed product must not advertise paid services, solicit freelance work, collect payment, or imply that fictional field services will be fulfilled.

The likely public-demo deployment is:

```text
GitHub monorepo
├── Vercel Hobby project: apps/web
├── Vercel Hobby project: apps/api
└── Supabase Free project: PostgreSQL only
```

This remains provisional until a working vertical slice is deployed and the zero-cost limits are validated. Use the provider domains initially and do not purchase a custom domain. If Vercel Functions, free-tier terms, or database suspension create a real technical problem, document the evidence in an ADR and propose another zero-cost host. Do not switch hosting providers silently.

Normal test and build workflows must not depend on production credentials.

### 4.6 GitHub responsibilities

GitHub should provide:

- Source control
- Issues, milestones, and project tracking
- Small pull requests
- CI with GitHub Actions
- Lint, type-check, tests, and production builds
- Release tags and changelogs
- Static documentation or Storybook hosting with GitHub Pages when useful
- A future template repository after ServiceOps patterns are proven

GitHub is not the production API server or PostgreSQL database.

## 5. Initial Design-System Decision

A finished design system and a finished Figma library do not exist yet. This must not block the project.

### 5.1 Starting point

Use a code-first, thin ServiceOps design system based on:

- Tailwind CSS
- shadcn/ui component source
- Radix UI primitives where used by shadcn/ui
- Lucide icons
- Pretendard as the initial Korean-capable UI font
- ServiceOps semantic design tokens

This is a reversible starting decision, not a permanent corporate design-system commitment.

### 5.2 One system, two experience profiles

Do not create two independent design systems for the customer experience and the back office.

Use one foundation and primitive layer, then distinguish the surfaces through themes, density, layouts, and patterns.

```text
ServiceOps Design System
├── Foundation
│   ├── Color
│   ├── Typography
│   ├── Spacing
│   ├── Radius
│   ├── Shadow
│   └── Motion
├── Shared primitives
│   ├── Button
│   ├── Input
│   ├── Select
│   ├── Card
│   ├── Badge
│   ├── Dialog
│   └── Toast
├── Customer patterns
│   ├── ServiceCard
│   ├── SlotPicker
│   ├── BookingStepper
│   └── BottomCTA
└── Operations patterns
    ├── DataTable
    ├── FilterBar
    ├── MetricCard
    ├── Calendar
    └── AuditTimeline
```

Customer profile:

- Comfortable density
- Mobile-first layouts
- Stronger brand emphasis
- Simple task-focused navigation

Operations profile:

- Compact density
- Desktop-oriented layouts
- Neutral surfaces
- Tables, filters, states, and side navigation

### 5.3 Initial product character

Use these temporary design attributes:

- Trustworthy
- Calm
- Efficient

Start with a neutral palette and one accent color. Do not spend time creating a final brand identity before the main flows work.

### 5.4 Minimum initial components

Begin with only the components required for the design spike and first booking slice:

- Button
- Input
- Select
- Card
- Badge
- Dialog
- Toast
- PageHeader

Add Calendar, TimeSlotButton, DataTable, MetricCard, and other patterns only when an implemented flow requires them.

### 5.5 Figma policy

Figma is useful but not a prerequisite for starting the implementation.

Initial Figma use should be limited to:

- User-flow diagrams
- Comparing layouts for three key screens
- Finalizing color and typography decisions
- Refining important screens for portfolio presentation

Do not attempt to design every component and state in Figma before coding.

The three design-spike screens are:

1. Customer mobile service and slot-selection flow
2. Owner desktop booking-list screen
3. Owner dashboard

Figma should eventually record stable tokens and components, but only after they have been exercised in real ServiceOps screens.

### 5.6 Storybook and design-system website

Do not build a custom design-system website now.

Add Storybook after approximately 8 to 10 components are stable and used by real screens. Stories should live next to components. A static Storybook build may later be published through GitHub Pages.

## 6. Development Process

### Phase 0A: inspect and plan

- Inspect only the current repository.
- Summarize existing files and useful work.
- State assumptions.
- Create a short implementation plan.
- Identify blockers without expanding scope.

### Phase 0B: architecture decisions

Create or update these ADRs before major implementation:

```text
docs/adr/001-monorepo.md
docs/adr/002-single-design-system.md
docs/adr/003-authentication.md
docs/adr/004-database-and-tenancy.md
docs/adr/005-deployment.md
```

### Phase 0C: design spike

Implement the three key screens using temporary fictional data and the minimum UI foundation.

Goals:

- Verify that one design system can support customer and operations screens.
- Verify responsive behavior.
- Verify basic accessibility and focus behavior.
- Validate semantic tokens and density choices.
- Record missing components instead of inventing inconsistent one-off styles.

The design spike is not production functionality. Do not build the entire component library during this phase.

### Milestone 0: engineering scaffold

- Establish the monorepo.
- Add Docker Compose, environment templates, linting, formatting, and baseline CI.
- Add health and readiness endpoints.
- Add an initial README.
- Ensure baseline commands run successfully.

### Milestone 1: first end-to-end vertical slice

Build one complete flow before implementing every table and page:

```text
Customer sees services
→ selects a date and time
→ creates a booking
→ sees confirmation
→ owner sees the booking
```

Include the minimum database, authentication, API, UI, and deterministic tests required for this flow.

A slice is not complete until:

- Business rules are enforced by the API.
- The UI handles loading, empty, success, and error states.
- Relevant tests pass.
- The preview is reviewable.
- No unrelated modules are half-built.

### Milestone 2: domain correctness

Prioritize the engineering qualities that make ServiceOps credible as a senior full-stack engineering reference:

- Organization isolation
- Role-based authorization
- Atomic booking conflict prevention
- Valid status transitions
- UTC storage and organization timezone display
- Audit logging
- Internal-note protection
- CSV formula-injection protection
- Concurrent booking tests

### Milestone 3: staff and owner operations

Add staff workflows and owner management only after the vertical slice and domain rules are stable.

### Milestone 4: frontend completion

Complete customer, staff, and owner pages, operational patterns, responsive states, accessibility, and end-to-end tests.

### Milestone 5: personal public portfolio and deployment

- Configure safe demo data and demo-role entry paths.
- Deploy preview and production environments only with approval.
- Add screenshots and a short demo recording.
- Complete README and case study.
- Verify a clean checkout.
- Tag the MVP only when the acceptance criteria pass.

### Milestone 6: reusable template extraction

This is post-MVP work.

After ServiceOps is stable, extract proven generic pieces into a separate project starter. Do not move ServiceOps-specific booking logic into the generic template.

Potential template contents:

- Repository structure
- CI workflows
- Authentication/session pattern
- Organization and role pattern
- Design tokens and shared UI primitives
- Customer and operations layouts
- CRUD conventions
- Audit log pattern
- Docker environment
- Playwright configuration
- Documentation templates

## 7. GitHub Workflow

Use a simple project board:

```text
Backlog
Ready
In Progress
AI Review
Human Review
Done
```

Each meaningful change should have:

- A focused issue or task statement
- Acceptance criteria
- A small branch or worktree when approved
- A small pull request when approved
- Tests relevant to the change
- A summary of files changed and risks

Recommended CI gates:

- Backend lint and formatting check
- Backend tests
- Frontend lint
- TypeScript type-check
- Frontend tests when meaningful
- Production build
- Critical Playwright tests

Do not lower lint, type, security, or test standards to make CI pass.

## 8. Explicit Non-Goals for the Initial Build

Do not add these merely to demonstrate technology:

- Two independent design systems
- Separate customer and admin frontend applications
- A custom design-system documentation website
- A generic SaaS framework before ServiceOps is complete
- Supabase Auth alongside custom FastAPI authentication
- Duplicate business logic in Supabase Edge Functions
- Real payments
- Real customer data
- Native mobile applications
- Chat, messaging, or AI features inside ServiceOps
- Paid deployment resources without approval

AI is part of the development process, not an in-product ServiceOps feature.

---

# Part B. Detailed Product and Engineering Specification

The following baseline specification remains binding unless Part A explicitly supersedes a recommendation. Product scope, security rules, tests, and acceptance criteria should be preserved.

## 1. Your Role

Act as a senior full-stack engineer building a production-quality personal, non-commercial public portfolio project.

Build **ServiceOps**, a web-based booking and operations platform for small field-service businesses such as cleaners, repair technicians, personal trainers, tutors, and beauty-service providers.

The project must serve as a credible intermediate-to-senior full-stack engineering reference. Prioritize a complete, testable, documented MVP over a large unfinished feature set.

Work autonomously within this specification. If the repository is not empty, inspect it before changing anything and preserve useful existing work. Do not inspect or depend on any unrelated repositories.

## 2. Product Goal

ServiceOps lets:

- Customers browse services and available times, create bookings, and manage their own bookings.
- Staff view assigned work and update booking status.
- Owners manage services, staff, customers, bookings, and basic operational reporting.

The MVP should demonstrate:

- Full-stack web development
- Authentication and role-based authorization
- Relational data modeling
- Booking conflict handling
- REST API design
- Responsive UI
- Admin dashboard development
- Auditability and secure engineering practices
- Automated testing and CI

## 3. Scope Rules

### In scope

- Responsive web application
- Customer, staff, and owner roles
- Organization-ready database design
- Service management
- Staff availability
- Booking, rescheduling, cancellation, and status updates
- Admin calendar/list views
- Basic dashboard metrics
- CSV export
- Audit log
- Seeded demo data
- Local Docker environment
- Automated tests
- GitHub Actions CI
- Public-repository documentation

### Explicitly out of scope

Do not add these to the MVP:

- Real payment processing
- Real customer or financial data
- Chat or messaging
- AI features
- Marketplace or multi-vendor settlement
- Accounting, payroll, or invoicing
- Native Android or iOS applications
- Complex route optimization
- Complex recurring bookings
- Third-party OAuth
- SMS delivery
- Paid cloud resources

If a payment concept is needed in the UI, use a clearly labeled fake/test payment adapter. Never require a real card or production account.

## 4. Recommended Technology Stack

### Frontend

- Next.js with App Router
- TypeScript in strict mode
- Tailwind CSS
- React Hook Form
- Zod
- Accessible, reusable UI components

### Backend

- Python 3.12+
- FastAPI
- Pydantic v2
- SQLAlchemy 2
- Alembic migrations
- PostgreSQL

### Quality and operations

- Pytest for backend tests
- Playwright for critical end-to-end flows
- Frontend unit tests where they add meaningful value
- Docker Compose for local development
- Ruff for Python linting and formatting
- ESLint and Prettier for TypeScript
- GitHub Actions for lint, type-check, test, and build

Use current stable versions and record the exact versions in the repository. Do not introduce a large framework or dependency unless it solves a concrete requirement.

## 5. Repository Structure

Use a simple monorepo structure similar to:

```text
serviceops-platform/
├── apps/
│   ├── web/                 # Next.js frontend
│   └── api/                 # FastAPI backend
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── security.md
│   └── case-study.md
├── infra/
│   └── docker/
├── .github/
│   └── workflows/
├── docker-compose.yml
├── .env.example
├── Makefile
├── README.md
└── LICENSE
```

Adjust this only when there is a clear technical reason. Keep local startup straightforward.

## 6. Roles and Permissions

### Customer

- Register and log in
- Browse active services
- View available booking slots
- Create a booking
- View only their own bookings
- Reschedule or cancel their own eligible bookings

### Staff

- View bookings assigned to them
- View the operational details needed to perform the job
- Change allowed booking statuses
- Cannot manage organization settings, services, or other staff

### Owner

- Full access within their organization
- Manage services and staff
- View and manage all organization bookings
- Assign or reassign staff
- View customers
- View dashboard metrics
- Export bookings to CSV
- View audit logs

All authorization must be enforced by the API. Hiding a UI element is not authorization.

## 7. Core User Flows

### Customer booking flow

1. Customer creates an account or logs in.
2. Customer selects a service.
3. Customer selects a date and available time slot.
4. Customer submits a booking.
5. The server validates availability and prevents overlapping bookings.
6. Customer receives a confirmation screen and can view the booking in booking history.

### Customer rescheduling flow

1. Customer opens an eligible future booking.
2. Customer chooses another available slot.
3. The API checks for conflicts within a transaction.
4. The change is saved and added to status/history and audit records.

### Staff workflow

1. Staff logs in and sees assigned bookings.
2. Staff opens a booking.
3. Staff changes status through valid transitions.
4. The system records who made the change and when.

### Owner workflow

1. Owner opens the admin dashboard.
2. Owner views bookings in list and calendar-oriented views.
3. Owner filters by date, service, staff, and status.
4. Owner manages services and staff assignments.
5. Owner exports filtered booking data to CSV.

## 8. Booking Status Model

Use a small, explicit state machine:

```text
requested -> confirmed -> in_progress -> completed
requested -> cancelled
confirmed -> cancelled
```

Do not permit invalid transitions. Enforce the transition rules in the backend and cover them with tests.

## 9. Initial Data Model

Use UUID primary keys and UTC timestamps. Display times in the organization timezone.

### organizations

- id
- name
- slug
- timezone
- created_at
- updated_at

### users

- id
- email
- password_hash
- display_name
- is_active
- created_at
- updated_at

### memberships

- id
- organization_id
- user_id
- role: `owner`, `staff`, or `customer`
- created_at

Use a uniqueness constraint on `(organization_id, user_id)`.

### services

- id
- organization_id
- name
- description
- duration_minutes
- price_display_cents, optional and explicitly non-billing
- is_active
- created_at
- updated_at

### staff_profiles

- id
- organization_id
- user_id
- display_name
- is_active
- created_at
- updated_at

### staff_services

- staff_profile_id
- service_id

### availability_rules

- id
- organization_id
- staff_profile_id
- weekday
- start_local_time
- end_local_time

Keep recurring availability limited to simple weekly rules.

### time_off

- id
- organization_id
- staff_profile_id
- starts_at
- ends_at
- reason, optional

### bookings

- id
- organization_id
- customer_user_id
- staff_profile_id
- service_id
- starts_at
- ends_at
- status
- customer_note, optional
- internal_note, optional and never exposed to customers
- created_at
- updated_at
- cancelled_at, optional

### booking_status_history

- id
- booking_id
- previous_status, optional
- new_status
- changed_by_user_id
- changed_at

### audit_logs

- id
- organization_id
- actor_user_id, optional
- action
- entity_type
- entity_id
- metadata_json
- created_at

### refresh_tokens or sessions

Create only the tables required by the selected secure authentication design.

Every organization-owned query must be scoped by `organization_id`.

## 10. Booking and Availability Rules

- Store timestamps in UTC.
- Store each organization's IANA timezone.
- Generate available slots from weekly availability minus time off and existing bookings.
- A booking must fit entirely inside an availability window.
- Prevent overlapping active bookings for the same staff member.
- Perform conflict detection and insertion/update atomically.
- Cancelled bookings do not block availability.
- Reject booking or rescheduling into the past.
- Return useful structured validation errors.
- Add integration tests for concurrent or near-concurrent booking attempts.

## 11. Authentication and Security

Choose and document a secure authentication design appropriate for Next.js plus FastAPI.

Requirements:

- Hash passwords with Argon2id or another current recommended password hash.
- Use short-lived access tokens or server sessions.
- If refresh tokens are used, rotate and revoke them appropriately.
- Do not store long-lived sensitive tokens in `localStorage`.
- Use secure, HTTP-only cookies where appropriate.
- Protect state-changing cookie-authenticated requests from CSRF.
- Validate all API input.
- Enforce authorization in service/API code.
- Rate-limit login attempts.
- Never commit secrets.
- Supply a complete `.env.example` containing placeholders only.
- Avoid leaking whether an account exists during authentication and reset flows.
- Do not log passwords, tokens, or sensitive fields.
- Document the threat model and remaining limitations in `docs/security.md`.

Password reset email delivery is not required. If a reset flow is added, use a local development mail catcher only.

## 12. REST API

Use versioned routes under `/api/v1` and generate OpenAPI documentation.

The exact route names may vary, but cover these capabilities:

### System

- `GET /health`
- `GET /ready`

### Authentication

- Register
- Log in
- Refresh session/token
- Log out
- Get current user and memberships

### Public/customer

- List active services
- List available slots for a service and date range
- Create booking
- List current customer's bookings
- Get current customer's booking
- Reschedule eligible booking
- Cancel eligible booking

### Staff

- List assigned bookings
- Get assigned booking
- Update booking status through allowed transitions

### Owner

- CRUD services
- List and manage staff
- List all bookings with filters and pagination
- Assign/reassign staff
- Update booking status
- View customers
- View dashboard summary
- Export filtered bookings as CSV
- List audit logs

Use consistent pagination, filtering, sorting, validation-error, and authorization-error formats.

## 13. Required Web Pages

### Public/customer

- Landing page with a concise product explanation
- Register
- Login
- Service list
- Availability/slot picker
- Booking confirmation
- Customer booking list
- Customer booking detail

### Staff

- Assigned booking list
- Booking detail with valid status actions

### Owner/admin

- Dashboard
- Booking list
- Calendar-oriented booking view
- Booking detail/edit view
- Service management
- Staff management
- Customer list
- Audit log

### General UI requirements

- Responsive from mobile to desktop
- Keyboard accessible
- Visible focus states
- Proper labels and error summaries
- Loading, empty, success, and failure states
- Confirmation before destructive actions
- Clear timezone display
- No fake buttons or unfinished navigation in the final MVP

## 14. Dashboard Metrics

Keep reporting intentionally simple:

- Bookings today
- Bookings in the selected period
- Count by status
- Count by service
- Staff workload count
- Cancellation count or rate

Do not implement financial reporting because no real payment system exists.

## 15. CSV Export

Owner can export filtered bookings. Include:

- Booking ID
- Start and end time
- Timezone
- Status
- Service name
- Staff name
- Customer display name
- Customer email
- Created timestamp

Escape CSV values correctly and prevent formula injection by sanitizing cells beginning with spreadsheet formula characters.

## 16. Audit Logging

At minimum record:

- Service created, updated, or deactivated
- Staff added, updated, or deactivated
- Booking created
- Booking rescheduled
- Staff assignment changed
- Booking status changed
- Booking cancelled
- CSV export requested

Audit metadata must not contain passwords, raw tokens, or unnecessary personal information.

## 17. Demo Data

Provide a seed command that creates:

- One demo organization
- One owner
- Two staff members
- Several customers
- Three services with different durations
- Weekly staff availability
- A mixture of past and upcoming bookings in different statuses

Use `.test` email addresses and obviously fictional names. Demo credentials may be documented for local use only and must never be reused as production defaults.

## 18. Testing Requirements

### Backend unit and integration tests

Cover at least:

- Registration and login
- Password hashing
- Authentication failure
- Organization isolation
- Role-based authorization
- Service CRUD authorization
- Availability generation
- Booking conflict prevention
- Rescheduling conflict prevention
- Cancellation behavior
- Valid and invalid status transitions
- Internal notes not exposed to customers
- CSV export authorization and formula-injection protection
- Audit log creation

### End-to-end tests

Cover at least:

1. Customer registers and creates a booking.
2. Customer views and cancels an eligible booking.
3. Staff views an assigned booking and advances its status.
4. Owner creates a service and filters bookings.
5. Unauthorized user cannot open owner pages or APIs.

Tests must be deterministic. Do not depend on external services or production credentials.

## 19. Developer Experience

The project should support commands similar to:

```bash
cp .env.example .env
docker compose up --build
make migrate
make seed
make test
```

Provide a useful `Makefile` or equivalent task runner for:

- setup
- start
- stop
- migrate
- seed
- lint
- type-check
- test
- e2e
- build

A new developer should be able to run the application locally by following the README without guessing missing steps.

## 20. CI Requirements

GitHub Actions must run on pull requests and the default branch:

- Backend lint and formatting check
- Backend tests
- Frontend lint
- TypeScript type-check
- Frontend tests, if present
- Production build
- Critical Playwright tests using service containers or Docker where practical

Cache dependencies where safe. The CI workflow must not require repository secrets for the normal test suite.

## 21. Documentation for a Public Portfolio

### README.md

The README should contain:

- One-paragraph product description
- Key capabilities
- Screenshots or clearly marked screenshot placeholders until captured
- Architecture summary and diagram
- Technology stack
- Local setup commands
- Demo data instructions
- Test commands
- Security notes
- Scope and non-goals
- Main design decisions and tradeoffs
- Roadmap containing only realistic future work

### docs/architecture.md

Document:

- Component diagram
- Request flow
- Authentication flow
- Organization isolation
- Availability generation
- Booking conflict strategy
- Error-handling conventions

### docs/api.md

Link to generated OpenAPI docs and provide example requests for major flows.

### docs/security.md

Document implemented controls, assumptions, threat model, and known limitations.

### docs/case-study.md

Write this like a concise engineering case study:

- Product problem statement
- Requirements and constraints
- Architecture choice
- Difficult implementation problems
- Testing strategy
- Security and privacy decisions
- What was deliberately excluded
- Outcome and possible next phase

## 22. Implementation Milestones

### Milestone 0: Plan and scaffold

- Inspect existing repository contents.
- State assumptions without expanding scope.
- Create the monorepo structure.
- Add Docker Compose, environment templates, linting, and baseline CI.
- Add health/readiness endpoints.
- Add an initial README.

### Milestone 1: Database, authentication, and tenancy

- Implement models and migrations.
- Implement secure authentication.
- Implement organization memberships and role checks.
- Add seed data.
- Add authentication and authorization tests.

### Milestone 2: Services, availability, and bookings

- Implement service management.
- Implement staff availability and time off.
- Implement slot calculation.
- Implement customer booking, rescheduling, and cancellation.
- Implement atomic conflict prevention.
- Add comprehensive booking tests.

Implementation record (2026-08-28): completed with service CRUD, staff profiles and service assignments, weekly availability, time off, public slot calculation, customer create/list/detail/reschedule/cancel APIs, an owner booking-list API, PostgreSQL exclusion-constraint conflict protection, deterministic domain seed data, and PostgreSQL integration/concurrency tests. Customer and owner booking-list screens now use these APIs. Staff operational status transitions, audit logs, CSV export, and broader owner operations remain Milestone 3 scope.

### Milestone 3: Staff and owner operations

- Implement assigned-work views.
- Implement status transitions.
- Implement owner booking management and filters.
- Implement staff and customer views.
- Implement audit logs and CSV export.

Implementation record (2026-08-28): completed with staff-assigned booking list/detail APIs and UI, explicit backend-enforced status transitions, owner booking detail/reassignment/internal-note management, customer and team views, organization-scoped audit logs, and filtered CSV export with spreadsheet formula-injection protection. Service, staff, booking, assignment, status, cancellation, note, and export events are recorded without credential or note contents. PostgreSQL integration coverage now includes 20 tests across authentication, tenancy, booking conflicts, role isolation, transitions, audit records, customer summaries, and CSV sanitization.

### Milestone 4: Dashboard and frontend completion

- Complete responsive customer, staff, and owner pages.
- Add loading, empty, success, and failure states.
- Add dashboard metrics and calendar-oriented booking view.
- Complete E2E tests.

Implementation record (2026-08-28): completed with an owner-only organization-scoped dashboard aggregation API and responsive Korean/English dashboard, a filterable desktop month calendar with a mobile agenda and booking detail panel, live owner service creation/editing/deactivation/reactivation, completed loading/empty/success/authorization/failure states, keyboard dismissal and focus-visible treatment, and removal of non-functional owner navigation. Playwright now covers the five required cross-role flows against the seeded Docker stack—customer registration and booking, staff status progression, customer cancellation, owner service creation and booking filtering, and owner UI/API access denial for a customer—plus a mobile English localization and horizontal-overflow smoke check. Backend integration coverage is 21 tests, and CI runs the critical browser suite in addition to lint, type checking, builds, and container checks.

### Milestone 5: Portfolio polish

- Resolve lint, type, test, accessibility, and build failures.
- Complete documentation.
- Add screenshots or a short demo capture when the UI is stable.
- Verify setup from a clean checkout.
- Tag a clear MVP release only after all acceptance criteria pass.

Progress record (2026-08-28): completed the first quality slice with an automated WCAG 2.0/2.1 A/AA axe baseline across representative public, customer, staff, and owner routes; keyboard focus trapping, Escape dismissal, trigger focus restoration, skip links, accessible names, calendar date labels, and contrast corrections; and responsive overflow coverage. `make e2e` now builds and seeds a dedicated temporary Docker Compose project with isolated ports, origin configuration, and PostgreSQL volume, then removes all test resources on exit so the development database is not mutated. Accessibility scope and remaining manual assistive-technology checks are documented in `docs/accessibility.md`. Clean-checkout verification, stable UI captures, case-study completion, deployment approval, and the release tag remain open.

Clean-checkout record (2026-08-28): cloned public `origin/main` at `5f47a49` into a new temporary directory, installed locked JavaScript and Python dependencies, built the production Docker images, applied migrations, seeded fictional data, verified API health/readiness and Korean/English routes, signed in through a real browser, and exercised the owner dashboard, calendar, service, and booking surfaces. Lint, strict type checking, the production build, 21 backend tests, and 10 isolated Playwright accessibility/critical-flow tests passed. The check exposed that a customized `.env` `TEST_POSTGRES_PORT` reached Docker Compose but not the host pytest URL; `make test` now discovers Docker's actual published test-database port and stops the test container on success, interruption, or failure. Stable UI captures, case-study completion, manual assistive-technology review, deployment approval, and the release tag remain open.

Portfolio progress record (2026-08-28): added a reproducible `make portfolio-captures` workflow that builds an isolated seeded Docker project, captures English customer, staff, dashboard, and calendar views, and removes its temporary database on exit. The generated portfolio images are linked from the README and the concise engineering-focused `docs/case-study.md`. Visual review exposed and corrected a dashboard insight-card background conflict. Reduced-motion and forced-colors focus treatment plus 200%-equivalent reflow coverage were added and recorded in `docs/accessibility.md`. Human VoiceOver/additional screen-reader and physical touch-target review, deployment approval, and the release tag remain open.

Touch-target review record (2026-08-28): measured every visible interactive element across the full 390 × 844 customer booking, staff assigned-work, and owner dashboard pages. The shared language selector and four compact text links measured 16–20 CSS pixels high; their hit areas now measure 40–44 pixels. A Playwright regression guard rejects representative visible interactive targets smaller than 24 CSS pixels, and all 12 isolated accessibility and critical-flow tests pass. `docs/manual-accessibility-review.md` now provides route-by-route VoiceOver, second-screen-reader, physical-device, findings, and retest procedures. Human auditory review and physical-device ergonomics confirmation, deployment approval, and the release tag remain open.

Demo capture record (2026-08-28): added a reproducible `make portfolio-demo` workflow that uses the isolated fictional seed environment to capture an English customer request, staff confirmation, owner dashboard, and booking calendar sequence. The optimized looping GIF is embedded in the README and case study; ImageMagick is the only additional local capture dependency. Human accessibility review, deployment approval, and the release tag remain open.

Non-commercial portfolio review record (2026-08-28): confirmed that the repository contains no personal contact solicitation, hiring CTA, advertising, affiliate link, donation request, payment integration, or real card flow. Reframed the project and case study as a personal, non-commercial engineering portfolio; added an explicit fictional-data/no-sale/no-fulfillment/no-payment notice to every Korean and English route and to page metadata; removed wording that implied real visits, price inquiries, public production registration, client acquisition, or freelance solicitation; and recorded the zero-recurring-cost deployment constraint. All four portfolio screenshots and the eight-frame GIF were regenerated from English routes. Formatting, lint, strict type checking, the production build, and all 12 isolated accessibility and critical-flow browser tests pass.

## 23. Acceptance Criteria

The MVP is complete only when all of these are true:

- A clean checkout can be started locally using documented commands.
- Database migrations and seed data work without manual editing.
- Customer, staff, and owner demo flows work end to end.
- Customers cannot access other customers' bookings.
- Users cannot access data from another organization.
- Staff cannot use owner-only operations.
- Active bookings for the same staff member cannot overlap.
- Invalid booking-status transitions are rejected.
- Internal notes are never exposed to customers.
- CSV export is authorized and protected against formula injection.
- Important mutations generate audit records.
- No real credentials, cards, or personal data are required.
- No secrets are committed.
- Lint, type-check, tests, and production builds pass locally and in CI.
- README and architecture, API, security, and case-study documents are complete.
- The final UI contains no obvious placeholder actions or broken navigation.

## 24. Engineering Guidelines for Codex

- Do not silently add features outside this brief.
- Prefer simple, explicit code over premature abstractions.
- Keep business rules in testable backend service modules, not route handlers.
- Keep database access organization-scoped.
- Use migrations for every schema change.
- Avoid duplicated validation rules where a shared contract can be generated or documented.
- Return structured errors that the frontend can render meaningfully.
- Run relevant tests after each meaningful change.
- Fix failures instead of disabling checks.
- Do not weaken TypeScript, lint, or test settings to make CI pass.
- Do not commit generated secrets, local database files, build outputs, or dependency directories.
- Do not perform paid deployments or create external accounts without the user's explicit approval.
- Do not create Git commits, push branches, or modify remote repositories unless the user explicitly asks.
- At the end of each milestone, report:
  - What was implemented
  - Files or modules changed
  - Commands run
  - Test results
  - Remaining risks or decisions
  - The next milestone

## 25. Start Instruction

Begin with **Part A, Phase 0A**.

1. Inspect only the current repository contents.
2. Summarize what already exists and preserve useful work.
3. State assumptions and unresolved decisions.
4. Produce a short plan covering the architecture ADRs, design spike, and Milestone 0 scaffold.
5. Do not create external accounts, deployments, Git commits, or remote changes without explicit approval.
6. If the repository is empty, scaffold only what is required for the agreed architecture.
7. Run baseline lint, type-check, test, and build commands that exist or are introduced.
8. Report implemented work, files changed, commands run, test results, remaining risks, and the proposed next step.

Do not begin broad feature implementation until the initial inspection, ADR plan, and three-screen design-spike plan have been reported.
