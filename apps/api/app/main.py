from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.booking_domain import router as booking_domain_router
from app.api.organizations import router as organizations_router
from app.api.system import router as system_router
from app.config import Settings, get_settings
from app.database import Database
from app.errors import install_error_handlers
from app.security import LoginRateLimiter


def create_app(settings: Settings | None = None, database: Database | None = None) -> FastAPI:
    runtime_settings = settings or get_settings()
    runtime_database = database or Database(runtime_settings.sqlalchemy_database_url)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        runtime_database.dispose()

    application = FastAPI(
        title="ServiceOps API",
        summary="Booking and operations API for small field-service teams.",
        version="0.5.0",
        docs_url="/docs",
        redoc_url=None,
        openapi_url="/api/v1/openapi.json",
        lifespan=lifespan,
    )
    application.state.settings = runtime_settings
    application.state.database = runtime_database
    application.state.login_rate_limiter = LoginRateLimiter(
        runtime_settings.login_rate_limit_attempts,
        runtime_settings.login_rate_limit_window_seconds,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(runtime_settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )
    install_error_handlers(application)
    application.include_router(system_router)
    application.include_router(auth_router)
    application.include_router(organizations_router)
    application.include_router(booking_domain_router)
    return application


app = create_app()
