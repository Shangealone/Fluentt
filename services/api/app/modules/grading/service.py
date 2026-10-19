"""Live administrator permissions and immutable evaluation persistence in one transaction."""

from copy import deepcopy
from datetime import datetime, timezone
from sqlalchemy import select, text, and_
from sqlalchemy.exc import DBAPIError
from app.models.assessments import (
    Assignment,
    AssignmentVersion,
    AssignmentAttempt,
    AssignmentQuestion,
    QuestionRevision,
    QuestionAnswerKey,
    StudentResponse,
)
from app.models.grading import GradingRun, GradingItemResult
from app.models.operations import AuditLog
from app.modules.administration.service import resolve_session
from app.modules.identity.errors import IdentityError
from app.modules.grading.engine import ENGINE_VERSION, POLICY_VERSION, POLICY, Outcome, evaluate, aggregate
from app.modules.grading.schemas import RunView, RunSummary, ItemView, Page


def fail(status=409, message="Evaluation is unavailable or requires operator review."):
    return IdentityError(status, "grading_unavailable", message)


def describe(db, run):
    if run.completed_at is None:
        raise fail()
    items = list(
        db.scalars(
            select(GradingItemResult).where(GradingItemResult.run_id == run.id).order_by(GradingItemResult.position)
        )
    )
    return RunView(
        **RunSummary.model_validate(run).model_dump(),
        policy_snapshot=run.policy_snapshot,
        items=[ItemView.model_validate(item) for item in items],
    )


