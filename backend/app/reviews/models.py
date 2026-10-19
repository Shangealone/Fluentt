import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ReviewSession(Base):
    __tablename__ = "review_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "users.id", ondelete="RESTRICT", name="fk_review_session_user_retained"
        ),
        nullable=False,
        index=True,
    )
    client_session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id", "client_session_id", name="uq_user_client_session_id"
        ),
    )


class ReviewAttempt(Base):
    __tablename__ = "review_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "users.id", ondelete="RESTRICT", name="fk_review_attempt_user_retained"
        ),
        nullable=False,
        index=True,
    )
    vocabulary_item_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "vocabulary_items.id",
            ondelete="RESTRICT",
            name="fk_attempt_vocabulary_retained",
        ),
        nullable=False,
        index=True,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "review_sessions.id",
            ondelete="RESTRICT",
            name="fk_review_attempt_session_retained",
        ),
        nullable=False,
        index=True,
    )
    client_event_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        nullable=False,
        index=True,
    )
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    response_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    # SQL NULL identifies legacy absence; never reconstruct historical evidence.
    timing_evidence: Mapped[dict[str, Any] | None] = mapped_column(
        JSON(none_as_null=True), nullable=True
    )
    scheduler_type: Mapped[str] = mapped_column(String(64), nullable=False)
    algorithm_version: Mapped[str] = mapped_column(String(64), nullable=False)
    research_assignment_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), nullable=True)
    client_interaction_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    server_acceptance_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    device_platform: Mapped[str] = mapped_column(String(32), nullable=False)
    application_version: Mapped[str] = mapped_column(String(32), nullable=False)
    submitted_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_revision_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True, index=True
    )
    content_release_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "content_releases.id",
            ondelete="RESTRICT",
            name="fk_attempt_content_release",
        ),
        nullable=True,
        index=True,
    )
    content_revision = relationship("VocabularyRevision", viewonly=True)
    content_release = relationship("ContentRelease")
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_review_attempt_owner"),
        ForeignKeyConstraint(
            ["research_assignment_id", "user_id", "scheduler_type", "algorithm_version"],
            ["participant_set_conditions.id", "participant_set_conditions.user_id",
             "participant_set_conditions.scheduler_type", "participant_set_conditions.algorithm_version"],
            name="fk_d11_attempt_condition", ondelete="RESTRICT"),
        CheckConstraint("(research_assignment_id IS NOT NULL) = (scheduler_type IN ('conventional_srs','enhanced_srs'))",
                        name="ck_d11_attempt_assignment"),
        ForeignKeyConstraint(
            ["content_revision_id", "vocabulary_item_id"],
            ["vocabulary_revisions.id", "vocabulary_revisions.vocabulary_item_id"],
            ondelete="RESTRICT",
            name="fk_attempt_content_revision",
        ),
        CheckConstraint(
            "(content_revision_id IS NULL) = (content_release_id IS NULL)",
            name="ck_attempt_provenance_pair",
        ),
    )

    session: Mapped[ReviewSession] = relationship("ReviewSession")


class ReviewSchedule(Base):
    __tablename__ = "review_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "users.id", ondelete="RESTRICT", name="fk_review_schedule_user_retained"
        ),
        nullable=False,
        index=True,
    )
    vocabulary_item_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "vocabulary_items.id",
            ondelete="RESTRICT",
            name="fk_review_schedule_item_retained",
        ),
        nullable=False,
        index=True,
    )
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "review_attempts.id",
            ondelete="RESTRICT",
            name="fk_review_schedule_attempt_retained",
        ),
        nullable=False,
        index=True,
    )
    scheduler_type: Mapped[str] = mapped_column(String(64), nullable=False)
    algorithm_version: Mapped[str] = mapped_column(String(64), nullable=False)
    interval_seconds: Mapped[int] = mapped_column(BigInteger, nullable=False)
    due_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    scheduler_state: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("attempt_id", name="uq_review_schedule_attempt"),
        UniqueConstraint(
            "id", "user_id", "vocabulary_item_id", name="uq_schedule_owner_item"
        ),
    )


class CurrentReviewSchedule(Base):
    """Mutable pointer; historical ReviewSchedule rows remain append-only on acceptance."""

    __tablename__ = "current_review_schedules"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    vocabulary_item_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True
    )
    schedule_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    __table_args__ = (
        ForeignKeyConstraint(
            ["schedule_id", "user_id", "vocabulary_item_id"],
            [
                "review_schedules.id",
                "review_schedules.user_id",
                "review_schedules.vocabulary_item_id",
            ],
            ondelete="CASCADE",
            name="fk_current_schedule_owner_item",
        ),
    )
