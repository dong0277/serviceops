from typing import Literal

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

from app.database import Database

router = APIRouter(tags=["system"])


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "serviceops-api"
    version: str = "0.4.0"


class ReadinessChecks(BaseModel):
    configuration: Literal["ok"] = "ok"
    database: Literal["ok", "error"]


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    checks: ReadinessChecks


@router.get("/health", response_model=HealthResponse, summary="Liveness check")
async def health() -> HealthResponse:
    """Report that the API process is running."""
    return HealthResponse()


@router.get("/ready", response_model=ReadinessResponse, summary="Readiness check")
def ready(request: Request, response: Response) -> ReadinessResponse:
    """Report configuration and database connectivity readiness."""
    database: Database = request.app.state.database
    try:
        database.ping()
    except SQLAlchemyError:
        response.status_code = 503
        return ReadinessResponse(
            status="not_ready",
            checks=ReadinessChecks(database="error"),
        )
    return ReadinessResponse(
        status="ready",
        checks=ReadinessChecks(database="ok"),
    )
