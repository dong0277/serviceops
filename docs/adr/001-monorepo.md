# ADR 001: ServiceOps monorepo and Git workflow

- Status: Accepted
- Date: 2026-08-28

## Context

ServiceOps contains a Next.js frontend, a FastAPI backend, shared frontend packages, infrastructure, tests, and public documentation. One developer works from two locations and needs the project to remain reproducible and continuously available from either environment.

## Decision

- Use the current `serviceops` directory as the root of one Git monorepo. Do not add a nested `serviceops-platform` directory.
- Keep `apps/web`, `apps/api`, `packages`, `docs`, and `infra` in the same repository.
- Use the developer's personal GitHub account as the remote owner. The approved public repository is `dong0277/serviceops`; commits, pushes, and other remote mutations still require explicit approval at the time they are performed.
- Use small feature branches and GitHub as the synchronization point between work locations.
- Before changing locations, commit and push portable work. A local stash is not a synchronization mechanism.
- Reproduce dependencies and development data from lockfiles, migrations, seed commands, and documentation.
- Never commit `.env` files, secrets, database volumes, dependency directories, or build outputs.
- License the public project under the MIT License.
- Start with ordinary package-manager workspaces and a Makefile. Do not add Turborepo or Nx without evidence that the simple setup is insufficient.

## Consequences

- Frontend, backend, CI, documentation, and shared UI changes can be reviewed together.
- Each work location needs its own toolchain and Docker environment.
- Uncommitted work is not automatically available at the other location.
- Database state must be recreated rather than copied between machines.

## Resolved follow-up decisions

- The repository is public and licensed under MIT.
- pnpm is the workspace package manager and is pinned through `packageManager` and `pnpm-lock.yaml`.
- A clean clone from `origin/main` has passed locked dependency installation, Docker build/start, migrations, seed, health, localized-route, browser, lint, type-check, backend-test, E2E, and production-build verification.
