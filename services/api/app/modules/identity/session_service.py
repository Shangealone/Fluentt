from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.core.config import Settings
from app.core.security import credential_digest, valid_credential_format
from app.modules.identity.errors import invalid_session, IdentityError
from app.modules.identity.repository import IdentityRepository
from app.modules.identity.schemas import MOBILE_ROLES, MobileProfile, PreferenceUpdate


@dataclass(frozen=True)
class AuthenticatedMobileUser:
    profile: MobileProfile
    session_id: UUID


@contextmanager
def authenticated_session(repository: IdentityRepository, raw: str, settings: Settings, *, revoke: bool = False):
    if not valid_credential_format(raw):
        raise invalid_session()
    with repository.transaction():
        pair = repository.lock_session(credential_digest(raw))
        now = datetime.now(timezone.utc)
        if pair is None:
            raise invalid_session()
        session, user = pair
        if (
            session.revoked_at is not None
            or session.expires_at <= now
            or session.absolute_expires_at <= now
            or user.role not in MOBILE_ROLES
            or user.profile_status not in {"onboarding", "active"}
            or user.archived_at is not None
        ):
            raise invalid_session()
        if revoke:
            session.revoked_at = now
        else:
            session.last_used_at = now
            session.expires_at = min(
                now + timedelta(days=settings.mobile_session_idle_days), session.absolute_expires_at
            )
        yield session, user
        repository.flush()


def resolve_session(
    repository: IdentityRepository,
    raw: str,
    settings: Settings,
    *,
    revoke: bool = False,
    preferences: PreferenceUpdate | None = None,
) -> AuthenticatedMobileUser:
    with authenticated_session(repository, raw, settings, revoke=revoke) as (session, user):
        if preferences is not None:
            if user.role != "personal_student":
                raise IdentityError(403, "personal_only", "Only personal learners can change these preferences.")
            repository.update_preferences(user, preferences)
        repository.flush()
        principal = AuthenticatedMobileUser(profile=repository.mobile_profile(user), session_id=session.id)
    return principal
