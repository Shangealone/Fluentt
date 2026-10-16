import secrets
from datetime import datetime, timezone
from uuid import UUID, uuid4
from sqlalchemy.exc import IntegrityError
from app.core.config import Settings
from app.models.users import Classroom, ClassJoinCode
from app.modules.identity.errors import IdentityError
from app.modules.identity.session_service import authenticated_session
from app.modules.classrooms.repository import ClassroomRepository
from app.modules.classrooms.schemas import ClassCreate, ClassUpdate

CODE_ATTEMPTS = 12


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def require_instructor(user):
    if user.role != "instructor":
        raise IdentityError(403, "instructor_required", "Only instructors can manage classes.")


def complete_onboarding(user):
    user.profile_status = "active"
    user.onboarding_step = None


def create_class(repo: ClassroomRepository, raw: str, settings: Settings, payload: ClassCreate, request_id: UUID):
    with authenticated_session(repo, raw, settings) as (_, user):
        require_instructor(user)
        existing = repo.by_request(user.id, request_id)
        if existing is not None:
            result = repo.describe(existing)
            expected = (payload.class_name, payload.grade_level, payload.language, payload.description)
            if expected != (result.class_name, result.grade_level, result.language, result.description):
                raise IdentityError(
                    409,
                    "idempotency_conflict",
                    "This request was already used. Refresh your classes before creating another.",
                )
            complete_onboarding(user)
        else:
            now = datetime.now(timezone.utc)
            classroom = Classroom(
                id=uuid4(),
                instructor_id=user.id,
                class_name=payload.class_name,
                grade_level_id=repo.ensure_grade(payload.grade_level),
                language=payload.language,
                description=payload.description,
                creation_request_id=request_id,
                status="active",
                created_at=now,
                updated_at=now,
            )
            repo.add_class(classroom)
            for _attempt in range(CODE_ATTEMPTS):
                try:
                    with repo.savepoint():
                        repo.add_code(
                            ClassJoinCode(
                                id=uuid4(),
                                class_id=classroom.id,
                                code=generate_code(),
                                status="active",
                                created_at=now,
                                updated_at=now,
                            )
                        )
                    break
                except IntegrityError as exc:
                    constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
                    if getattr(exc.orig, "sqlstate", None) != "23505" or constraint not in {
                        "uq_class_join_codes_code",
                        "uq_class_join_codes_active_code",
                    }:
                        raise
            else:
                raise IdentityError(
                    503, "code_capacity", "A class code could not be reserved. Retry this request later."
                )
            complete_onboarding(user)
            repo.flush()
            result = repo.describe(classroom)
    # No class/code is returned until the authenticated transaction commits.
    return result


def list_classes(repo, raw, settings, limit=50, offset=0):
    with authenticated_session(repo, raw, settings) as (_, user):
        require_instructor(user)
        classes = [repo.describe(row) for row in repo.mine(user.id, limit, offset)]
    return classes


def read_class(repo, raw, settings, class_id):
    with authenticated_session(repo, raw, settings) as (_, user):
        require_instructor(user)
        classroom = repo.owned(user.id, class_id)
        if classroom is None:
            raise IdentityError(404, "class_not_found", "Class not found.")
        result = repo.describe(classroom)
    return result


def update_class(repo, raw, settings, class_id, payload: ClassUpdate):
    with authenticated_session(repo, raw, settings) as (_, user):
        require_instructor(user)
        classroom = repo.owned(user.id, class_id)
        if classroom is None:
            raise IdentityError(404, "class_not_found", "Class not found.")
        if classroom.status != "active":
            raise IdentityError(409, "class_archived", "Archived classes cannot be edited.")
        old = repo.describe(classroom)
        context_change = (payload.grade_level is not None and payload.grade_level != old.grade_level) or (
            payload.language is not None and payload.language != old.language
        )
        if context_change and repo.has_context(classroom):
            raise IdentityError(
                409,
                "class_context_locked",
                "Grade and language cannot change after a subject, membership or learning activity is attached.",
            )
        if payload.class_name is not None:
            classroom.class_name = payload.class_name
        if "description" in payload.model_fields_set:
            classroom.description = payload.description
        if payload.grade_level is not None:
            classroom.grade_level_id = repo.ensure_grade(payload.grade_level)
        if payload.language is not None:
            classroom.language = payload.language
        repo.flush()
        result = repo.describe(classroom)
    return result
