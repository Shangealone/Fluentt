from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, Integer, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Entity, choice, json_object, language, publication, reference


class PronunciationActivity(Entity, Base):
    __tablename__ = "pronunciation_activities"
    lesson_id: Mapped[UUID | None] = reference("lessons.id", nullable=True)
    target_text: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(language())
    instructions: Mapped[str | None] = mapped_column(Text)
    reference_audio_metadata: Mapped[dict] = json_object()
    status: Mapped[str] = mapped_column(publication(), default="draft", server_default="draft")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    locked_at: Mapped[datetime | None]


class PronunciationAttempt(Entity, Base):
    __tablename__ = "pronunciation_attempts"
    context_id: Mapped[UUID] = reference("learning_contexts.id")
    activity_id: Mapped[UUID] = reference("pronunciation_activities.id")
    attempted_at: Mapped[datetime]
    transcription: Mapped[str | None] = mapped_column(Text)
    feedback: Mapped[str | None] = mapped_column(Text)
    score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    scoring_status: Mapped[str] = mapped_column(
        choice("scoring_status", "pending", "processing", "scored", "unsupported", "failed", "unscored"),
        default="pending",
        server_default="pending",
    )
    asr_configuration_id: Mapped[UUID | None] = reference("model_configurations.id", nullable=True)
    evaluator_configuration_id: Mapped[UUID | None] = reference("model_configurations.id", nullable=True)
    result: Mapped[dict] = json_object()
    error_code: Mapped[str | None] = mapped_column(String(100))
    simulated: Mapped[bool] = mapped_column(default=False, server_default=text("false"))
    __table_args__ = (
        CheckConstraint(
            "(scoring_status = 'scored' AND score IS NOT NULL AND evaluator_configuration_id IS NOT NULL) OR (scoring_status != 'scored' AND score IS NULL)",
            name="supported_score_only",
        ),
        CheckConstraint("score IS NULL OR (score >= 0 AND score <= 100)", name="score_range"),
    )


class ConversationTopic(Entity, Base):
    __tablename__ = "conversation_topics"
    lesson_id: Mapped[UUID | None] = reference("lessons.id", nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    language: Mapped[str] = mapped_column(language())
    learning_context: Mapped[dict] = json_object()
    status: Mapped[str] = mapped_column(publication(), default="draft", server_default="draft")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    locked_at: Mapped[datetime | None]


class ConversationSession(Entity, Base):
    __tablename__ = "conversation_sessions"
    context_id: Mapped[UUID] = reference("learning_contexts.id")
    topic_id: Mapped[UUID] = reference("conversation_topics.id")
    language: Mapped[str] = mapped_column(language())
    started_at: Mapped[datetime]
    ended_at: Mapped[datetime | None]
    model_configuration_id: Mapped[UUID] = reference("model_configurations.id")
    status: Mapped[str] = mapped_column(
        choice("conversation_status", "active", "ended", "failed"), default="active", server_default="active"
    )
    retain_messages: Mapped[bool] = mapped_column(default=False, server_default=text("false"))
    retention_policy_version: Mapped[str | None] = mapped_column(String(100))
    delete_messages_after: Mapped[datetime | None]
    simulated: Mapped[bool] = mapped_column(default=False, server_default=text("false"))
    __table_args__ = (
        CheckConstraint(
            "NOT retain_messages OR (retention_policy_version IS NOT NULL AND delete_messages_after IS NOT NULL)",
            name="approved_retention",
        ),
        CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="session_order"),
    )


class ConversationMessage(Entity, Base):
    __tablename__ = "conversation_messages"
    session_id: Mapped[UUID] = reference("conversation_sessions.id", ondelete="CASCADE")
    sequence: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(choice("message_role", "user", "assistant"))
    content: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime]
    __table_args__ = (
        UniqueConstraint("session_id", "sequence"),
        CheckConstraint("sequence > 0", name="positive_sequence"),
    )
