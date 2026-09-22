import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class AcceptedClientEvent(Base):
    """Idempotency record for accepted client review events.

    Uniqueness is enforced at the database level scoped to the user:
    UNIQUE (user_id, client_event_id).
    """

    __tablename__ = "accepted_client_events"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_event_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        nullable=False,
        index=True,
    )
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("review_attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    response_payload: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False
    )

    attempt = relationship("ReviewAttempt")

    __table_args__ = (
        UniqueConstraint(
            "user_id", "client_event_id", name="uq_user_client_event_id"
        ),
    )
