"""Personal, unscored practice over explicitly published question revisions.

School grade is not a personal eligibility rule. Difficulty is authored question
metadata, never inferred from the curriculum grade or a learner's answers.
"""
from contextlib import contextmanager
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select, text

from app.models.assessments import Question, QuestionRevision, QuestionAnswerKey
from app.models.curriculum import CurriculumTopic, Lesson
from app.modules.classrooms.router import Config, Credential, Repo
from app.modules.curriculum.repository import path_statement, visible
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.identity.errors import IdentityError
from app.modules.identity.session_service import authenticated_session
from app.modules.assignments.schemas import Item
from app.modules.questions.schemas import PUBLIC_MODELS

Difficulty = Literal["easy", "medium", "hard"]
router = APIRouter(prefix="/me/practice", tags=["personal practice"],
                   dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)])


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PracticeLesson(Model):
    id: UUID
    title: str
    topic: str
    difficulties: list[Difficulty]


class LessonPage(Model):
    items: list[PracticeLesson]
    has_more: bool
    offset: int


class QuestionPage(Model):
    items: list[Item]
    has_more: bool
    offset: int


class CardBack(Model):
    revision_id: UUID
    back: str


def unavailable():
    return IdentityError(404, "practice_unavailable", "This practice content is unavailable. Choose another lesson.")


@contextmanager
def personal_context(repo, credential, settings):
    with authenticated_session(repo, credential, settings) as (_, user):
        if user.role != "personal_student":
            raise IdentityError(403, "personal_only", "This practice space is for personal learners.")
        repo.session.execute(text("SELECT pg_advisory_xact_lock_shared(78090001)"))
        profile = repo.mobile_profile(user)
        if profile.language not in {"english", "tagalog"}:
            raise IdentityError(409, "language_required", "Choose your learning language before practising.")
        yield repo.session, profile.language


def latest_questions(language):
    # A newer unlocked draft must never replace the last published revision.
    locked = (select(QuestionRevision.question_id, func.max(QuestionRevision.version).label("version"))
              .where(QuestionRevision.locked_at.is_not(None)).group_by(QuestionRevision.question_id).subquery())
    return (select(QuestionRevision).join(Question, Question.id == QuestionRevision.question_id)
            .join(locked, (locked.c.question_id == QuestionRevision.question_id) &
                  (locked.c.version == QuestionRevision.version))
            .where(Question.status == "published", Question.archived_at.is_(None),
                   QuestionRevision.language == language))


def lesson_path(lesson_id=None):
    query = path_statement(5).with_only_columns(Lesson.id, Lesson.name, CurriculumTopic.name).where(*visible(5))
    return query.where(Lesson.id == lesson_id) if lesson_id else query


def project_question(row):
    model = PUBLIC_MODELS[row.method]
    definition = model(**{name: getattr(row, name) for name in model.model_fields})
    return Item(id=row.id, question_id=row.question_id, version=row.version, definition=definition, eligible=True)


@router.get("/lessons", response_model=LessonPage)
def lessons(credential: Credential, repo: Repo, settings: Config,
            q: str = Query(default="", max_length=200), difficulty: Difficulty | None = None,
            offset: int = Query(default=0, ge=0, le=100000)):
    with personal_context(repo, credential, settings) as (db, language):
        questions = latest_questions(language)
        if difficulty:
            questions = questions.where(QuestionRevision.difficulty == difficulty)
        eligible = questions.with_only_columns(QuestionRevision.lesson_id, QuestionRevision.difficulty).subquery()
        query = (lesson_path().join(eligible, eligible.c.lesson_id == Lesson.id)
                 .add_columns(func.array_agg(func.distinct(eligible.c.difficulty)))
                 .group_by(Lesson.id, Lesson.name, CurriculumTopic.name))
        if q.strip():
            term = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            query = query.where(Lesson.name.ilike(f"%{term}%", escape="\\") |
                                CurriculumTopic.name.ilike(f"%{term}%", escape="\\"))
        rows = db.execute(query.order_by(CurriculumTopic.name, Lesson.name, Lesson.id).offset(offset).limit(21)).all()
        return LessonPage(items=[PracticeLesson(id=row[0], title=row[1], topic=row[2],
                           difficulties=[level for level in ("easy", "medium", "hard") if level in row[3]])
                          for row in rows[:20]], has_more=len(rows) > 20, offset=offset)


@router.get("/lessons/{lesson_id}/questions", response_model=QuestionPage)
def questions(lesson_id: UUID, credential: Credential, repo: Repo, settings: Config,
              difficulty: Difficulty | None = None, offset: int = Query(default=0, ge=0, le=100000)):
    with personal_context(repo, credential, settings) as (db, language):
        if db.execute(lesson_path(lesson_id)).first() is None:
            raise unavailable()
        query = latest_questions(language).where(QuestionRevision.lesson_id == lesson_id)
        if difficulty:
            query = query.where(QuestionRevision.difficulty == difficulty)
        rows = db.scalars(query.order_by(QuestionRevision.question_id).offset(offset).limit(21)).all()
        return QuestionPage(items=[project_question(row) for row in rows[:20]], has_more=len(rows) > 20, offset=offset)


@router.post("/flashcards/{revision_id}/reveal", response_model=CardBack)
def reveal(revision_id: UUID, credential: Credential, repo: Repo, settings: Config):
    # Invoked only by an explicit Reveal action. Other method keys have no personal endpoint.
    with personal_context(repo, credential, settings) as (db, language):
        row = db.scalar(select(QuestionRevision).join(Question, Question.id == QuestionRevision.question_id)
                        .where(QuestionRevision.id == revision_id, QuestionRevision.locked_at.is_not(None),
                               QuestionRevision.method == "flashcards", QuestionRevision.language == language,
                               Question.status == "published", Question.archived_at.is_(None)))
        if row is None or db.execute(lesson_path(row.lesson_id)).first() is None:
            raise unavailable()
        key = db.scalar(select(QuestionAnswerKey).where(QuestionAnswerKey.question_revision_id == row.id))
        if key is None or not isinstance(key.configuration.get("back"), str):
            raise unavailable()
        return CardBack(revision_id=row.id, back=key.configuration["back"])
