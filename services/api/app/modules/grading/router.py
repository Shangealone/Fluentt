from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Request, Query as QueryParams
from app.modules.administration.repository import AdminRepository
from app.modules.administration.router import credential, origin_required, request_id
from app.modules.curriculum.router import get_admin_repository
from app.modules.identity.dependencies import require_secure_transport
from app.modules.grading.schemas import EvaluationInput, Query, RunView, Page
from app.modules.grading.service import execute

router = APIRouter(prefix="/admin/grading", tags=["internal grading"], dependencies=[Depends(require_secure_transport)])
Admin = Annotated[AdminRepository, Depends(get_admin_repository)]
Token = Annotated[str, Depends(credential)]


@router.post("/attempts/{attempt_id}/evaluate", response_model=RunView, dependencies=[Depends(origin_required)])
def evaluate(attempt_id: UUID, payload: EvaluationInput, request: Request, admin: Admin, token: Token):
    return execute(
        admin,
        token,
        action="evaluate",
        attempt_id=attempt_id,
        payload=payload,
        csrf=request.headers.get("x-csrf-token"),
        request_id=request_id(request),
    )


@router.get("/runs/{run_id}", response_model=RunView)
def read(run_id: UUID, request: Request, admin: Admin, token: Token):
    return execute(admin, token, action="read", run_id=run_id, request_id=request_id(request))


@router.get("/attempts/{attempt_id}/runs", response_model=Page)
def listing(attempt_id: UUID, query: Annotated[Query, QueryParams()], request: Request, admin: Admin, token: Token):
    return execute(admin, token, action="list", attempt_id=attempt_id, query=query, request_id=request_id(request))
