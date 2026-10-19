"""Live classroom authorization and explicit visibility, never grading or key retrieval."""

from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from app.models.assessments import Assignment, AssignmentVersion, AssignmentAttempt, QuestionRevision, StudentResponse
from app.models.grading import GradingRun, GradingItemResult
from app.models.result_release import AssessmentResultRelease as Release
from app.models.users import User, ClassMembership
from app.models.operations import AuditLog
from app.schemas.capture import validate_capture
from app.modules.identity.session_service import authenticated_session
from app.modules.identity.errors import IdentityError
from app.modules.classrooms.service import require_instructor
from app.modules.assignments.publication import student_context
from app.modules.assignments.service import public_item
from app.modules.assignments.results_schemas import (
    ResultView,
    ReviewItem,
    Evaluation,
    ResultPage,
    ResultSummary,
    EvaluationPage,
)


def fail(status=404):
    return IdentityError(status, "result_unavailable", "Result unavailable. Refresh before trying again.")


def current(db, attempt_id):
    return db.scalar(select(Release).where(Release.attempt_id == attempt_id).order_by(Release.sequence.desc()).limit(1))


def revision(attempt_id, event):
    return hashlib.sha256(f"{attempt_id}:{event.id if event else 'withheld'}".encode()).hexdigest()


def result_state(submission_status, run_status=None, released=False):
    """Shared lifecycle projection; no totals or evaluation execution."""
    if submission_status != "submitted":
        return "not_submitted"
    if not run_status:
        return "submitted"
    if released and run_status == "COMPLETE":
        return "released"
    return {"COMPLETE": "withheld", "REVIEW_REQUIRED": "awaiting_manual_review", "NOT_APPLICABLE": "not_applicable"}[
        run_status
    ]


def eligible_user():
    return (User.role == "school_student", User.profile_status == "active", User.archived_at.is_(None))


def member_statement(class_id):
    return (
        select(User)
        .join(ClassMembership, ClassMembership.student_id == User.id)
        .where(
            ClassMembership.class_id == class_id,
            ClassMembership.status == "active",
            ClassMembership.ended_at.is_(None),
            *eligible_user(),
        )
    )


@contextmanager
def owner_context(repo, token, settings, *, assignment_id=None, attempt_id=None):
    db = repo.session
    with authenticated_session(repo, token, settings) as (_, user):
        require_instructor(user)
        if attempt_id:
            assignment_id = db.scalar(
                select(AssignmentVersion.assignment_id)
                .join(AssignmentAttempt)
                .where(
                    AssignmentAttempt.id == attempt_id,
                )
            )
        root = db.scalar(select(Assignment).where(Assignment.id == assignment_id, Assignment.instructor_id == user.id))
        if root is None:
            raise fail()
        classroom = repo.owned(user.id, root.class_id)
        if classroom is None:
            raise fail()
        db.refresh(classroom)
        if classroom.status != "active" or classroom.archived_at is not None:
            raise fail()
        db.execute(text("SELECT pg_advisory_xact_lock_shared(78090001)"))
        version = db.scalar(
            select(AssignmentVersion).where(
                AssignmentVersion.assignment_id == root.id,
                AssignmentVersion.publication_contract == "distribution-only-v1",
                AssignmentVersion.locked_at.is_not(None),
            )
        )
        if root.status != "published" or version is None:
            raise fail()
        yield db, user, classroom, root, version


