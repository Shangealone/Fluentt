"""Explicitly permissioned administrator monitoring reads."""

import hmac
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.modules.administration import monitoring, service
from app.modules.administration.repository import AdminRepository
from app.modules.administration.router import credential, request_id
from app.modules.administration.security import denied
from app.modules.identity.dependencies import require_secure_transport


router = APIRouter(prefix="/admin/monitoring", tags=["administrator monitoring"],
                   dependencies=[Depends(require_secure_transport)])
def local_preview_allowed(request: Request) -> bool:
    settings = request.app.state.settings
    configured = settings.admin_local_preview_token
    supplied = request.headers.get("x-fluentt-local-preview-token", "")
    return bool(
        settings.environment == "development"
        and configured
        and request.client is not None
        and request.client.host in {"127.0.0.1", "::1"}
        and request.url.hostname in {"127.0.0.1", "localhost"}
        and len(supplied) >= 32
        and hmac.compare_digest(supplied, configured.get_secret_value())
    )


def preview_or_credential(request: Request) -> str | None:
    if local_preview_allowed(request):
        return None
    return credential(request)


Token = Annotated[str | None, Depends(preview_or_credential)]
PageLimit = Annotated[int, Query(ge=1, le=100)]
PageOffset = Annotated[int, Query(ge=0, le=100000)]


def repository(session: Annotated[Session, Depends(get_session)]):
    return AdminRepository(session)


Repo = Annotated[AdminRepository, Depends(repository)]


def read(request: Request, response: Response, repo: AdminRepository, token: str | None, operation):
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    if token is None:
        if not local_preview_allowed(request):
            raise denied()
        with repo.transaction():
            return operation(repo.session)
    return service.resolve_session(repo, token, required_permission="monitoring.read",
                                   request_id=request_id(request), read_operation=lambda _: operation(repo.session))


@router.get("/overview")
def overview(request: Request, response: Response, token: Token, repo: Repo):
    return read(request, response, repo, token, monitoring.overview)


@router.get("/classes")
def classes(request: Request, response: Response, token: Token, repo: Repo,
            q: Annotated[str | None, Query(max_length=80)] = None,
            limit: PageLimit = 20, offset: PageOffset = 0):
    return read(request, response, repo, token, lambda db: monitoring.classes(db, q, limit, offset))


@router.get("/classes/{class_id}")
def class_detail(class_id: UUID, request: Request, response: Response, token: Token, repo: Repo,
                 limit: PageLimit = 20, offset: PageOffset = 0):
    return read(request, response, repo, token, lambda db: monitoring.class_detail(db, class_id, limit, offset))


@router.get("/users")
def users(request: Request, response: Response, token: Token, repo: Repo,
          q: Annotated[str | None, Query(max_length=80)] = None,
          role: Literal["school_student", "personal_student", "instructor"] | None = None,
          limit: PageLimit = 20, offset: PageOffset = 0):
    return read(request, response, repo, token, lambda db: monitoring.users(db, q, role, limit, offset))


@router.get("/students/{student_id}")
def student_detail(student_id: UUID, request: Request, response: Response, token: Token, repo: Repo):
    return read(request, response, repo, token, lambda db: monitoring.student_detail(db, student_id))


@router.get("/learn")
def learn(request: Request, response: Response, token: Token, repo: Repo):
    return read(request, response, repo, token, monitoring.learn)


@router.get("/fsrs")
def fsrs(request: Request, response: Response, token: Token, repo: Repo):
    return read(request, response, repo, token, monitoring.fsrs)


@router.get("/fifakt")
def fifakt(request: Request, response: Response, token: Token, repo: Repo):
    return read(request, response, repo, token, monitoring.fifakt)


@router.get("/pronunciation")
def pronunciation(request: Request, response: Response, token: Token, repo: Repo,
                  limit: PageLimit = 20, offset: PageOffset = 0):
    return read(request, response, repo, token, lambda db: monitoring.pronunciation(db, limit, offset))


@router.get("/pronunciation/{attempt_id}")
def pronunciation_detail(attempt_id: UUID, request: Request, response: Response, token: Token, repo: Repo):
    return read(request, response, repo, token, lambda db: monitoring.pronunciation_detail(db, attempt_id))


@router.get("/tutor")
def tutor(request: Request, response: Response, token: Token, repo: Repo,
          limit: PageLimit = 20, offset: PageOffset = 0):
    return read(request, response, repo, token, lambda db: monitoring.tutor(db, limit, offset))


@router.get("/status")
def status(request: Request, response: Response, token: Token, repo: Repo):
    return read(request, response, repo, token, lambda db: monitoring.status(db, request.app.state.settings))
