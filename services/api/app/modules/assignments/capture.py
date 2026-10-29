"""One unscored attempt per pinned publication; live class authorization on every request."""

import hashlib
import json
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from app.models.assessments import (
    Assignment,
    AssignmentVersion,
    AssignmentAttempt,
    StudentResponse,
    QuestionRevision,
    QuestionAnswerKey,
)
from app.modules.assignments.publication import student_context, CONTRACT as PUBLICATION
from app.modules.assignments.service import children, public_item, fail
from app.modules.assignments.capture_schemas import AttemptView, CaptureItem, ResponseInput, BackView
from app.modules.identity.errors import IdentityError
from app.models.operations import AuditLog
from app.schemas.capture import CONTRACT, validate_capture, complete


def responses(db, attempt):
    return list(
        db.scalars(
            select(StudentResponse)
            .where(StudentResponse.attempt_id == attempt.id)
            .order_by(StudentResponse.assignment_question_id)
            .execution_options(populate_existing=True)
        )
    )


def revision(db, attempt):
    state = [str(attempt.id), str(attempt.updated_at), attempt.status, attempt.capture_state]
    state.extend((str(row.id), str(row.updated_at)) for row in responses(db, attempt))
    return hashlib.sha256(json.dumps(state, sort_keys=True).encode()).hexdigest()


def view(db, classroom, root, version, attempt):
    entries = children(db, version)
    saved = {row.assignment_question_id: row.answer for row in responses(db, attempt)}
    questions, count = [], 0
    for entry in entries:
        row = db.get(QuestionRevision, entry.question_revision_id, populate_existing=True)
        count += int(complete(row.method, row.content, saved.get(entry.id)))
        if attempt.status != "submitted":
            questions.append(
                CaptureItem(**public_item(db, classroom, row).model_dump(), assignment_question_id=entry.id)
            )
    final = attempt.status == "submitted"
    return AttemptView(
        id=attempt.id,
        assignment_id=root.id,
        class_id=classroom.id,
        version_id=version.id,
        title=version.title,
        instructions=version.instructions,
        status=attempt.status,
        revision=revision(db, attempt),
        started_at=attempt.started_at.isoformat(),
        submitted_at=attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        position=attempt.capture_state["position"],
        question_count=len(entries),
        completed_count=count,
        questions=questions,
        responses=[]
        if final
        else [ResponseInput(assignment_question_id=id, answer=value) for id, value in saved.items()],
        revealed_item_ids=[] if final else attempt.capture_state["revealed"],
    )


