from datetime import datetime, timezone

from app.modules.identity.errors import IdentityError
from app.modules.identity.session_service import authenticated_session
from app.modules.enrollment.repository import invitation_available, preview_version
from app.modules.enrollment.schemas import ClassPreview


def require_student(user):
    if user.role != "school_student":
        raise IdentityError(403, "school_student_required", "Only school students can enroll in classes.")


def unavailable():
    return IdentityError(404, "invitation_unavailable", "Class code is invalid or unavailable.")


def verify(repo, raw, settings, payload, limit_session, *, confirm=False):
    with authenticated_session(repo, raw, settings) as (session, user):
        require_student(user)
        limit_session(session.id)
        pair = repo.lock_invitation(payload.code)
        if not invitation_available(pair):
            raise unavailable()
        classroom, code, _ = pair
        history = repo.history(user.id, classroom.id)
        if any(row.status == "removed" for row in history):
            # Removal cannot be bypassed by obtaining another invitation code.
            raise unavailable()
        description = repo.describe_class(classroom)
        version = preview_version(classroom, code, description, history)
        if not confirm:
            return ClassPreview(**description.model_dump(), class_version=version)
        existing = next((row for row in history if row.status == "active" and row.ended_at is None), None)
        if existing is None:
            if version != payload.class_version:
                raise IdentityError(409, "preview_changed", "Class details changed. Verify the code and review again.")
            existing = repo.enroll(user.id, classroom, datetime.now(timezone.utc))
        user.profile_status = "active"
        user.onboarding_step = None
        result = repo.describe_membership(existing, classroom)
    return result


def memberships(repo, raw, settings, limit, offset):
    with authenticated_session(repo, raw, settings) as (_, user):
        require_student(user)
        result = repo.mine(user.id, limit, offset)
    return result
