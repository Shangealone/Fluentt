from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from app.core.config import Settings
from app.core.security import issue_credential
from app.core.usernames import UsernameValidationError, validate_new_username
from app.models.users import User, UserSession
from app.modules.identity.errors import IdentityError, username_taken
from app.modules.identity.repository import IdentityRepository
from app.modules.identity.schemas import (
    CreatedUser,
    CreateUserRequest,
    IssuedSession,
    MobileProfile,
    UsernameAvailability,
    MOBILE_ROLES,
)

ONBOARDING_STEPS = {
    "personal_student": "personal_preferences",
    "school_student": "class_enrollment",
    "instructor": "first_class",
}


def check_username(repository: IdentityRepository, username: str) -> UsernameAvailability:
    try:
        canonical = validate_new_username(username)
    except UsernameValidationError as exc:
        return UsernameAvailability(username=username, available=False, message=str(exc))
    with repository.transaction():
        available = not repository.username_exists(canonical)
    return UsernameAvailability(
        username=username,
        available=available,
        message="Username is available." if available else "This username is already taken.",
    )


def create_user(repository: IdentityRepository, request: CreateUserRequest, settings: Settings) -> CreatedUser:
    if request.role not in MOBILE_ROLES:
        raise IdentityError(422, "invalid_role", "Choose personal_student, school_student or instructor.")
    canonical = validate_new_username(request.username)
    now = datetime.now(timezone.utc)
    issued = issue_credential()
    expires = now + timedelta(days=settings.mobile_session_idle_days)
    absolute = now + timedelta(days=settings.mobile_session_absolute_days)
    try:
        with repository.transaction():
            if repository.username_exists(canonical):
                raise username_taken()
            user = User(
                id=uuid4(),
                username=request.username,
                role=request.role,
                profile_status="onboarding",
                onboarding_step=ONBOARDING_STEPS[request.role],
                created_at=now,
                updated_at=now,
            )
            repository.add_user(user)
            repository.add_profile(user)
            repository.add_session(
                UserSession(
                    id=uuid4(),
                    user_id=user.id,
                    credential_digest=issued.digest,
                    created_at=now,
                    updated_at=now,
                    expires_at=expires,
                    absolute_expires_at=absolute,
                )
            )
            repository.flush()
            result = CreatedUser(
                user=MobileProfile.model_validate(user),
                session=IssuedSession(credential=issued.raw, expires_at=expires, absolute_expires_at=absolute),
            )
        # Return the credential only after the entire profile/session transaction commits.
        return result
    except IntegrityError as exc:
        constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
        if getattr(exc.orig, "sqlstate", None) == "23505" and constraint == "uq_users_canonical_username":
            raise username_taken() from None
        raise
