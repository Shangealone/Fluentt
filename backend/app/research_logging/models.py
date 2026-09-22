import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


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
    event_type: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
        index=True,
    )
