from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel
from app.modules.identity.router import router as identity_router

from app.modules.classrooms.router import router as classrooms_router

router = APIRouter()
router.include_router(classrooms_router)
router.include_router(identity_router)


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["fluentt-api"] = "fluentt-api"


@router.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """Application liveness only; does not assert database connectivity."""
    return HealthResponse()