def owned_attempt(db, classroom, version, attempt_id):
    # A student request locks student -> owner. Never wait for that student while
    # holding owner/class locks: NOWAIT converts that inverse wait into a safe retry.
    student_id = db.scalar(
        select(AssignmentAttempt.student_id).where(
            AssignmentAttempt.id == attempt_id,
            AssignmentAttempt.assignment_version_id == version.id,
            AssignmentAttempt.capture_contract == "unscored-capture-v1",
            AssignmentAttempt.status == "submitted",
        )
    )
    student = db.scalar(
        member_statement(classroom.id)
        .where(User.id == student_id)
        .with_for_update(of=User, read=True, nowait=True)
        .execution_options(populate_existing=True)
    )
    if student is None:
        raise fail()
    membership = db.scalar(
        select(ClassMembership)
        .where(
            ClassMembership.class_id == classroom.id,
            ClassMembership.student_id == student.id,
            ClassMembership.status == "active",
            ClassMembership.ended_at.is_(None),
        )
        .with_for_update(read=True)
        .execution_options(populate_existing=True)
    )
    if membership is None:
        raise fail()
    attempt = db.scalar(
        select(AssignmentAttempt)
        .where(
            AssignmentAttempt.id == attempt_id,
            AssignmentAttempt.assignment_version_id == version.id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not attempt or attempt.status != "submitted" or attempt.submitted_at is None:
        raise fail()
    return attempt, student


def selected_run(db, attempt, event, run_id=None):
    if not attempt or attempt.status != "submitted":
        return None
    statement = select(GradingRun).where(
        GradingRun.attempt_id == attempt.id,
        GradingRun.assignment_version_id == attempt.assignment_version_id,
        GradingRun.completed_at.is_not(None),
        GradingRun.context == "ordinary_classroom",
    )
    if event:
        if run_id and run_id != event.run_id:
            raise fail(409)
        statement = statement.where(GradingRun.id == event.run_id)
    elif run_id:
        statement = statement.where(GradingRun.id == run_id)
    run = db.scalar(statement.order_by(GradingRun.evaluated_at.desc(), GradingRun.id).limit(1))
    if run_id and run is None:
        raise fail()
    return run


def describe(db, classroom, root, version, attempt, *, instructor=False, student=None, run_id=None):
    event = current(db, attempt.id) if attempt else None
    run = selected_run(db, attempt, event, run_id)
    released = bool(event and event.released and run and run.status == "COMPLETE")
    state = result_state(attempt.status if attempt else "not_started", run.status if run else None, released)
    disclose = bool(run and (instructor or released))
    items = []
    if disclose:
        entries = db.execute(
            select(GradingItemResult, QuestionRevision, StudentResponse)
            .join(
                QuestionRevision,
                GradingItemResult.question_revision_id == QuestionRevision.id,
            )
            .outerjoin(StudentResponse, GradingItemResult.response_id == StudentResponse.id)
            .where(
                GradingItemResult.run_id == run.id,
            )
            .order_by(GradingItemResult.position)
        ).all()
        if len(entries) != run.item_count:
            raise fail(409)
        for result, row, response in entries:
            answer = response.answer if response else None
            if answer is not None:
                try:
                    validate_capture(row.method, row.content, answer)
                except (ValueError, TypeError, KeyError, UnicodeError):
                    answer = None  # Retain malformed original evidence in storage; never reinterpret it for a widget.
            items.append(
                ReviewItem(
                    result_id=result.id,
                    assignment_question_id=result.assignment_question_id,
                    question_revision_id=result.question_revision_id,
                    response_id=result.response_id,
                    position=result.position,
                    question=public_item(db, classroom, row),
                    answer=answer,
                    state=result.state,
                    correct=result.correct,
                    awarded_points=result.awarded_points,
                    max_points=result.max_points,
                )
            )
    return ResultView(
        assignment_id=root.id,
        class_id=classroom.id,
        version_id=version.id,
        title=version.title,
        attempt_id=attempt.id if attempt else None,
        student_id=student.id if instructor and student else None,
        student_username=student.username if instructor and student else None,
        submitted_at=attempt.submitted_at if attempt else None,
        submission_status=attempt.status if attempt else "not_started",
        state=state,
        released=released,
        revision=revision(attempt.id if attempt else root.id, event),
        pinned_run_id=event.run_id if event and (instructor or released) else None,
        evaluation=Evaluation.model_validate(run, from_attributes=True) if run and (instructor or released) else None,
        earned_points=run.earned_points if disclose else None,
        possible_points=run.possible_points if disclose else None,
        items=items,
    )


def student_read(repo, token, settings, assignment_id):
    with student_context(repo, token, settings, assignment_id=assignment_id) as (db, user, classroom):
        root = db.get(Assignment, assignment_id, populate_existing=True)
        version = db.scalar(
            select(AssignmentVersion).where(
                AssignmentVersion.assignment_id == assignment_id,
                AssignmentVersion.publication_contract == "distribution-only-v1",
                AssignmentVersion.locked_at.is_not(None),
            )
        )
        if not root or root.instructor_id != classroom.instructor_id or not version:
            raise fail()
        attempt = db.scalar(
            select(AssignmentAttempt).where(
                AssignmentAttempt.assignment_version_id == version.id,
                AssignmentAttempt.student_id == user.id,
                AssignmentAttempt.capture_contract == "unscored-capture-v1",
                AssignmentAttempt.attempt_number == 1,
            )
        )
        return describe(db, classroom, root, version, attempt)


def execute(
    repo,
    token,
    settings,
    *,
    action,
    assignment_id=None,
    attempt_id=None,
    run_id=None,
    query=None,
    payload=None,
    expected=None,
    request_key=None,
    request_id=None,
):
    try:
        with owner_context(repo, token, settings, assignment_id=assignment_id, attempt_id=attempt_id) as (
            db,
            user,
            classroom,
            root,
            version,
        ):
            if action == "list":
                statement = (
                    select(AssignmentAttempt, User)
                    .join(User, AssignmentAttempt.student_id == User.id)
                    .where(
                        AssignmentAttempt.assignment_version_id == version.id,
                        AssignmentAttempt.capture_contract == "unscored-capture-v1",
                        AssignmentAttempt.status == "submitted",
                        User.id.in_(member_statement(classroom.id).with_only_columns(User.id)),
                    )
                )
                rows = db.execute(
                    statement.order_by(AssignmentAttempt.submitted_at.desc(), AssignmentAttempt.id)
                    .offset(query.offset)
                    .limit(query.limit + 1)
                ).all()
                return ResultPage(
                    items=[
                        ResultSummary(
                            attempt_id=row.id,
                            student_id=student.id,
                            student_username=student.username,
                            submitted_at=row.submitted_at,
                        )
                        for row, student in rows[: query.limit]
                    ],
                    offset=query.offset,
                    limit=query.limit,
                    has_more=len(rows) > query.limit,
                )
            attempt, student = owned_attempt(db, classroom, version, attempt_id)
            event = current(db, attempt.id)
            if action == "runs":
                rows = list(
                    db.scalars(
                        select(GradingRun)
                        .where(
                            GradingRun.attempt_id == attempt.id,
                            GradingRun.completed_at.is_not(None),
                            GradingRun.context == "ordinary_classroom",
                        )
                        .order_by(GradingRun.evaluated_at.desc(), GradingRun.id)
                        .offset(query.offset)
                        .limit(query.limit + 1)
                    )
                )
                return EvaluationPage(
                    items=[Evaluation.model_validate(row, from_attributes=True) for row in rows[: query.limit]],
                    has_more=len(rows) > query.limit,
                    offset=query.offset,
                    limit=query.limit,
                )
            if action == "release":
                replay = db.scalar(
                    select(Release).where(Release.actor_id == user.id, Release.request_key == request_key)
                )
                if replay:
                    if (
                        replay.attempt_id != attempt.id
                        or replay.run_id != payload.run_id
                        or replay.released != payload.released
                    ):
                        raise fail(409)
                    # A retry after a later withdrawal returns current visibility; it never resurrects access.
                    return describe(db, classroom, root, version, attempt, instructor=True, student=student)
                if not expected:
                    raise fail(428)
                if expected.strip('"') != revision(attempt.id, event):
                    raise fail(409)
                run = selected_run(db, attempt, event, payload.run_id)
                if not run or run.status != "COMPLETE" or (event is None and not payload.released):
                    raise fail(409)
                if event and event.released == payload.released:
                    raise fail(409)
                event = Release(
                    attempt_id=attempt.id,
                    run_id=run.id,
                    assignment_version_id=version.id,
                    actor_id=user.id,
                    request_key=request_key,
                    sequence=event.sequence + 1 if event else 1,
                    released=payload.released,
                )
                db.add(event)
                db.flush()
                db.add(
                    AuditLog(
                        actor_id=user.id,
                        action="results.release" if event.released else "results.withdraw",
                        entity_type="assessment_result_release",
                        entity_id=event.id,
                        occurred_at=datetime.now(timezone.utc),
                        request_id=request_id,
                        safe_metadata={
                            "attempt_id": str(attempt.id),
                            "run_id": str(run.id),
                            "sequence": event.sequence,
                        },
                    )
                )
            return describe(db, classroom, root, version, attempt, instructor=True, student=student, run_id=run_id)
    except DBAPIError as exc:
        if getattr(exc.orig, "sqlstate", None) in {"23503", "23505", "23514", "40001", "40P01", "55P03"}:
            raise fail(409) from exc
        raise
