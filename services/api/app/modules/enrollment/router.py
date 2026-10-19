from typing import Annotated
from collections.abc import Callable
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import get_session
from app.modules.identity.dependencies import (
    get_identity_settings,
    require_credential,
    require_secure_transport,
    throttle,
    throttle_sessions,
)
from app.modules.enrollment.repository import EnrollmentRepository
from app.modules.enrollment.schemas import CodeRequest, Confirmation, ClassPreview, MembershipDetails
from app.modules.enrollment.service import verify, memberships


def get_enrollment_repository(session: Annotated[Session, Depends(get_session)]):
    return EnrollmentRepository(session)


def throttle_verification(request: Request):
    throttle(request, "enrollment_peer", "enrollment_peer_limit")


def session_limiter(request: Request):
    def check(session_id):
        from app.core.rate_limit import RateLimitExceeded
        from app.modules.identity.errors import IdentityError

        try:
            request.app.state.identity_limiter.check(
                "enrollment_session", str(session_id), request.app.state.settings.enrollment_session_limit
            )
        except RateLimitExceeded as exc:
            raise IdentityError(
                429,
                "rate_limited",
                "Too many requests. Please wait before trying again.",
                {"Retry-After": str(exc.retry_after)},
            ) from None

    return check


router = APIRouter(tags=["student enrollment"], dependencies=[Depends(require_secure_transport)])
Repo = Annotated[EnrollmentRepository, Depends(get_enrollment_repository)]
Credential = Annotated[str, Depends(require_credential)]
Config = Annotated[Settings, Depends(get_identity_settings)]
Limiter = Annotated[Callable[[UUID], None], Depends(session_limiter)]


@router.post("/class-enrollment-previews", response_model=ClassPreview, dependencies=[Depends(throttle_verification)])
def preview(payload: CodeRequest, credential: Credential, repo: Repo, settings: Config, limiter: Limiter):
    return verify(repo, credential, settings, payload, limiter)


@router.post("/class-memberships", response_model=MembershipDetails, dependencies=[Depends(throttle_verification)])
def confirm(payload: Confirmation, credential: Credential, repo: Repo, settings: Config, limiter: Limiter):
    return verify(repo, credential, settings, payload, limiter, confirm=True)


@router.get(
    "/class-memberships/mine", response_model=list[MembershipDetails], dependencies=[Depends(throttle_sessions)]
)
def mine(
    credential: Credential,
    repo: Repo,
    settings: Config,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0, le=100000)] = 0,
):
    return memberships(repo, credential, settings, limit, offset)
