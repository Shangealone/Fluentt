"""Managed research has no approved live participant/treatment workflow yet."""

from sqlalchemy import select
from app.models.research import ResearchStudy, ResearchIdentityLink
from app.models.research_classrooms import ResearchClassroomBinding
from app.modules.identity.errors import IdentityError

CONTRACT = "research-classrooms-v1"


def unavailable():
    return IdentityError(
        409,
        "research_classroom_execution_blocked",
        "Research Classroom participation and reviews require an approved classroom-specific consent and treatment workflow, which is unavailable.",
    )


def assert_no_managed_execution(study):
    if study and (study.conditions or {}).get("research_contract") == CONTRACT:
        raise unavailable()


def guard_managed_review(db, user, context_type, *, study_id=None, class_id=None):
    # Default-off: no research query or behavior change for personal/ordinary requests.
    if context_type != "research":
        return
    if study_id is not None:
        assert_no_managed_execution(db.get(ResearchStudy, study_id))
    if (
        class_id is not None
        and db.scalar(select(ResearchClassroomBinding.id).where(ResearchClassroomBinding.class_id == class_id).limit(1))
        is not None
    ):
        raise unavailable()
    # The legacy resolver ignores study_id; refuse an ambiguous managed identity as well.
    linked = db.scalar(
        select(ResearchStudy.id)
        .join(
            ResearchIdentityLink,
            ResearchIdentityLink.study_id == ResearchStudy.id,
        )
        .where(
            ResearchIdentityLink.user_id == user.id,
            ResearchStudy.conditions["research_contract"].as_string() == CONTRACT,
        )
        .limit(1)
    )
    if linked is not None:
        raise unavailable()
