"""Private personal activity receipts, independent of grading, scheduler and research."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Entity, choice, language, reference


class PersonalActivityEvent(Entity, Base):
    __tablename__ = "personal_activity_events"
    user_id: Mapped[UUID] = reference("users.id")
    event_key: Mapped[UUID]
    kind: Mapped[str] = mapped_column(
        choice(
            "personal_activity_kind", "learn_question", "learn_lesson", "voice_phrase", "tutor_reply", "tutor_session"
        )
    )
    source_id: Mapped[str] = mapped_column(String(120))
    content_version: Mapped[int | None]
    title: Mapped[str] = mapped_column(String(200))
    prompt: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str] = mapped_column(language())
    fingerprint: Mapped[str] = mapped_column(String(64))
    recorded_at: Mapped[datetime]
    __table_args__ = (
        UniqueConstraint("user_id", "event_key"),
        CheckConstraint("content_version IS NULL OR content_version > 0", name="positive_version"),
        CheckConstraint(
            "char_length(title) BETWEEN 1 AND 200 AND char_length(source_id) BETWEEN 1 AND 120 AND (prompt IS NULL OR char_length(prompt) <= 8000)",
            name="bounded_display",
        ),
        CheckConstraint("kind NOT IN ('tutor_reply','tutor_session') OR prompt IS NULL", name="no_dialogue_retention"),
        Index("ix_personal_activity_owner_time", "user_id", "recorded_at", "id"),
    )
