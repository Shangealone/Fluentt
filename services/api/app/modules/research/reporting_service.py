"""Fail closed for managed research reporting; never query participant observations."""

from sqlalchemy import select
from app.models.research import ResearchStudy
from app.models.research_classrooms import ResearchClassroomStudy
from app.modules.administration.service import resolve_session
from .classroom_service import CONTRACT, _scope, fail


def assert_legacy_reporting_allowed(study):
    if (study.conditions or {}).get("research_contract") == CONTRACT:
        raise fail(
            "research_reporting_blocked",
            "Research Classroom reporting/export is blocked until approved participant, instrument, analysis and disclosure contracts exist.",
        )


def blocked_export(repo, token, scope_id, dataset):
    def operation(actor):
        _scope(repo.session, actor, scope_id)
        # A dataset name/permission never authorizes an unapproved disclosure.
        raise fail(
            "research_export_blocked", "No eligible thesis dataset is available under an approved disclosure policy."
        )

    return resolve_session(
        repo,
        token,
        required_permission="research.export",
        additional_permissions=("research.read",),
        read_operation=operation,
    )


def guard_legacy_reporting(repo, token, study_id, *, export=False):
    """Use real live admin authorization before legacy wrappers with older repository contracts.

    Unmarked studies retain their legacy path. Managed roots may not bypass the
    new manager boundary or reuse old aggregates, codebooks or CSV serializers.
    """

    def operation(actor):
        study = repo.session.get(ResearchStudy, study_id)
        if study and (study.conditions or {}).get("research_contract") == CONTRACT:
            scope = repo.session.scalar(
                select(ResearchClassroomStudy).where(
                    ResearchClassroomStudy.study_id == study.id,
                    ResearchClassroomStudy.manager_id == actor.id,
                )
            )
            if scope is None:
                raise fail("research_study_not_found", "Research configuration not found.", 404)
            if export and "research.export" not in repo.permissions(actor.id):
                raise fail("admin_permission_required", "Explicit research export permission is required.", 403)
            assert_legacy_reporting_allowed(study)

    return resolve_session(repo, token, required_permission="research.read", read_operation=operation)
