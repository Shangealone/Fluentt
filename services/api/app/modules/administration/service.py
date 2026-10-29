from datetime import datetime, timedelta, timezone
import hmac
from typing import Literal

from pydantic import BaseModel

from app.models.admin_sessions import AdminBrowserSession, AdminOIDCAttempt
from app.modules.administration.security import denied, derived, digest, secret, valid
from app.modules.identity.errors import IdentityError

IDLE = timedelta(minutes=30)
ABSOLUTE = timedelta(hours=8)
ATTEMPT = timedelta(minutes=10)
PERMISSION = "dashboard.view"


class AdminProfile(BaseModel):
    username: str
    role: Literal["administrator"] = "administrator"
    permissions: list[str]
    csrf_token: str
    expires_at: datetime
    absolute_expires_at: datetime


def utcnow():
    return datetime.now(timezone.utc)


def eligible(repository, user):
    return (
        user is not None
        and user.role == "administrator"
        and user.profile_status == "active"
        and user.archived_at is None
        and PERMISSION in repository.permissions(user.id)
    )


def begin_attempt(repository, now=None, request_id=None):
    now = now or utcnow()
    state, binding = secret(), secret()
    with repository.transaction():
        repository.add(
            AdminOIDCAttempt(
                state_digest=digest(state), binding_digest=digest(binding), created_at=now, expires_at=now + ATTEMPT
            )
        )
        repository.audit("admin.login_started", now, request_id=request_id)
    return state, binding


def consume_attempt(repository, state, binding, now=None, request_id=None):
    accepted = False
    with repository.transaction():
        attempt = repository.attempt(digest(state)) if valid(state) and valid(binding) else None
        now = now or utcnow()  # Recheck expiry after waiting for the row lock.
        if (
            attempt is not None
            and attempt.consumed_at is None
            and attempt.expires_at > now
            and hmac.compare_digest(attempt.binding_digest, digest(binding))
        ):
            attempt.consumed_at = now
            accepted = True
        else:
            repository.audit("admin.login_failed", now, reason="invalid_attempt", request_id=request_id)
    return accepted


def login_failed(repository, reason, request_id=None):
    with repository.transaction():
        repository.audit("admin.login_failed", utcnow(), reason=reason, request_id=request_id)


def issue_session(repository, issuer, subject, previous=None, now=None, request_id=None):
    now = now or utcnow()
    credential = None
    with repository.transaction():
        user = repository.identity_user(issuer, subject)
        if eligible(repository, user):
            # Rotate on authentication. An old cookie is never promoted to an admin session.
            if valid(previous):
                old = repository.browser_session(digest(previous), lock=True)
                if old is not None and old.user_id == user.id and old.revoked_at is None:
                    old.revoked_at = now
            credential = secret()
            row = repository.add(
                AdminBrowserSession(
                    user_id=user.id,
                    credential_digest=digest(credential),
                    created_at=now,
                    expires_at=now + IDLE,
                    absolute_expires_at=now + ABSOLUTE,
                )
            )
            repository.audit("admin.login_succeeded", now, actor=user.id, entity=row.id, request_id=request_id)
        else:
            repository.audit("admin.login_failed", now, reason="access_denied", request_id=request_id)
    return credential


def resolve_session(
    repository,
    credential,
    *,
    csrf=None,
    logout=False,
    now=None,
    request_id=None,
    required_permission=None,
    read_operation=None,
    mutation_operation=None,
    additional_permissions=(),
):
    """Domain callbacks share live authorization locks; writes additionally require CSRF."""
    if read_operation is not None and (logout or not required_permission):
        raise ValueError("Protected read operations require an explicit permission")
    if mutation_operation is not None and (logout or read_operation is not None or not required_permission):
        raise ValueError("Protected mutations require a separate explicit permission")
    if not valid(credential):
        raise denied()
    profile = None
    csrf_rejected = False
    read_result = None
    with repository.transaction():
        initial = repository.browser_session(digest(credential))
        # All session use and operator revocation serialize on the user before the session row.
        user = repository.user(initial.user_id) if initial else None
        row = repository.browser_session(digest(credential), lock=True) if user else None
        now = now or utcnow()  # Lock waits must never extend expired credentials.
        if (
            row
            and row.revoked_at is None
            and row.expires_at > now
            and row.absolute_expires_at > now
            and eligible(repository, user)
        ):
            permissions = repository.permissions(user.id)
            if (required_permission and required_permission not in permissions) or set(
                additional_permissions
            ) - permissions:
                raise IdentityError(403, "admin_permission_required", "This administrator permission is required.")
            expected = derived(credential, "csrf")
            if (logout or mutation_operation is not None) and (
                not valid(csrf) or not hmac.compare_digest(expected, csrf)
            ):
                repository.audit("admin.csrf_rejected", now, actor=user.id, request_id=request_id)
                csrf_rejected = True
            else:
                row.expires_at = min(now + IDLE, row.absolute_expires_at)
                if logout:
                    row.revoked_at = now
                    repository.audit("admin.logout", now, actor=user.id, entity=row.id, request_id=request_id)
                profile = AdminProfile(
                    username=user.username,
                    permissions=sorted(permissions),
                    csrf_token=expected,
                    expires_at=row.expires_at,
                    absolute_expires_at=row.absolute_expires_at,
                )
                if read_operation is not None:
                    read_result = read_operation(user)
                if mutation_operation is not None:
                    read_result = mutation_operation(user)
    if profile is None:
        if csrf_rejected:
            raise IdentityError(403, "admin_csrf_rejected", "Reload the administrator page and try again.")
        raise denied()
    return read_result if read_operation is not None or mutation_operation is not None else profile
