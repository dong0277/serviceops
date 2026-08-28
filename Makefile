SHELL := /bin/sh

.PHONY: setup install start stop logs dev-web dev-api lint format type-check test e2e portfolio-captures build migrate seed

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
	@set -eu; \
	cleanup() { docker compose --profile test stop postgres-test >/dev/null 2>&1 || true; }; \
	trap cleanup EXIT HUP INT TERM; \
	docker compose --profile test up -d --wait postgres-test; \
	test_postgres_binding=$$(docker compose --profile test port postgres-test 5432); \
	test_postgres_port=$${test_postgres_binding##*:}; \
	(cd apps/api && TEST_DATABASE_URL="postgresql+psycopg://serviceops_test:serviceops-test-only@127.0.0.1:$$test_postgres_port/serviceops_test" uv run --locked pytest)

e2e:
	@set -eu; \
	project=serviceops-e2e; \
	web_port=$${E2E_WEB_PORT:-13000}; \
	api_port=$${E2E_API_PORT:-18000}; \
	postgres_port=$${E2E_POSTGRES_PORT:-15432}; \
	cleanup() { docker compose -p "$$project" down -v --remove-orphans >/dev/null; }; \
	trap cleanup EXIT INT TERM; \
	export WEB_PORT="$$web_port" API_PORT="$$api_port" POSTGRES_PORT="$$postgres_port"; \
	export CORS_ALLOWED_ORIGINS="http://127.0.0.1:$$web_port,http://127.0.0.1:$$api_port"; \
	export NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:$$api_port"; \
	docker compose -p "$$project" up --build -d --wait; \
	docker compose -p "$$project" exec -T api /app/.venv/bin/python -m app.seed; \
	status=0; \
	E2E_BASE_URL="http://127.0.0.1:$$web_port" E2E_API_URL="http://127.0.0.1:$$api_port" pnpm --filter @serviceops/web e2e || status=$$?; \
	if [ "$$status" -ne 0 ]; then docker compose -p "$$project" logs --no-color; fi; \
	exit "$$status"

portfolio-captures:
	@set -eu; \
	project=serviceops-portfolio; \
	web_port=$${PORTFOLIO_WEB_PORT:-13010}; \
	api_port=$${PORTFOLIO_API_PORT:-18010}; \
	postgres_port=$${PORTFOLIO_POSTGRES_PORT:-15440}; \
	cleanup() { docker compose -p "$$project" down -v --remove-orphans >/dev/null; }; \
	trap cleanup EXIT HUP INT TERM; \
	export WEB_PORT="$$web_port" API_PORT="$$api_port" POSTGRES_PORT="$$postgres_port"; \
	export CORS_ALLOWED_ORIGINS="http://127.0.0.1:$$web_port,http://127.0.0.1:$$api_port"; \
	export NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:$$api_port"; \
	docker compose -p "$$project" up --build -d --wait; \
	docker compose -p "$$project" exec -T api /app/.venv/bin/python -m app.seed; \
	PORTFOLIO_BASE_URL="http://127.0.0.1:$$web_port" pnpm --filter @serviceops/web capture:portfolio

build:
	pnpm build

migrate:
	cd apps/api && uv run --locked alembic upgrade head

seed:
	cd apps/api && uv run --locked python -m app.seed
