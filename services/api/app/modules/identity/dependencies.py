from typing import Annotated, Any

from fastapi import Body, Depends, Request, Security
from fastapi.exceptions import RequestValidationError
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from pydantic import ValidationError

from app.core.config import Settings
from app.core.rate_limit import RateLimitExceeded
from app.core.security import valid_credential_format
from app.db.session import get_session
from app.modules.identity.errors import IdentityError, invalid_session
from app.modules.identity.repository import IdentityRepository
from app.modules.identity.schemas import CreateUserRequest
from app.modules.identity.session_service import AuthenticatedMobileUser, resolve_session

bearer = HTTPBearer(
    auto_error=False,
    scheme_name="MobileDeviceSession",
    description="Opaque server-issued device credential. A username never authenticates.",
)


def get_identity_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_identity_repository(session: Annotated[Session, Depends(get_session)]) -> IdentityRepository:
    return IdentityRepository(session)


def require_secure_transport(request: Request) -> None:
    if request.app.state.settings.environment == "production" and request.url.scheme != "https":
        raise IdentityError(400, "https_required", "Use HTTPS to access this service.")


def throttle(request: Request, scope: str, setting: str) -> None:
    peer = request.client.host if request.client is not None else "unknown"
    try:
        request.app.state.identity_limiter.check(scope, peer, getattr(request.app.state.settings, setting))
    except RateLimitExceeded as exc:
        raise IdentityError(
            429,
            "rate_limited",
            "Too many requests. Please wait before trying again.",
            {"Retry-After": str(exc.retry_after)},
        ) from None


def throttle_checks(request: Request) -> None:
    throttle(request, "username_checks", "username_check_limit")


def throttle_creations(request: Request) -> None:
    throttle(request, "user_creations", "user_creation_limit")


def throttle_sessions(request: Request) -> None:
    throttle(request, "session_requests", "mobile_session_request_limit")


def require_credential(credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer)]) -> str:
    if credentials is None or not valid_credential_format(credentials.credentials):
        raise invalid_session()
    return credentials.credentials


def parse_creation_request(
    payload: Annotated[Any, Body(json_schema_extra=CreateUserRequest.model_json_schema())] = None,
) -> CreateUserRequest:
    """Validate public input before opening a database session dependency."""
    try:
        return CreateUserRequest.model_validate(payload)
    except ValidationError as exc:
        errors = [{**item, "loc": ("body", *item["loc"])} for item in exc.errors(include_input=False)]
        raise RequestValidationError(errors) from None


def get_current_mobile_user(
    _: Annotated[None, Depends(throttle_sessions)],
    credential: Annotated[str, Depends(require_credential)],
    repository: Annotated[IdentityRepository, Depends(get_identity_repository)],
    settings: Annotated[Settings, Depends(get_identity_settings)],
) -> AuthenticatedMobileUser:
    return resolve_session(repository, credential, settings)
