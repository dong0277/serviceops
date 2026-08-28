SHELL := /bin/sh

.PHONY: setup install start stop logs dev-web dev-api lint format type-check test build migrate seed

setup:
	@test -f .env || cp .env.example .env
	@$(MAKE) install

install:
	pnpm install --frozen-lockfile
	cd apps/api && uv sync --locked

start:
	docker compose up --build -d

stop:
	docker compose down

logs:
	docker compose logs --follow

dev-web:
	pnpm dev

dev-api:
	cd apps/api && uv run --locked uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

lint:
	cd apps/api && uv run --locked ruff check .
	cd apps/api && uv run --locked ruff format --check .
	pnpm lint

format:
	cd apps/api && uv run --locked ruff check --fix .
	cd apps/api && uv run --locked ruff format .
	pnpm format

type-check:
	cd apps/api && uv run --locked mypy app tests
	pnpm type-check

test:
	docker compose --profile test up -d --wait postgres-test
	cd apps/api && TEST_DATABASE_URL=postgresql+psycopg://serviceops_test:serviceops-test-only@127.0.0.1:$${TEST_POSTGRES_PORT:-5433}/serviceops_test uv run --locked pytest
	docker compose --profile test stop postgres-test

build:
	pnpm build

migrate:
	cd apps/api && uv run --locked alembic upgrade head

seed:
	cd apps/api && uv run --locked python -m app.seed
