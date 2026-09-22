import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
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
        ForeignKey("users.id", ondelete="CASCADE"),
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
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vocabulary_item_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("vocabulary_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("review_sessions.id", ondelete="CASCADE"),
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
    scheduler_type: Mapped[str] = mapped_column(String(64), nullable=False)
    algorithm_version: Mapped[str] = mapped_column(String(64), nullable=False)
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

    session: Mapped[ReviewSession] = relationship("ReviewSession")


class ReviewSchedule(Base):
    __tablename__ = "review_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vocabulary_item_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("vocabulary_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("review_attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scheduler_type: Mapped[str] = mapped_column(String(64), nullable=False)
    algorithm_version: Mapped[str] = mapped_column(String(64), nullable=False)
    interval_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
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
