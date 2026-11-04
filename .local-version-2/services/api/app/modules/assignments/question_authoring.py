"""Explicit publication of private class questions; no shared-bank authoring grant."""
import hashlib
import json
from datetime import datetime, timezone
from sqlalchemy import select, text, exists, or_
from app.models.instructor_questions import InstructorLessonQuestion
from app.models.assessments import Question, QuestionRevision, QuestionAnswerKey
from app.models.operations import AuditLog
from app.modules.identity.session_service import authenticated_session
from app.modules.classrooms.service import require_instructor
from app.modules.assignments.service import fail, lesson_path, context_for, public_item


def shared_question_scope():
    return ~exists(select(InstructorLessonQuestion.id).where(InstructorLessonQuestion.question_id == Question.id))


def class_question_scope(classroom):
    return or_(shared_question_scope(), exists(select(InstructorLessonQuestion.id).where(
        InstructorLessonQuestion.question_id == Question.id,
        InstructorLessonQuestion.class_id == classroom.id,
        InstructorLessonQuestion.instructor_id == classroom.instructor_id)))


def publish_question(repo, credential, settings, class_id, payload, request_key, request_id=None):
    db = repo.session
    with authenticated_session(repo, credential, settings) as (_, user):
        require_instructor(user)
        classroom = repo.owned(user.id, class_id)
        if not classroom or classroom.archived_at or classroom.status != "active":
            raise fail(404, "Choose an active class you own.")
        db.execute(text("SELECT pg_advisory_xact_lock(78090001)"))
        path = lesson_path(db, classroom, payload.lesson_id)
        if path is None or context_for(path).source != "curriculum":
            raise fail(422, "For your own lesson, create a new lesson version to add questions.")
        digest = hashlib.sha256(json.dumps({"class_id": str(class_id), "body": payload.model_dump(mode="json")}, sort_keys=True).encode()).hexdigest()
        prior = db.scalar(select(InstructorLessonQuestion).where(
            InstructorLessonQuestion.instructor_id == user.id, InstructorLessonQuestion.request_id == request_key))
        if prior:
            if prior.fingerprint != digest:
                raise fail(409, "This request identity already belongs to different question details.")
            revision = db.scalar(select(QuestionRevision).where(QuestionRevision.question_id == prior.question_id))
            return public_item(db, classroom, revision)
        definition = payload.question
        question = Question(author_id=user.id, status="draft")
        db.add(question); db.flush()
        db.add(InstructorLessonQuestion(instructor_id=user.id, class_id=class_id, lesson_id=payload.lesson_id,
                                       question_id=question.id, request_id=request_key, fingerprint=digest))
        db.flush()
        revision = QuestionRevision(question_id=question.id, lesson_id=payload.lesson_id, version=1,
            method=definition.method, language=classroom.language, prompt=definition.prompt,
            instructions=definition.instructions, difficulty=definition.difficulty, points=1,
            schema_version=1, content=definition.content)
        db.add(revision); db.flush()
        db.add(QuestionAnswerKey(question_revision_id=revision.id, configuration=definition.answer_key, grading_version="ungraded-v1"))
        db.flush()
        revision.locked_at = datetime.now(timezone.utc)
        question.status = "published"
        db.add(AuditLog(actor_id=user.id, action="instructor_question.published", entity_type="questions", entity_id=question.id,
                        occurred_at=datetime.now(timezone.utc), request_id=request_id, safe_metadata={"class_id": str(class_id), "lesson_id": str(payload.lesson_id)}))
        db.flush()
        return public_item(db, classroom, revision)
