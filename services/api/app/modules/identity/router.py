from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from app.core.config import Settings
from app.modules.identity.dependencies import (
    get_current_mobile_user,
    get_identity_repository,
    get_identity_settings,
    parse_creation_request,
    require_credential,
    require_secure_transport,
    throttle_checks,
    throttle_creations,
    throttle_sessions,
)
from app.modules.identity.repository import IdentityRepository
from app.modules.identity.schemas import (
    CreatedUser,
    CreateUserRequest,
    MobileProfile,
    UsernameAvailability,
    PreferenceUpdate,
)
from app.modules.identity.session_service import AuthenticatedMobileUser, resolve_session
from app.modules.identity.user_service import check_username, create_user

router = APIRouter(tags=["mobile identity"], dependencies=[Depends(require_secure_transport)])


@router.get("/usernames/check", response_model=UsernameAvailability, dependencies=[Depends(throttle_checks)])
def username_availability(
    username: Annotated[str, Query(max_length=128)],
    repository: Annotated[IdentityRepository, Depends(get_identity_repository)],
) -> UsernameAvailability:
    return check_username(repository, username)


@router.post(
    "/users",
    response_model=CreatedUser,
    status_code=201,
    dependencies=[Depends(throttle_creations)],
    openapi_extra={"requestBody": {"required": True}},
)
def register_user(
    payload: Annotated[CreateUserRequest, Depends(parse_creation_request)],
    repository: Annotated[IdentityRepository, Depends(get_identity_repository)],
    settings: Annotated[Settings, Depends(get_identity_settings)],
) -> CreatedUser:
    return create_user(repository, payload, settings)


@router.get("/sessions/me", response_model=MobileProfile)
def current_profile(principal: Annotated[AuthenticatedMobileUser, Depends(get_current_mobile_user)]) -> MobileProfile:
    """Restore a returning mobile profile using its existing credential."""
    return principal.profile


@router.post("/sessions/revoke", status_code=204, dependencies=[Depends(throttle_sessions)])
def revoke_current_session(
    credential: Annotated[str, Depends(require_credential)],
    repository: Annotated[IdentityRepository, Depends(get_identity_repository)],
    settings: Annotated[Settings, Depends(get_identity_settings)],
) -> Response:
    resolve_session(repository, credential, settings, revoke=True)
    return Response(status_code=204)


@router.patch("/users/me/preferences", response_model=MobileProfile, dependencies=[Depends(throttle_sessions)])
def update_preferences(
    payload: PreferenceUpdate,
    credential: Annotated[str, Depends(require_credential)],
    repository: Annotated[IdentityRepository, Depends(get_identity_repository)],
    settings: Annotated[Settings, Depends(get_identity_settings)],
) -> MobileProfile:
    return resolve_session(repository, credential, settings, preferences=payload).profile
