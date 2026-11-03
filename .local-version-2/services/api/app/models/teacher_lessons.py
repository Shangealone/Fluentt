"""Teacher-owned versions use lesson leaves without impersonating curriculum editions."""
from datetime import datetime
from uuid import UUID
from sqlalchemy import Boolean, CheckConstraint, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, Entity, reference, language


class TeacherLesson(Entity, Base):
    __tablename__ = "teacher_lessons"
    instructor_id: Mapped[UUID] = reference("users.id")
    archived_at: Mapped[datetime | None]
    revision: Mapped[int] = mapped_column(Integer, default=1, server_default="1")


class TeacherLessonVersion(Entity, Base):
    __tablename__ = "teacher_lesson_versions"
    teacher_lesson_id: Mapped[UUID] = reference("teacher_lessons.id")
    lesson_id: Mapped[UUID] = reference("lessons.id", unique=True)
    version: Mapped[int] = mapped_column(Integer)
    grade_level_id: Mapped[UUID] = reference("grade_levels.id")
    subject_id: Mapped[UUID] = reference("subjects.id")
    language: Mapped[str] = mapped_column(language())
    sections: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    published_at: Mapped[datetime | None]
    __table_args__ = (UniqueConstraint("teacher_lesson_id", "version"), CheckConstraint("version > 0", name="positive_version"))


class TeacherLessonQuestion(Entity, Base):
    __tablename__ = "teacher_lesson_questions"
    version_id: Mapped[UUID] = reference("teacher_lesson_versions.id")
    question_revision_id: Mapped[UUID] = reference("question_revisions.id", unique=True)
    position: Mapped[int] = mapped_column(Integer)
    __table_args__ = (UniqueConstraint("version_id", "position"), CheckConstraint("position > 0", name="positive_position"))


class TeacherLessonShare(Entity, Base):
    """Append-only events. Highest ordinal per lesson/class is its current share."""
    __tablename__ = "teacher_lesson_shares"
    teacher_lesson_id: Mapped[UUID] = reference("teacher_lessons.id")
    class_id: Mapped[UUID] = reference("classes.id")
    version_id: Mapped[UUID] = reference("teacher_lesson_versions.id")
    ordinal: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean)
    request_id: Mapped[UUID]
    __table_args__ = (
        UniqueConstraint("teacher_lesson_id", "class_id", "ordinal",
                         name="teacher_lesson_shares_teacher_lesson_id_class_id_ordinal_key"),
        UniqueConstraint("teacher_lesson_id", "class_id", "request_id",
                         name="teacher_lesson_shares_teacher_lesson_id_class_id_request_id_key"),
    )


class TeacherLessonMutation(Entity, Base):
    __tablename__ = "teacher_lesson_mutations"
    instructor_id: Mapped[UUID] = reference("users.id")
    request_id: Mapped[UUID]
    fingerprint: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSONB)
    __table_args__ = (UniqueConstraint("instructor_id", "request_id"),)
