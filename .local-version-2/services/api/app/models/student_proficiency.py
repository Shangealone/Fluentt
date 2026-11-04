from datetime import date, datetime
from uuid import UUID
from sqlalchemy import CheckConstraint, Date, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, Entity, reference, language


class StudentProficiencyEvent(Entity, Base):
    __tablename__ = "student_proficiency_events"
    student_id: Mapped[UUID] = reference("users.id")
    language: Mapped[str] = mapped_column(language())
    ordinal: Mapped[int]
    level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    assessed_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    recorded_at: Mapped[datetime]
    recorded_by: Mapped[UUID] = reference("users.id")
    recorder_username: Mapped[str] = mapped_column(String(200))
    source_class_id: Mapped[UUID] = reference("classes.id")
    request_id: Mapped[UUID]
    fingerprint: Mapped[str] = mapped_column(String(64))
    __table_args__ = (
        UniqueConstraint("student_id", "language", "ordinal"),
        UniqueConstraint("recorded_by", "request_id"),
        CheckConstraint("ordinal > 0", name="ordinal"),
        CheckConstraint("level IN ('beginner','intermediate','advanced')", name="level"),
        CheckConstraint("(level IS NULL AND assessed_on IS NULL) OR (level IS NOT NULL AND assessed_on IS NOT NULL)", name="assessment_date"),
    )
