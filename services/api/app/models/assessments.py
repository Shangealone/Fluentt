from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKeyConstraint, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Entity, choice, json_object, language, publication, reference

ANSWER_METHODS = (
    "multiple_choice",
    "true_false",
    "identification",
    "fill_in_the_blank",
    "multiple_select",
    "flashcards",
    "error_identification",
    "word_arrangement",
    "sentence_arrangement",
    "matching_type",
)


class Question(Entity, Base):
    __tablename__ = "questions"
    author_id: Mapped[UUID | None] = reference("users.id", nullable=True)
    status: Mapped[str] = mapped_column(publication(), default="draft", server_default="draft")
    archived_at: Mapped[datetime | None]


class QuestionRevision(Entity, Base):
    __tablename__ = "question_revisions"
    question_id: Mapped[UUID] = reference("questions.id")
    lesson_id: Mapped[UUID] = reference("lessons.id")
    version: Mapped[int] = mapped_column(Integer)
    method: Mapped[str] = mapped_column(choice("answer_method", *ANSWER_METHODS))
    language: Mapped[str] = mapped_column(language())
    prompt: Mapped[str] = mapped_column(Text)
    instructions: Mapped[str | None] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(
        choice("difficulty", "easy", "medium", "hard"), default="medium", server_default="medium"
    )
    points: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=1, server_default="1")
    schema_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    content: Mapped[dict] = json_object()
    locked_at: Mapped[datetime | None]
    __table_args__ = (
        UniqueConstraint("question_id", "version"),
        CheckConstraint("version > 0 AND schema_version = 1", name="version_valid"),
        CheckConstraint("points >= 0", name="nonnegative_points"),
        CheckConstraint("jsonb_typeof(content) = 'object'", name="content_object"),
    )


class QuestionAnswerKey(Entity, Base):
    __tablename__ = "question_answer_keys"
    question_revision_id: Mapped[UUID] = reference("question_revisions.id", unique=True)
    configuration: Mapped[dict] = mapped_column(JSONB)
    grading_version: Mapped[str] = mapped_column(String(80), default="ungraded-v1", server_default="ungraded-v1")
    explanation: Mapped[str | None] = mapped_column(Text)
    __table_args__ = (CheckConstraint("jsonb_typeof(configuration) = 'object'", name="configuration_object"),)


class QuestionCompetency(Entity, Base):
    __tablename__ = "question_competencies"
    question_revision_id: Mapped[UUID] = reference("question_revisions.id")
    competency_id: Mapped[UUID] = reference("learning_competencies.id")
    __table_args__ = (UniqueConstraint("question_revision_id", "competency_id"),)


class Assignment(Entity, Base):
    __tablename__ = "assignments"
    class_id: Mapped[UUID] = reference("classes.id")
    instructor_id: Mapped[UUID] = reference("users.id")
    status: Mapped[str] = mapped_column(
        choice("assignment_status", "draft", "published", "closed", "archived"), default="draft", server_default="draft"
    )
    archived_at: Mapped[datetime | None]


class AssignmentVersion(Entity, Base):
    __tablename__ = "assignment_versions"
    assignment_id: Mapped[UUID] = reference("assignments.id")
    lesson_id: Mapped[UUID] = reference("lessons.id")
    version: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    instructions: Mapped[str | None] = mapped_column(Text)
    starts_at: Mapped[datetime | None]
    due_at: Mapped[datetime | None]
    time_limit_seconds: Mapped[int | None] = mapped_column(Integer)
    max_attempts: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    grading_policy: Mapped[dict] = json_object()
    curriculum_snapshot: Mapped[dict] = json_object()
    locked_at: Mapped[datetime | None]
    __table_args__ = (
        UniqueConstraint("assignment_id", "version"),
        CheckConstraint("version > 0 AND max_attempts > 0", name="positive_limits"),
        CheckConstraint("time_limit_seconds IS NULL OR time_limit_seconds > 0", name="positive_timer"),
        CheckConstraint("due_at IS NULL OR starts_at IS NULL OR due_at > starts_at", name="window_order"),
    )


class AssignmentQuestion(Entity, Base):
    __tablename__ = "assignment_questions"
    assignment_version_id: Mapped[UUID] = reference("assignment_versions.id")
    question_revision_id: Mapped[UUID] = reference("question_revisions.id")
    position: Mapped[int] = mapped_column(Integer)
    points: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    __table_args__ = (
        UniqueConstraint("id", "assignment_version_id"),
        UniqueConstraint("assignment_version_id", "position"),
        UniqueConstraint("assignment_version_id", "question_revision_id"),
        CheckConstraint("position > 0 AND points >= 0", name="valid_item"),
    )


class AssignmentAttempt(Entity, Base):
    __tablename__ = "assignment_attempts"
    assignment_version_id: Mapped[UUID] = reference("assignment_versions.id")
    student_id: Mapped[UUID] = reference("users.id")
    attempt_number: Mapped[int] = mapped_column(Integer)
    started_at: Mapped[datetime]
    expires_at: Mapped[datetime | None]
    submitted_at: Mapped[datetime | None]
    status: Mapped[str] = mapped_column(
        choice("attempt_status", "in_progress", "submitted", "graded", "expired"),
        default="in_progress",
        server_default="in_progress",
    )
    score: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    maximum_score: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    submission_key: Mapped[UUID | None] = mapped_column(unique=True)
    __table_args__ = (
        UniqueConstraint("id", "assignment_version_id"),
        UniqueConstraint("assignment_version_id", "student_id", "attempt_number"),
        CheckConstraint("attempt_number > 0", name="positive_attempt"),
        CheckConstraint(
            "(score IS NULL AND maximum_score IS NULL) OR (score IS NOT NULL AND maximum_score IS NOT NULL AND score >= 0 AND maximum_score >= score)",
            name="score_range",
        ),
        CheckConstraint("submitted_at IS NULL OR submitted_at >= started_at", name="submission_order"),
        CheckConstraint(
            "status NOT IN ('submitted', 'graded') OR submitted_at IS NOT NULL", name="submitted_timestamp"
        ),
    )


class StudentResponse(Entity, Base):
    __tablename__ = "student_responses"
    attempt_id: Mapped[UUID] = mapped_column(index=True)
    assignment_question_id: Mapped[UUID] = mapped_column(index=True)
    assignment_version_id: Mapped[UUID] = mapped_column(index=True)
    answer: Mapped[dict] = mapped_column(JSONB)
    correct: Mapped[bool | None]
    awarded_points: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    response_duration_ms: Mapped[int | None] = mapped_column(Integer)
    submitted_at: Mapped[datetime | None]
    grading_status: Mapped[str] = mapped_column(
        choice("grading_status", "pending", "graded", "unscored", "failed"), default="pending", server_default="pending"
    )
    grading_version: Mapped[str | None] = mapped_column(String(80))
    feedback: Mapped[str | None] = mapped_column(Text)
    __table_args__ = (
        ForeignKeyConstraint(
            ["attempt_id", "assignment_version_id"],
            ["assignment_attempts.id", "assignment_attempts.assignment_version_id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["assignment_question_id", "assignment_version_id"],
            ["assignment_questions.id", "assignment_questions.assignment_version_id"],
            ondelete="RESTRICT",
        ),
        UniqueConstraint("attempt_id", "assignment_question_id"),
        CheckConstraint("response_duration_ms IS NULL OR response_duration_ms >= 0", name="nonnegative_latency"),
        CheckConstraint("awarded_points IS NULL OR awarded_points >= 0", name="nonnegative_award"),
        CheckConstraint("jsonb_typeof(answer) = 'object'", name="answer_object"),
    )
