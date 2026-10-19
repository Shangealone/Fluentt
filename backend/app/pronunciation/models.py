import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base

TERMINAL_STATUSES = ("scored", "unscorable", "failed")


class PronunciationAttempt(Base):
    __tablename__ = "pronunciation_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "users.id", ondelete="RESTRICT", name="fk_pronunciation_attempt_user"
        ),
        nullable=False,
    )
    client_pronunciation_attempt_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), nullable=False
    )
    content_release_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "content_releases.id",
            ondelete="RESTRICT",
            name="fk_pronunciation_attempt_release",
        ),
        nullable=False,
    )
    vocabulary_item_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "vocabulary_items.id",
            ondelete="RESTRICT",
            name="fk_pronunciation_attempt_item",
        ),
        nullable=False,
    )
    content_revision_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "vocabulary_revisions.id",
            ondelete="RESTRICT",
            name="fk_pronunciation_attempt_revision",
        ),
        nullable=False,
    )
    target_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    original_interaction_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    processing_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="processing"
    )
    processing_token: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )
    processing_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    provider_dispatch_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    capture_profile_version: Mapped[str] = mapped_column(String(64), nullable=False)
    device_platform: Mapped[str] = mapped_column(String(32), nullable=False)
    application_version: Mapped[str] = mapped_column(String(32), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "client_pronunciation_attempt_id",
            name="uq_pronunciation_owner_client_attempt",
        ),
        CheckConstraint(
            "target_kind IN ('term', 'sentence')", name="ck_pronunciation_target_kind"
        ),
        CheckConstraint(
            "status IN ('processing', 'scored', 'unscorable', 'failed')",
            name="ck_pronunciation_attempt_status",
        ),
        CheckConstraint(
            "(status = 'processing') = (completed_at IS NULL)",
            name="ck_pronunciation_attempt_completed",
        ),
        Index(
            "uq_pronunciation_one_processing_per_owner",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'processing'"),
        ),
    )


class PronunciationResult(Base):
    __tablename__ = "pronunciation_results"

    pronunciation_attempt_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "pronunciation_attempts.id",
            ondelete="RESTRICT",
            name="fk_pronunciation_result_attempt",
        ),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "users.id", ondelete="RESTRICT", name="fk_pronunciation_result_user"
        ),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    locale: Mapped[str] = mapped_column(String(16), nullable=False)
    assessment_config_version: Mapped[str] = mapped_column(String(64), nullable=False)
    integration: Mapped[str] = mapped_column(String(64), nullable=False)
    api_contract: Mapped[str] = mapped_column(String(128), nullable=False)
    adapter_version: Mapped[str] = mapped_column(String(64), nullable=False)
    http_client_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    sdk_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    hosted_model_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    recognition_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    capture_profile_version: Mapped[str] = mapped_column(String(64), nullable=False)
    converter_profile_version: Mapped[str] = mapped_column(String(64), nullable=False)
    converter_version: Mapped[str | None] = mapped_column(String(128), nullable=True)
    accuracy_score: Mapped[Decimal | None] = mapped_column(Numeric(), nullable=True)
    accuracy_score_display: Mapped[str | None] = mapped_column(
        String(16), nullable=True
    )
    category: Mapped[str | None] = mapped_column(String(1), nullable=True)
    category_policy_version: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )
    pronunciation_score: Mapped[Decimal | None] = mapped_column(
        Numeric(), nullable=True
    )
    completeness_score: Mapped[Decimal | None] = mapped_column(Numeric(), nullable=True)
    fluency_score: Mapped[Decimal | None] = mapped_column(Numeric(), nullable=True)
    word_observations: Mapped[list[Any]] = mapped_column(JSON, nullable=False)
    issues: Mapped[list[Any]] = mapped_column(JSON, nullable=False)
    general_feedback_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    selected_issue_refs: Mapped[list[Any]] = mapped_column(JSON, nullable=False)
    feedback_policy_version: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )
    reason_category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reason_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reason_recovery: Mapped[str | None] = mapped_column(String(32), nullable=True)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('scored', 'unscorable', 'failed')",
            name="ck_pronunciation_result_status",
        ),
        CheckConstraint(
            "category IN ('A', 'B', 'C', 'D')", name="ck_pronunciation_result_category"
        ),
        CheckConstraint(
            "(status = 'scored') = (accuracy_score IS NOT NULL)",
            name="ck_pronunciation_result_scored_primary",
        ),
        CheckConstraint(
            "accuracy_score IS NULL OR (accuracy_score >= 0 AND accuracy_score <= 100)",
            name="ck_pronunciation_result_primary_range",
        ),
        CheckConstraint(
            "(status = 'scored') = (category IS NOT NULL)",
            name="ck_pronunciation_result_scored_category",
        ),
        CheckConstraint(
            "status != 'scored' OR general_feedback_key IS NOT NULL",
            name="ck_pronunciation_result_scored_feedback",
        ),
        CheckConstraint(
            "reason_category IS NULL OR reason_category IN "
            "('USER_CORRECTABLE', 'RETRYABLE_SERVICE', 'SERVER_CONFIGURATION')",
            name="ck_pronunciation_result_reason_category",
        ),
    )
