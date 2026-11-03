from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.exc import IntegrityError
from app.modules.administration.repository import AdminRepository
from app.modules.administration.router import credential as admin_credential, origin_required
from app.modules.classrooms.router import Repo, Credential, Config
from app.modules.curriculum.router import get_admin_repository
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.identity.errors import IdentityError
from . import service
from .schemas import PackInput, ProtocolInput, StateInput, AllocationInput, AnswerInput, RatingInput

admin_router = APIRouter(prefix="/admin/vocabulary", tags=["vocabulary setup"], dependencies=[Depends(require_secure_transport)])
router = APIRouter(prefix="/me/vocabulary", tags=["vocabulary review"],
                   dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)])
Admin = Annotated[AdminRepository, Depends(get_admin_repository)]
Token = Annotated[str, Depends(admin_credential)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]
CSRF = Annotated[str | None, Header(alias="X-CSRF-Token")]
Expected = Annotated[str | None, Header(alias="If-Match")]


def provider(request):
    return getattr(request.app.state, "esr_prediction_provider", None)


def write(operation):
    try:
        return operation()
    except IntegrityError as error:
        raise IdentityError(409, "vocabulary_conflict", "These details conflict with retained records. Reload and retry.") from error


@admin_router.get("/packs")
def packs(admin: Admin, token: Token):
    return service.admin_read(admin, token, kind="packs")


@admin_router.get("/lessons")
def lessons(admin: Admin, token: Token):
    return service.admin_read(admin, token, kind="lessons")


@admin_router.get("/choices")
def choices(request: Request, admin: Admin, token: Token):
    return service.admin_read(admin, token, kind="choices", provider=provider(request))


@admin_router.post("/packs", dependencies=[Depends(origin_required)], status_code=201)
def create_pack(payload: PackInput, admin: Admin, token: Token, key: Key, csrf: CSRF = None):
    return write(lambda: service.admin_write(admin, token, csrf, key, action="pack", payload=payload))


@admin_router.post("/packs/{pack_id}/publish", dependencies=[Depends(origin_required)])
def publish_pack(pack_id: UUID, admin: Admin, token: Token, key: Key, csrf: CSRF = None):
    return write(lambda: service.admin_write(admin, token, csrf, key, action="publish", target=pack_id))


@admin_router.get("/protocols")
def protocols(request: Request, admin: Admin, token: Token):
    return service.admin_read(admin, token, kind="protocols", provider=provider(request))


@admin_router.post("/protocols", dependencies=[Depends(origin_required)], status_code=201)
def create_protocol(payload: ProtocolInput, request: Request, admin: Admin, token: Token, key: Key, csrf: CSRF = None):
    return write(lambda: service.admin_write(admin, token, csrf, key, action="protocol", payload=payload, provider=provider(request)))


@admin_router.post("/protocols/{protocol_id}/state", dependencies=[Depends(origin_required)])
def change_state(protocol_id: UUID, payload: StateInput, request: Request, admin: Admin, token: Token, key: Key,
                 csrf: CSRF = None, expected: Expected = None):
    return write(lambda: service.admin_write(admin, token, csrf, key, action="state", payload=payload,
                      target=protocol_id, expected=expected, provider=provider(request)))


@admin_router.post("/protocols/{protocol_id}/allocations", dependencies=[Depends(origin_required)])
def allocate(protocol_id: UUID, payload: AllocationInput, request: Request, admin: Admin, token: Token, key: Key,
             csrf: CSRF = None, expected: Expected = None):
    return write(lambda: service.admin_write(admin, token, csrf, key, action="allocate", payload=payload,
                      target=protocol_id, expected=expected, provider=provider(request)))


@router.get("/studies")
def learner_studies(repo: Repo, token: Credential, settings: Config):
    return service.learner_studies(repo, token, settings)


@router.get("/studies/{protocol_id}/due")
def due(protocol_id: UUID, request: Request, repo: Repo, token: Credential, settings: Config):
    return service.due_reviews(repo, token, settings, protocol_id, provider(request))


@router.post("/studies/{protocol_id}/items/{state_id}/start")
def start(protocol_id: UUID, state_id: UUID, request: Request, repo: Repo, token: Credential, settings: Config, key: Key):
    return write(lambda: service.learner_mutation(repo, token, settings, protocol_id, key, "start", state_id, None, provider(request)))


@router.post("/studies/{protocol_id}/reviews/{review_id}/answer")
def answer(protocol_id: UUID, review_id: UUID, payload: AnswerInput, request: Request,
           repo: Repo, token: Credential, settings: Config, key: Key):
    return write(lambda: service.learner_mutation(repo, token, settings, protocol_id, key, "answer", review_id, payload, provider(request)))


@router.post("/studies/{protocol_id}/reviews/{review_id}/rating")
def rate(protocol_id: UUID, review_id: UUID, payload: RatingInput, request: Request,
         repo: Repo, token: Credential, settings: Config, key: Key):
    return write(lambda: service.learner_mutation(repo, token, settings, protocol_id, key, "rating", review_id, payload, provider(request)))
