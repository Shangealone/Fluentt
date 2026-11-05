from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, HTTPException
from sqlalchemy.exc import DBAPIError

from app.modules.vocabulary_review.router import Admin, Token, CSRF, origin_required
from app.modules.identity.dependencies import require_secure_transport, get_current_mobile_user
from .schemas import Draft, AllocationRequest
from . import service


def gate(request: Request):
    if not request.app.state.settings.parallel_research_enabled:
        raise HTTPException(404, "Parallel research preparation is disabled", headers={"Cache-Control": "no-store"})


router = APIRouter(prefix="/admin/parallel-studies", tags=["inactive parallel preparation"],
                   dependencies=[Depends(require_secure_transport), Depends(gate)])
mobile_router = APIRouter(prefix="/me/parallel-study", dependencies=[Depends(require_secure_transport)])


def mutate(operation):
    try:
        return operation()
    except DBAPIError:
        raise service.fail("Preparation conflict; reconcile the same request before retrying") from None


@router.post("", dependencies=[Depends(origin_required)], status_code=201)
def create(payload: Draft, admin: Admin, token: Token,
           key: Annotated[UUID, Header(alias="Idempotency-Key")], csrf: CSRF = None):
    return mutate(lambda: service.admin(admin, token, action="create", payload=payload, key=key, csrf=csrf))


@router.get("/{protocol_id}")
def read(protocol_id: UUID, admin: Admin, token: Token):
    return service.admin(admin, token, action="read", target=protocol_id)


@router.post("/{protocol_id}/allocations", dependencies=[Depends(origin_required)])
def allocate(protocol_id: UUID, payload: AllocationRequest, admin: Admin, token: Token, csrf: CSRF = None):
    # Natural participant/protocol identity is immutable and supplies safe replay.
    return mutate(lambda: service.admin(admin, token, action="allocate", target=protocol_id, payload=payload, csrf=csrf))


@mobile_router.get("/status")
def status(request: Request, user=Depends(get_current_mobile_user)):
    from fastapi.responses import JSONResponse
    if user.profile.role not in ("school_student", "instructor"):
        raise service.fail("Parallel studies are limited to school accounts", 403)
    return JSONResponse(dict(status="inactive", participation_enabled=False,
                             preparation_enabled=request.app.state.settings.parallel_research_enabled,
                             reason="parallel_participation_workflow_unavailable"), headers={"Cache-Control": "no-store"})
