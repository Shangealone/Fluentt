"""Bounded SQL projections: no answers, private keys or research tables."""

from sqlalchemy import select, func, case, and_, or_, true, cast, String
from app.models.assessments import Assignment, AssignmentVersion, AssignmentAttempt
from app.models.users import Classroom
from app.models.grading import GradingRun
from app.models.result_release import AssessmentResultRelease as Release


def published_assignments(class_ids):
    return (
        select(
            Assignment.id,
            AssignmentVersion.id.label("version_id"),
            Assignment.class_id,
            Classroom.class_name,
            Classroom.language,
            AssignmentVersion.title,
            AssignmentVersion.curriculum_snapshot,
            AssignmentVersion.locked_at.label("published_at"),
        )
        .select_from(Assignment)
        .join(AssignmentVersion, AssignmentVersion.assignment_id == Assignment.id)
        .join(
            Classroom,
            Classroom.id == Assignment.class_id,
        )
        .where(
            Assignment.class_id.in_(class_ids),
            Assignment.instructor_id == Classroom.instructor_id,
            Assignment.status == "published",
            AssignmentVersion.publication_contract == "distribution-only-v1",
            AssignmentVersion.locked_at.is_not(None),
        )
    )


def assignments(student_id, class_ids, *, student_source=None):
    statement = published_assignments(class_ids)
    if student_source is not None:
        statement = statement.join(student_source, true())
    return statement.add_columns(
        AssignmentAttempt.id.label("attempt_id"),
        AssignmentAttempt.started_at,
        AssignmentAttempt.updated_at.label("last_activity_at"),
        AssignmentAttempt.submitted_at,
        AssignmentAttempt.capture_contract,
        AssignmentAttempt.expires_at,
        func.coalesce(cast(AssignmentAttempt.status, String), "not_started").label("submission_status"),
        func.coalesce(AssignmentAttempt.submitted_at, AssignmentAttempt.updated_at, AssignmentVersion.locked_at).label(
            "sort_at"
        ),
    ).outerjoin(
        AssignmentAttempt,
        and_(
            AssignmentAttempt.assignment_version_id == AssignmentVersion.id,
            AssignmentAttempt.student_id == student_id,
            AssignmentAttempt.attempt_number == 1,
        ),
    )


def with_results(page):
    # Enrich the already bounded page, rather than joining all activity/results.
    decision = (
        select(Release.run_id, Release.released)
        .where(
            Release.attempt_id == page.c.attempt_id,
        )
        .order_by(Release.sequence.desc())
        .limit(1)
        .lateral("visibility")
    )
    run = (
        select(
            GradingRun.id.label("run_id"),
            GradingRun.status.label("run_status"),
            GradingRun.policy_version,
            GradingRun.engine_version,
            GradingRun.earned_points,
            GradingRun.possible_points,
        )
        .where(
            GradingRun.attempt_id == page.c.attempt_id,
            GradingRun.assignment_version_id == page.c.version_id,
            GradingRun.context == "ordinary_classroom",
            GradingRun.completed_at.is_not(None),
            or_(decision.c.run_id.is_(None), GradingRun.id == decision.c.run_id),
        )
        .order_by(GradingRun.evaluated_at.desc(), GradingRun.id)
        .limit(1)
        .lateral("evaluation")
    )
    released = and_(
        decision.c.released.is_(True), run.c.run_status == "COMPLETE", page.c.submission_status == "submitted"
    )
    return (
        select(
            page,
            run.c.run_status,
            released.label("released"),
            case((released, run.c.run_id)).label("released_run_id"),
            case((released, run.c.policy_version)).label("policy_version"),
            case((released, run.c.engine_version)).label("engine_version"),
            case((released, run.c.earned_points)).label("earned_points"),
            case((released, run.c.possible_points)).label("possible_points"),
        )
        .select_from(page)
        .outerjoin(decision, true())
        .outerjoin(run, true())
        .order_by(page.c.sort_at.desc(), page.c.id)
    )
