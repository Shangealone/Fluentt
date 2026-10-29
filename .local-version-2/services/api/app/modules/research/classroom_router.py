"""Separate namespace: no changes to existing personal or ordinary-class routes."""

from typing import Annotated, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.exc import IntegrityError
from app.modules.administration.repository import AdminRepository
from app.modules.administration.router import credential, origin_required
from app.modules.classrooms.router import Credential, Repo
from app.modules.curriculum.router import get_admin_repository
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.identity.session_service import authenticated_session
from app.modules.identity.errors import IdentityError
from . import classroom_service as service
from .reporting_service import blocked_export
from .classroom_schemas import (
    CreateClassroomStudy,
    ProtocolConfiguration,
    BindClassroom,
    TransitionStudy,
    StudyOverview,
    StudyPage,
    BindingOverview,
    BindingPage,
    ClassMode,
)

admin_router = APIRouter(
    prefix="/admin/research-classrooms",
    tags=["research classroom configuration"],
    dependencies=[Depends(require_secure_transport)],
)
mobile_router = APIRouter(
    prefix="/me/research-classrooms",
    tags=["research classroom overview"],
    dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)],
)
Admin = Annotated[AdminRepository, Depends(get_admin_repository)]
Token = Annotated[str, Depends(credential)]
CSRF = Annotated[str | None, Header(alias="X-CSRF-Token")]
Retry = Annotated[UUID, Header(alias="Idempotency-Key")]
Fresh = Annotated[str | None, Header(alias="If-Match")]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0, le=10000)]


def write(operation):
    try:
        return operation()
    except IntegrityError as error:
        raise IdentityError(
            409, "research_configuration_conflict", "Configuration conflicts with retained records. Refresh and retry."
        ) from error


@admin_router.post("/studies", response_model=StudyOverview, status_code=201, dependencies=[Depends(origin_required)])
def create(payload: CreateClassroomStudy, admin: Admin, token: Token, retry: Retry, csrf: CSRF = None):
    return write(lambda: service.create_study(admin, token, csrf, retry, payload))


@admin_router.get("/studies", response_model=StudyPage)
def studies(admin: Admin, token: Token, limit: Limit = 25, offset: Offset = 0):
    return service.list_studies(admin, token, limit, offset)


@admin_router.get("/studies/{scope_id}", response_model=StudyOverview)
def study(scope_id: UUID, admin: Admin, token: Token):
    return service.read_study(admin, token, scope_id)


@admin_router.post(
    "/studies/{scope_id}/protocols", response_model=StudyOverview, dependencies=[Depends(origin_required)]
)
def revise(
    scope_id: UUID,
    payload: ProtocolConfiguration,
    admin: Admin,
    token: Token,
    retry: Retry,
    csrf: CSRF = None,
    revision: Fresh = None,
):
    return write(lambda: service.revise(admin, token, csrf, scope_id, revision, retry, payload))


@admin_router.get("/studies/{scope_id}/protocols")
def history(scope_id: UUID, admin: Admin, token: Token, limit: Limit = 25, offset: Offset = 0):
    return service.protocol_history(admin, token, scope_id, limit, offset)


@admin_router.post(
    "/studies/{scope_id}/classrooms",
    response_model=BindingOverview,
    status_code=201,
    dependencies=[Depends(origin_required)],
)
def bind(
    scope_id: UUID,
    payload: BindClassroom,
    admin: Admin,
    token: Token,
    retry: Retry,
    csrf: CSRF = None,
    revision: Fresh = None,
):
    return write(lambda: service.bind(admin, token, csrf, scope_id, revision, retry, payload.class_id))


@admin_router.get("/studies/{scope_id}/classrooms", response_model=BindingPage)
def bindings(scope_id: UUID, admin: Admin, token: Token, limit: Limit = 25, offset: Offset = 0):
    return service.list_bindings(admin, token, scope_id, limit, offset)


@admin_router.post("/studies/{scope_id}/state", response_model=StudyOverview, dependencies=[Depends(origin_required)])
def state(
    scope_id: UUID,
    payload: TransitionStudy,
    admin: Admin,
    token: Token,
    retry: Retry,
    csrf: CSRF = None,
    revision: Fresh = None,
):
    return write(lambda: service.transition(admin, token, csrf, scope_id, revision, retry, payload.status))


@mobile_router.get("/classes/{class_id}", response_model=ClassMode)
def overview(
    class_id: UUID, request: Request, credential: Credential, repo: Repo, limit: Limit = 25, offset: Offset = 0
):
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return service.class_mode(repo.session, user, class_id, limit, offset)


@admin_router.get("/studies/{scope_id}/choices")
def choices(
    scope_id: UUID,
    admin: Admin,
    token: Token,
    kind: Literal["classrooms", "conditions", "instruments"],
    limit: Limit = 25,
    offset: Offset = 0,
):
    return service.setup_choices(admin, token, scope_id, kind, limit, offset)


@admin_router.get("/studies/{scope_id}/exports")
def export_dataset(scope_id: UUID, admin: Admin, token: Token,
                   dataset: Literal["participants", "assessments", "reviews", "questionnaires"]):
    return blocked_export(admin, token, scope_id, dataset)
