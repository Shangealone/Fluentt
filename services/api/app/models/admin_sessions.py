"""Separate browser sessions; mobile device credentials never enter these tables."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Entity, reference


class AdminBrowserSession(Entity, Base):
    __tablename__ = "admin_browser_sessions"
    user_id: Mapped[UUID] = reference("users.id")
    credential_digest: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime]
    absolute_expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]
    __table_args__ = (
        CheckConstraint("credential_digest ~ '^[0-9a-f]{64}$'", name="digest_format"),
        CheckConstraint("expires_at > created_at AND absolute_expires_at >= expires_at", name="expiry_order"),
        Index("ix_admin_browser_sessions_active", "user_id", "expires_at", postgresql_where=text("revoked_at IS NULL")),
    )


class AdminOIDCAttempt(Entity, Base):
    __tablename__ = "admin_oidc_attempts"
    state_digest: Mapped[str] = mapped_column(String(64), unique=True)
    binding_digest: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime]
    consumed_at: Mapped[datetime | None]
    __table_args__ = (
        CheckConstraint("state_digest ~ '^[0-9a-f]{64}$' AND binding_digest ~ '^[0-9a-f]{64}$'", name="digest_format"),
        CheckConstraint("expires_at > created_at", name="expiry_order"),
    )