def execute(
    repo,
    token,
    settings,
    *,
    action,
    assignment_id=None,
    attempt_id=None,
    item_id=None,
    payload=None,
    expected=None,
    request_key=None,
    request_id=None,
):
    db = repo.session
    # Resolve only the parent identifier before entering the same authenticated transaction.
    # No database access/authorization occurs outside student_context.
    try:
        if attempt_id:
            # student_context accepts a resolver evaluated after locking the authenticated student.
            def resolver(user):
                return db.scalar(
                    select(AssignmentVersion.assignment_id)
                    .join(AssignmentAttempt)
                    .where(AssignmentAttempt.id == attempt_id, AssignmentAttempt.student_id == user.id)
                )
        else:
            resolver = assignment_id
        with student_context(repo, token, settings, assignment_id=resolver) as (db, user, classroom):
            if callable(resolver):
                assignment_id = db.scalar(
                    select(AssignmentVersion.assignment_id)
                    .join(AssignmentAttempt)
                    .where(AssignmentAttempt.id == attempt_id, AssignmentAttempt.student_id == user.id)
                )
            root = db.get(Assignment, assignment_id, populate_existing=True)
            version = db.scalar(
                select(AssignmentVersion).where(
                    AssignmentVersion.assignment_id == assignment_id,
                    AssignmentVersion.publication_contract == PUBLICATION,
                    AssignmentVersion.locked_at.is_not(None),
                )
            )
            if (
                root is None
                or root.status != "published"
                or root.class_id != classroom.id
                or version is None
                or root.instructor_id != classroom.instructor_id
                or version.curriculum_snapshot.get("context", {}).get("subject_id") != str(classroom.subject_id)
            ):
                raise fail(404, "Assignment attempt unavailable.")
            attempt = db.scalar(
                select(AssignmentAttempt)
                .where(AssignmentAttempt.assignment_version_id == version.id, AssignmentAttempt.student_id == user.id)
                .order_by(AssignmentAttempt.attempt_number)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if attempt is None:
                if action != "start":
                    raise fail(404, "Assignment attempt unavailable.")
                attempt = AssignmentAttempt(
                    assignment_version_id=version.id,
                    student_id=user.id,
                    attempt_number=1,
                    started_at=datetime.now(timezone.utc),
                    status="in_progress",
                    capture_contract=CONTRACT,
                    capture_state={"position": 1, "revealed": []},
                )
                db.add(attempt)
                db.flush()
                audit(db, user.id, attempt, "start", request_id)
            if attempt.capture_contract != CONTRACT or (attempt_id and attempt.id != attempt_id):
                raise fail(409, "Historical attempts require operator review.")
            if action in {"start", "read"}:
                return view(db, classroom, root, version, attempt)
            digest = (
                hashlib.sha256(json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode()).hexdigest()
                if payload
                else None
            )
            if action == "submit" and attempt.status == "submitted" and attempt.submission_fingerprint == digest:
                return view(db, classroom, root, version, attempt)
            if attempt.status != "in_progress":
                raise fail(409, "This assignment has already been submitted.")
            if not expected:
                raise IdentityError(428, "attempt_revision_required", "Reload saved progress before changing it.")
            if expected.strip('"') != revision(db, attempt):
                raise fail(409, "Saved progress changed. Reload before trying again.")
            entries = {entry.id: entry for entry in children(db, version)}
            if action == "reveal":
                entry = entries.get(item_id)
                row = db.get(QuestionRevision, entry.question_revision_id) if entry else None
                if row is None or row.method != "flashcards":
                    raise fail(404, "Flashcard unavailable.")
                back = db.scalar(
                    select(QuestionAnswerKey.configuration).where(QuestionAnswerKey.question_revision_id == row.id)
                )
                if not back or not isinstance(back.get("back"), str):
                    raise fail(409, "Flashcard content requires operator review.")
                if str(item_id) not in attempt.capture_state["revealed"]:
                    attempt.capture_state = {
                        **attempt.capture_state,
                        "revealed": [*attempt.capture_state["revealed"], str(item_id)],
                    }
                    db.flush()
                return BackView(revision_id=row.id, back=back["back"], attempt_revision=revision(db, attempt))
            if payload.position > len(entries):
                raise fail(422, "Choose a question in this assignment.")
            values = {}
            try:
                for response in payload.responses:
                    entry = entries.get(response.assignment_question_id)
                    if entry is None or entry.id in values:
                        raise ValueError("Unknown or duplicate question")
                    row = db.get(QuestionRevision, entry.question_revision_id)
                    validate_capture(row.method, row.content, response.answer)
                    if row.method == "flashcards" and str(entry.id) not in attempt.capture_state["revealed"]:
                        raise ValueError("Reveal the card before reporting recall")
                    values[entry.id] = response.answer
                if len(json.dumps(payload.model_dump(mode="json")).encode()) > 1048576:
                    raise ValueError("Progress request too large")
            except (ValueError, TypeError):
                raise fail(422, "Check response fields, identifiers and input limits before saving.") from None
            now = datetime.now(timezone.utc)
            old = {row.assignment_question_id: row for row in responses(db, attempt)}
            for id, row in old.items():
                if id not in values:
                    db.delete(row)
            for id, answer in values.items():
                row = old.get(id)
                if row is None:
                    row = StudentResponse(
                        attempt_id=attempt.id,
                        assignment_question_id=id,
                        assignment_version_id=version.id,
                        answer=answer,
                        grading_status="unscored",
                    )
                    db.add(row)
                row.answer = answer
                if action == "submit":
                    row.submitted_at = now
            db.flush()
            attempt.capture_state = {**attempt.capture_state, "position": payload.position}
            if action == "submit":
                attempt.status = "submitted"
                attempt.submitted_at = now
                attempt.submission_key = request_key
                attempt.submission_fingerprint = digest
            audit(db, user.id, attempt, action, request_id)
            db.flush()
            return view(db, classroom, root, version, attempt)
    except DBAPIError as exc:
        if getattr(exc.orig, "sqlstate", None) in {"23503", "23505", "23514", "40001", "40P01"}:
            raise fail(409, "Progress changed. Reload the saved attempt before retrying.") from exc
        raise


def audit(db, actor, attempt, action, request_id):
    db.add(
        AuditLog(
            actor_id=actor,
            action="assignment_attempts." + action,
            entity_type="assignment_attempt",
            entity_id=attempt.id,
            occurred_at=datetime.now(timezone.utc),
            request_id=request_id,
            safe_metadata={"contract": CONTRACT},
        )
    )
