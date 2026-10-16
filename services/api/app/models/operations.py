from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Entity, choice, json_object, reference


class Message(Entity, Base):
    __tablename__ = "messages"
    sender_id: Mapped[UUID] = reference("users.id")
    recipient_id: Mapped[UUID | None] = reference("users.id", nullable=True)
    class_id: Mapped[UUID | None] = reference("classes.id", nullable=True)
    message_type: Mapped[str] = mapped_column(choice("message_type", "direct", "announcement", "feedback"))
    content: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime]
    __table_args__ = (CheckConstraint("(recipient_id IS NOT NULL) != (class_id IS NOT NULL)", name="one_destination"),)


class MessageRead(Entity, Base):
    __tablename__ = "message_reads"
    message_id: Mapped[UUID] = reference("messages.id", ondelete="CASCADE")
    user_id: Mapped[UUID] = reference("users.id")
    read_at: Mapped[datetime]
    __table_args__ = (UniqueConstraint("message_id", "user_id"),)


class Notification(Entity, Base):
    __tablename__ = "notifications"
    user_id: Mapped[UUID] = reference("users.id")
    event_type: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    related_resource_type: Mapped[str | None] = mapped_column(String(80))
    related_resource_id: Mapped[UUID | None]
    read_at: Mapped[datetime | None]
    __table_args__ = (Index("ix_notifications_inbox", "user_id", "read_at", "created_at"),)


class AuditLog(Entity, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[UUID | None] = reference("users.id", nullable=True)
    action: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[UUID | None]
    occurred_at: Mapped[datetime]
    request_id: Mapped[UUID | None]
    safe_metadata: Mapped[dict] = json_object()
    __table_args__ = (Index("ix_audit_logs_entity_time", "entity_type", "entity_id", "occurred_at"),)