def execute(
    admin, token, *, action, attempt_id=None, run_id=None, query=None, payload=None, csrf=None, request_id=None
):
    db = admin.session

    def operation(user):
        if action == "read":
            run = db.get(GradingRun, run_id, populate_existing=True)
            if run is None:
                raise fail(404, "Evaluation not found.")
            return describe(db, run)
        if action == "list":
            rows = list(
                db.scalars(
                    select(GradingRun)
                    .where(GradingRun.attempt_id == attempt_id, GradingRun.completed_at.is_not(None))
                    .order_by(GradingRun.evaluated_at.desc(), GradingRun.id)
                    .offset(query.offset)
                    .limit(query.limit + 1)
                )
            )
            return Page(
                items=[RunSummary.model_validate(row) for row in rows[: query.limit]],
                has_more=len(rows) > query.limit,
                offset=query.offset,
                limit=query.limit,
            )
        if payload.policy_version != POLICY_VERSION:
            raise fail(422, "This grading policy is not supported.")
        db.execute(text("SELECT pg_advisory_xact_lock_shared(78090001)"))
        attempt = db.scalar(
            select(AssignmentAttempt)
            .where(AssignmentAttempt.id == attempt_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if attempt is None:
            raise fail(404, "Finalized classroom attempt not found.")
        version = db.get(AssignmentVersion, attempt.assignment_version_id, populate_existing=True)
        root = db.get(Assignment, version.assignment_id, populate_existing=True) if version else None
        if (
            attempt.capture_contract != "unscored-capture-v1"
            or attempt.status != "submitted"
            or attempt.submitted_at is None
            or attempt.submission_key is None
            or attempt.submission_fingerprint is None
            or attempt.attempt_number != 1
            or attempt.score is not None
            or attempt.maximum_score is not None
            or attempt.expires_at is not None
            or not isinstance(attempt.capture_state, dict)
            or not isinstance(attempt.capture_state.get("revealed"), list)
            or any(not isinstance(value, str) for value in attempt.capture_state["revealed"])
            or type(attempt.capture_state.get("position")) is not int
            or version is None
            or version.publication_contract != "distribution-only-v1"
            or version.locked_at is None
            or root is None
            or root.status != "published"
        ):
            raise fail(409, "Only finalized ordinary classroom captures may be evaluated.")
        existing = db.scalar(
            select(GradingRun).where(
                GradingRun.attempt_id == attempt.id,
                GradingRun.engine_version == ENGINE_VERSION,
                GradingRun.policy_version == POLICY_VERSION,
            )
        )
        if existing:
            return describe(db, existing)
        evidence = db.execute(
            select(AssignmentQuestion, QuestionRevision, QuestionAnswerKey, StudentResponse)
            .join(QuestionRevision, AssignmentQuestion.question_revision_id == QuestionRevision.id)
            .outerjoin(QuestionAnswerKey, QuestionAnswerKey.question_revision_id == QuestionRevision.id)
            .outerjoin(
                StudentResponse,
                and_(
                    StudentResponse.assignment_question_id == AssignmentQuestion.id,
                    StudentResponse.attempt_id == attempt.id,
                ),
            )
            .where(AssignmentQuestion.assignment_version_id == version.id)
            .order_by(AssignmentQuestion.position)
        ).all()
        if (
            not evidence
            or len(evidence) > 200
            or [row[0].position for row in evidence] != list(range(1, len(evidence) + 1))
        ):
            raise fail(409, "Assignment evidence is incomplete; operator review is required.")
        outcomes = []
        for entry, row, key, response in evidence:
            invalid_response = response is not None and (
                response.submitted_at != attempt.submitted_at
                or response.grading_status != "unscored"
                or any(
                    value is not None
                    for value in (
                        response.correct,
                        response.awarded_points,
                        response.response_duration_ms,
                        response.feedback,
                        response.grading_version,
                    )
                )
                or (row.method == "flashcards" and str(entry.id) not in attempt.capture_state.get("revealed", []))
            )
            if invalid_response:
                outcomes.append(Outcome("MANUAL_REVIEW_REQUIRED", "invalid_submission_evidence"))
                continue
            outcomes.append(
                evaluate(
                    row.method,
                    row.content,
                    key.configuration if key else None,
                    response.answer if response else None,
                    schema_version=row.schema_version,
                    revision_locked=row.locked_at is not None,
                    key_locked=row.locked_at is not None,
                    source_grading_version=key.grading_version if key else None,
                )
            )
        now = datetime.now(timezone.utc)
        run = GradingRun(
            attempt_id=attempt.id,
            assignment_version_id=version.id,
            actor_id=user.id,
            engine_version=ENGINE_VERSION,
            policy_version=POLICY_VERSION,
            policy_snapshot=deepcopy(POLICY),
            evaluated_at=now,
            context="ordinary_classroom",
            item_count=len(evidence),
            **aggregate(outcomes),
        )
        db.add(run)
        db.flush()
        for (entry, row, key, response), outcome in zip(evidence, outcomes, strict=True):
            db.add(
                GradingItemResult(
                    run_id=run.id,
                    assignment_version_id=version.id,
                    assignment_question_id=entry.id,
                    question_revision_id=row.id,
                    response_id=response.id if response else None,
                    key_id=key.id if key else None,
                    source_grading_version=key.grading_version if key else None,
                    rubric_version=POLICY_VERSION,
                    method=row.method,
                    position=entry.position,
                    state=outcome.state,
                    reason=outcome.reason,
                    correct=outcome.correct,
                    awarded_points=outcome.awarded_points,
                    max_points=outcome.max_points,
                    evaluation_metadata={
                        "response_present": response is not None,
                        "schema_version": row.schema_version,
                    },
                )
            )
        db.flush()
        run.completed_at = datetime.now(timezone.utc)
        db.add(
            AuditLog(
                actor_id=user.id,
                action="grading.evaluate",
                entity_type="grading_run",
                entity_id=run.id,
                occurred_at=now,
                request_id=request_id,
                safe_metadata={
                    "engine_version": ENGINE_VERSION,
                    "policy_version": POLICY_VERSION,
                    "status": run.status,
                },
            )
        )
        db.flush()
        return describe(db, run)

    try:
        return resolve_session(
            admin,
            token,
            csrf=csrf,
            request_id=request_id,
            required_permission="grading.read",
            additional_permissions=("grading.run",) if action == "evaluate" else (),
            mutation_operation=operation if action == "evaluate" else None,
            read_operation=operation if action != "evaluate" else None,
        )
    except DBAPIError as exc:
        if getattr(exc.orig, "sqlstate", None) in {"23503", "23505", "23514", "40001", "40P01"}:
            raise fail() from exc
        raise
