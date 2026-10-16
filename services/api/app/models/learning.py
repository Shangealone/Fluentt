from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Entity, choice, json_object, language, reference


class LearningContext(Entity, Base):
    __tablename__ = "learning_contexts"
    student_id: Mapped[UUID | None] = reference("users.id", nullable=True)
    kind: Mapped[str] = mapped_column(choice("context_kind", "personal", "classroom", "research"))
    class_id: Mapped[UUID | None] = reference("classes.id", nullable=True)
    participant_id: Mapped[UUID | None] = reference("research_participants.id", nullable=True)
    __table_args__ = (
        CheckConstraint(
            "(kind = 'personal' AND student_id IS NOT NULL AND class_id IS NULL AND participant_id IS NULL) OR (kind = 'classroom' AND student_id IS NOT NULL AND class_id IS NOT NULL AND participant_id IS NULL) OR (kind = 'research' AND student_id IS NULL AND class_id IS NULL AND participant_id IS NOT NULL)",
            name="context_scope",
        ),
        Index("uq_learning_context_personal", "student_id", unique=True, postgresql_where=text("kind = 'personal'")),
        Index(
            "uq_learning_context_class",
            "student_id",
            "class_id",
            unique=True,
            postgresql_where=text("kind = 'classroom'"),
        ),
        Index(
            "uq_learning_context_research", "participant_id", unique=True, postgresql_where=text("kind = 'research'")
        ),
    )


class LearnerProgress(Entity, Base):
    __tablename__ = "learner_progress"
    context_id: Mapped[UUID] = reference("learning_contexts.id")
    lesson_id: Mapped[UUID] = reference("lessons.id")
    status: Mapped[str] = mapped_column(
        choice("progress_status", "not_started", "in_progress", "completed"),
        default="not_started",
        server_default="not_started",
    )
    completed_at: Mapped[datetime | None]
    metrics: Mapped[dict] = json_object()
    __table_args__ = (
        UniqueConstraint("context_id", "lesson_id"),
        CheckConstraint("status != 'completed' OR completed_at IS NOT NULL", name="completed_timestamp"),
    )


class VocabularyItem(Entity, Base):
    __tablename__ = "vocabulary_items"
    lesson_id: Mapped[UUID] = reference("lessons.id")
    language: Mapped[str] = mapped_column(language())
    term: Mapped[str] = mapped_column(String(200))
    meaning: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    locked_at: Mapped[datetime | None]
    __table_args__ = (
        UniqueConstraint("lesson_id", "language", "term", "version"),
        CheckConstraint("version > 0", name="positive_version"),
    )


class VocabularyReviewState(Entity, Base):
    __tablename__ = "vocabulary_review_states"
    context_id: Mapped[UUID] = reference("learning_contexts.id")
    vocabulary_item_id: Mapped[UUID] = reference("vocabulary_items.id")
    scheduler_configuration_id: Mapped[UUID] = reference("scheduler_configurations.id")
    state: Mapped[dict] = json_object()
    due_at: Mapped[datetime]
    last_reviewed_at: Mapped[datetime | None]
    revision: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    __table_args__ = (
        UniqueConstraint("context_id", "vocabulary_item_id"),
        UniqueConstraint("id", "scheduler_configuration_id"),
        CheckConstraint("revision > 0 AND jsonb_typeof(state) = 'object'", name="valid_state"),
        Index("ix_vocabulary_review_states_due", "context_id", "due_at"),
    )


class VocabularyReviewEvent(Entity, Base):
    __tablename__ = "vocabulary_review_events"
    review_state_id: Mapped[UUID] = reference("vocabulary_review_states.id")
    scheduler_configuration_id: Mapped[UUID] = reference("scheduler_configurations.id")
    event_key: Mapped[UUID] = mapped_column(unique=True)
    reviewed_at: Mapped[datetime]
    recall_rating: Mapped[str] = mapped_column(choice("recall_rating", "again", "hard", "good", "easy"))
    answer_result: Mapped[dict] = json_object()
    response_duration_ms: Mapped[int] = mapped_column(Integer)
    previous_interval_seconds: Mapped[Decimal] = mapped_column(Numeric(16, 3))
    resulting_interval_seconds: Mapped[Decimal] = mapped_column(Numeric(16, 3))
    previous_state: Mapped[dict] = json_object()
    resulting_state: Mapped[dict] = json_object()
    state_revision: Mapped[int] = mapped_column(Integer)
    simulated: Mapped[bool] = mapped_column(default=False, server_default=text("false"))
    __table_args__ = (
        UniqueConstraint("review_state_id", "state_revision"),
        ForeignKeyConstraint(
            ["review_state_id", "scheduler_configuration_id"],
            ["vocabulary_review_states.id", "vocabulary_review_states.scheduler_configuration_id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "response_duration_ms >= 0 AND previous_interval_seconds >= 0 AND resulting_interval_seconds >= 0 AND state_revision > 0",
            name="nonnegative_metrics",
        ),
        Index("ix_vocabulary_review_events_history", "review_state_id", "reviewed_at"),
    )


class PointsTransaction(Entity, Base):
    __tablename__ = "points_transactions"
    context_id: Mapped[UUID] = reference("learning_contexts.id")
    source_event_key: Mapped[UUID] = mapped_column(unique=True)
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(200))
    reverses_id: Mapped[UUID | None] = reference("points_transactions.id", nullable=True, unique=True)
