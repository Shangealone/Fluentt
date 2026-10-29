"""Cookie-based browser account endpoints; no bearer credential in response JSON."""
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import uuid4
from fastapi import APIRouter, Depends, Request, Response
from app.core.config import Settings
from app.core.security import issue_credential
from app.models.users import UserSession
from app.modules.identity.browser_security import (
    browser_credential, clear_browser_cookie, cookie_name, csrf_token,
    require_browser_write, require_json_browser_write, set_browser_cookie, validate_cookie_csrf,
)
from app.modules.identity.dependencies import (
    bearer, get_identity_repository, get_identity_settings, get_registration_repository, require_secure_transport,
    throttle_creations, throttle_sessions,
)
from app.modules.identity.errors import IdentityError, invalid_session
from app.modules.identity.repository import IdentityRepository
from app.modules.identity.schemas import BrowserSession, CreatedUser, LoginRequest, RegistrationRequest, IssuedSession
from app.modules.identity.session_service import authenticated_session, resolve_session
from app.modules.identity.user_service import create_user, login_user
from fastapi.security import HTTPAuthorizationCredentials
from fastapi import Security

router = APIRouter(prefix="/browser", tags=["browser accounts"], dependencies=[Depends(require_secure_transport)])

def result(created: CreatedUser, response: Response, settings: Settings) -> BrowserSession:
    set_browser_cookie(response, created.session.credential, created.session.absolute_expires_at, settings)
    return BrowserSession(user=created.user, csrf_token=csrf_token(created.session.credential, settings))

@router.post("/users", response_model=BrowserSession, status_code=201,
    dependencies=[Depends(require_json_browser_write), Depends(throttle_creations)])
def register(payload: RegistrationRequest, response: Response,
    repository: Annotated[IdentityRepository, Depends(get_registration_repository)],
    settings: Annotated[Settings, Depends(get_identity_settings)]):
    return result(create_user(repository, payload, settings), response, settings)

@router.post("/sessions/login", response_model=BrowserSession,
    dependencies=[Depends(require_json_browser_write), Depends(throttle_sessions)])
def login(payload: LoginRequest, response: Response,
    repository: Annotated[IdentityRepository, Depends(get_identity_repository)],
    settings: Annotated[Settings, Depends(get_identity_settings)]):
    return result(login_user(repository, payload, settings), response, settings)

@router.get("/sessions/me", response_model=BrowserSession, dependencies=[Depends(throttle_sessions)])
def me(request: Request,
    repository: Annotated[IdentityRepository, Depends(get_identity_repository)],
    settings: Annotated[Settings, Depends(get_identity_settings)]):
    origin = request.headers.get("origin")
    if origin is not None and origin not in settings.mobile_web_origins:
        raise IdentityError(403, "browser_origin_denied", "This browser request is not allowed.")
    raw = browser_credential(request)
    principal = resolve_session(repository, raw, settings)
    return BrowserSession(user=principal.profile, csrf_token=csrf_token(raw, settings))

@router.post("/sessions/revoke", status_code=204, dependencies=[Depends(throttle_sessions)])
def revoke(request: Request,
    repository: Annotated[IdentityRepository, Depends(get_identity_repository)],
    settings: Annotated[Settings, Depends(get_identity_settings)]):
    raw = browser_credential(request)
    validate_cookie_csrf(request, raw)
    resolve_session(repository, raw, settings, revoke=True)
    response = Response(status_code=204)
    clear_browser_cookie(response, settings)
    return response

@router.post("/sessions/exchange", response_model=BrowserSession,
    dependencies=[Depends(require_browser_write), Depends(throttle_sessions)])
def exchange(request: Request, response: Response,
    credential: Annotated[HTTPAuthorizationCredentials | None, Security(bearer)],
    repository: Annotated[IdentityRepository, Depends(get_identity_repository)],
    settings: Annotated[Settings, Depends(get_identity_settings)]):
    # Prefer a valid legacy credential so its account is never discarded just
    # because a different tab has installed a cookie. An invalid legacy entry
    # falls back to a valid cookie, such as after an interrupted exchange.
    current = None
    if request.cookies.get(cookie_name(settings)):
        try:
            raw = browser_credential(request)
            principal = resolve_session(repository, raw, settings)
            current = BrowserSession(user=principal.profile, csrf_token=csrf_token(raw, settings))
        except IdentityError as error:
            if error.code != "invalid_session":
                raise
    if credential is None:
        if current is not None:
            return current
        raise invalid_session()
    issued = issue_credential()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=settings.mobile_session_idle_days)
    absolute = now + timedelta(days=settings.mobile_session_absolute_days)
    try:
        with authenticated_session(repository, credential.credentials, settings, revoke=True) as (_, user):
            repository.add_session(UserSession(id=uuid4(), user_id=user.id, credential_digest=issued.digest,
                created_at=now, updated_at=now, expires_at=expires, absolute_expires_at=absolute))
            repository.flush()
            created = CreatedUser(user=repository.mobile_profile(user),
                session=IssuedSession(credential=issued.raw, expires_at=expires, absolute_expires_at=absolute))
    except IdentityError as error:
        if error.code == "invalid_session" and current is not None:
            return current
        raise
    return result(created, response, settings)
