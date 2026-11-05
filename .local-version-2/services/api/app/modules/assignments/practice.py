"""Personal review of shared classroom questions, separate from grades and research."""

from datetime import datetime, timezone
import hashlib
import json
from typing import Annotated

from pydantic import Field, StrictBool, StrictStr
from sqlalchemy import select

from app.models.assignment_practice import AssignmentPracticeState
from app.models.assessments import QuestionAnswerKey, QuestionRevision
from app.models.grading import GradingItemResult
from app.models.research_classrooms import ResearchClassroomBinding
from app.models.vocabulary_review import ESRProtocol
from app.modules.assignments.results import describe, fail, student_result_context
from app.modules.assignments.results_schemas import Model
from app.modules.grading.engine import evaluate
from app.modules.identity.errors import IdentityError
from app.modules.spaced_repetition.fsrs6 import calculate_fsrs6
from app.modules.vocabulary_review.policy import effective_rating
from app.modules.vocabulary_review.schemas import Rating
from app.schemas.capture import complete


METHODS = {"multiple_choice", "true_false", "identification"}


class PracticeInput(Model):
    answer: dict[str, Annotated[StrictStr, Field(max_length=8000)] | StrictBool] = Field(max_length=1)
    rating: Rating
    revision: int = Field(ge=0, strict=True)


def review_items(view):
    eligible = (
        item
        for item in view.items
        if item.state == "AUTO_GRADABLE"
        and item.answer is not None
        and type(item.correct) is bool
        and item.question.definition.method in METHODS
        and complete(item.question.definition.method, item.question.definition.content, item.answer)
    )
    return {item.result_id: item for item in eligible}


def projected(item, saved, submitted_at, now, *, baseline=False):
    if saved:
        due = saved.due_at
    elif baseline and not item.correct:
        due = submitted_at
    else:
        due = calculate_fsrs6({}, "good" if item.correct else "again", submitted_at).due_at
    return dict(
        result_id=item.result_id,
        assignment_question_id=item.assignment_question_id,
        question=item.question,
        due_at=due,
        is_due=due <= now,
        revision=saved.revision if saved else 0,
        last_correct=saved.last_correct if saved else None,
    )


def practice(repo, token, settings, assignment_id, *, item_id=None, payload=None, key=None):
    with student_result_context(repo, token, settings, assignment_id) as (db, classroom, root, version, attempt):
        if item_id is not None and attempt:
            # The result writer locks the same attempt before changing release visibility.
            db.refresh(attempt, with_for_update=True)
        view = describe(db, classroom, root, version, attempt)
        stage = (version.curriculum_snapshot.get("class_assessment") or {}).get("kind")
        baseline = stage == "pre_test"
        managed = db.scalar(
            select(ResearchClassroomBinding.id).where(ResearchClassroomBinding.class_id == classroom.id).limit(1)
        ) or db.scalar(select(ESRProtocol.id).where(ESRProtocol.class_id == classroom.id).limit(1))
        items = review_items(view) if view.released and view.submitted_at and not managed and stage != "post_test" else {}
        now = datetime.now(timezone.utc)
        if item_id is None:
            saved = (
                {
                    row.result_id: row
                    for row in db.scalars(
                        select(AssignmentPracticeState).where(AssignmentPracticeState.result_id.in_(items))
                    )
                }
                if items
                else {}
            )
            queue = [projected(item, saved.get(id), view.submitted_at, now, baseline=baseline) for id, item in items.items()]
            return dict(items=sorted(queue, key=lambda row: row["due_at"]))
        item = items.get(item_id)
        if item is None:
            raise fail()
        saved = db.get(AssignmentPracticeState, item_id, populate_existing=True)
        fingerprint = hashlib.sha256(json.dumps(payload.model_dump(), sort_keys=True).encode()).hexdigest()
        if saved and saved.request_id == key:
            if saved.fingerprint != fingerprint:
                raise fail(409)
            return projected(item, saved, view.submitted_at, now, baseline=baseline)
        entry = projected(item, saved, view.submitted_at, now, baseline=baseline)
        if payload.revision != entry["revision"] or not entry["is_due"]:
            raise IdentityError(409, "practice_not_due", "Refresh your review schedule before trying again.")
        evidence = db.get(GradingItemResult, item_id)
        question = db.get(QuestionRevision, item.question_revision_id)
        answer_key = db.get(QuestionAnswerKey, evidence.key_id) if evidence.key_id else None
        if not answer_key or answer_key.question_revision_id != question.id:
            raise fail()
        outcome = evaluate(
            question.method,
            question.content,
            answer_key.configuration,
            payload.answer,
            schema_version=question.schema_version,
            revision_locked=question.locked_at is not None,
            source_grading_version=answer_key.grading_version,
        )
        if outcome.reason not in {"exact_match", "exact_mismatch"}:
            raise IdentityError(422, "practice_answer_invalid", "Complete the practice answer before continuing.")
        memory = saved.memory if saved else {}
        if saved is None and not baseline:
            memory = calculate_fsrs6({}, "good" if item.correct else "again", view.submitted_at).resulting_state
        decision = calculate_fsrs6(memory, effective_rating(outcome.correct, payload.rating), now)
        if saved is None:
            saved = AssignmentPracticeState(result_id=item_id)
            db.add(saved)
        saved.memory = dict(decision.resulting_state)
        saved.due_at = decision.due_at
        saved.revision = payload.revision + 1
        saved.request_id = key
        saved.fingerprint = fingerprint
        saved.last_correct = outcome.correct
        db.flush()
        return projected(item, saved, view.submitted_at, now, baseline=baseline)
