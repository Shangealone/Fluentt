from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from app.core.config import Settings
from app.core.security import hash_password, issue_credential, verify_password
from app.core.usernames import UsernameValidationError, validate_new_username
from app.models.users import User, UserSession
from app.modules.identity.errors import IdentityError, username_taken
from app.modules.identity.repository import IdentityRepository
from app.modules.enrollment.repository import EnrollmentRepository
from app.modules.enrollment.service import resolve_registration_class
from app.modules.identity.schemas import (
    CreatedUser,
    IssuedSession,
    LoginRequest,
    MobileProfile,
    RegistrationRequest,
    UsernameAvailability,
    MOBILE_ROLES,
)

def set_password(repository: IdentityRepository, raw: str, password: str, settings: Settings) -> MobileProfile:
    from app.modules.identity.session_service import authenticated_session
    with authenticated_session(repository, raw, settings) as (_, user):
        if user.password_hash:
            if not verify_password(password, user.password_hash):
                raise IdentityError(409, "password_already_set", "This account already has a password. Sign in with it.")
        else:
            user.password_hash = hash_password(password)
        repository.flush()
        profile = repository.mobile_profile(user)
    return profile


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


def create_user(repository: EnrollmentRepository, request: RegistrationRequest, settings: Settings) -> CreatedUser:
    if request.role not in MOBILE_ROLES:
        raise IdentityError(422, "invalid_role", "Choose an available account type.")
    if request.role == "personal_student" and not settings.personal_learner_registration_enabled:
        raise IdentityError(403, "personal_registration_disabled", "New accounts are available for students and teachers. Existing account holders can still sign in.")
    if request.role == "school_student" and (request.class_code is None or request.class_version is None):
        raise IdentityError(422, "class_code_required", "Verify your instructor's class code before creating an account.")
    if request.role != "school_student" and (request.class_code is not None or request.class_version is not None):
        raise IdentityError(422, "invalid_class_enrollment", "Class enrollment details are only allowed for students.")
    canonical = validate_new_username(request.username)
    now = datetime.now(timezone.utc)
    issued = issue_credential()
    expires = now + timedelta(days=settings.mobile_session_idle_days)
    absolute = now + timedelta(days=settings.mobile_session_absolute_days)
    try:
        with repository.transaction():
            if repository.username_exists(canonical):
                raise username_taken()
            classroom = None
            if request.role == "school_student":
                classroom, _, _ = resolve_registration_class(repository, request.class_code, request.class_version)
            password_hash = hash_password(request.password) if request.password else None
            user = User(
                id=uuid4(),
                username=request.username,
                password_hash=password_hash,
                role=request.role,
                profile_status="active" if classroom is not None else "onboarding",
                onboarding_step=None if classroom is not None else ONBOARDING_STEPS[request.role],
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
            if classroom is not None:
                repository.enroll(user.id, classroom, now)
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


def login_user(repository: IdentityRepository, request: LoginRequest, settings: Settings) -> CreatedUser:
    canonical = request.username.strip().lower()
    now = datetime.now(timezone.utc)
    with repository.transaction():
        user = repository.find_user_by_canonical_username(canonical)
        if user is None:
            raise IdentityError(401, "invalid_credentials", "Invalid username or password.")
        if not user.password_hash or not verify_password(request.password, user.password_hash):
            raise IdentityError(401, "invalid_credentials", "Invalid username or password.")
        if user.role not in MOBILE_ROLES or user.profile_status not in ("onboarding", "active") or user.archived_at is not None:
            raise IdentityError(403, "account_inactive", "This account is inactive.")

        issued = issue_credential()
        expires = now + timedelta(days=settings.mobile_session_idle_days)
        absolute = now + timedelta(days=settings.mobile_session_absolute_days)
        session = UserSession(
            id=uuid4(),
            user_id=user.id,
            credential_digest=issued.digest,
            created_at=now,
            updated_at=now,
            expires_at=expires,
            absolute_expires_at=absolute,
        )
        repository.add_session(session)
        repository.flush()
        profile = repository.mobile_profile(user)
        return CreatedUser(
            user=profile,
            session=IssuedSession(credential=issued.raw, expires_at=expires, absolute_expires_at=absolute),
        )

