import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    DDL,
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    UniqueConstraint,
    Uuid,
    event,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.research_logging.integrity_ddl import RESEARCH_INTEGRITY_DDL


class ResearchEvent(Base):
    """Append-oriented research event log.

    Explicitly separated from application/operational logs.
    Payloads must NEVER contain sensitive material such as passwords,
    authentication tokens, JWT secrets, or email addresses.
    """

    __tablename__ = "research_events"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT", name="fk_research_user_retained"),
        nullable=False,
        index=True,
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    schema_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    review_attempt_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True, index=True
    )
    __table_args__ = (
        ForeignKeyConstraint(
            ["review_attempt_id", "user_id"],
            ["review_attempts.id", "review_attempts.user_id"],
            ondelete="RESTRICT",
            name="fk_research_attempt_owner",
        ),
        UniqueConstraint(
            "review_attempt_id",
            "event_type",
            "schema_version",
            name="uq_current_review_event",
        ),
        CheckConstraint(
            "(schema_version IS NULL AND review_attempt_id IS NULL) OR "
            "(schema_version IS NOT NULL AND schema_version = 'review-events-1' AND review_attempt_id IS NOT NULL "
            "AND event_type IN ('REVIEW_ANSWERED', 'REVIEW_SCHEDULED') "
            'AND CAST(payload AS jsonb) = \'{"scope":"item_attempt"}\'::jsonb)',
            name="ck_current_review_event",
        ),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
        index=True,
    )


for statement in RESEARCH_INTEGRITY_DDL:
    event.listen(
        Base.metadata, "after_create", DDL(statement).execute_if(dialect="postgresql")
    )
