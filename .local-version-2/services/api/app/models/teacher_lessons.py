"""Teacher-owned versions use lesson leaves without impersonating curriculum editions."""
from datetime import datetime
from uuid import UUID
from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.schema import conv
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, Entity, language


def teacher_reference(target: str, *, index: bool = False):
    """Match the non-deferrable NO ACTION foreign keys in frozen migration 0019."""
    return mapped_column(ForeignKey(target), nullable=False, index=index)


class TeacherLesson(Entity, Base):
    __tablename__ = "teacher_lessons"
    instructor_id: Mapped[UUID] = teacher_reference("users.id", index=True)
    archived_at: Mapped[datetime | None]
    revision: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    __table_args__ = (CheckConstraint("revision > 0", name=conv("teacher_lessons_revision_check")),)


class TeacherLessonVersion(Entity, Base):
    __tablename__ = "teacher_lesson_versions"
    teacher_lesson_id: Mapped[UUID] = teacher_reference("teacher_lessons.id", index=True)
    lesson_id: Mapped[UUID] = teacher_reference("lessons.id")
    version: Mapped[int] = mapped_column(Integer)
    grade_level_id: Mapped[UUID | None] = mapped_column(ForeignKey("grade_levels.id"), nullable=True)
    proficiency_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    subject_id: Mapped[UUID] = teacher_reference("subjects.id")
    language: Mapped[str] = mapped_column(language())
    sections: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    published_at: Mapped[datetime | None]
    __table_args__ = (
        CheckConstraint("proficiency_level IN ('beginner', 'intermediate', 'advanced')", name="proficiency_level"),
        UniqueConstraint("lesson_id", name="teacher_lesson_versions_lesson_id_key"),
        UniqueConstraint("teacher_lesson_id", "version", name="teacher_lesson_versions_teacher_lesson_id_version_key"),
        CheckConstraint("version > 0", name=conv("teacher_lesson_versions_version_check")),
        CheckConstraint("jsonb_typeof(sections) = 'array'", name=conv("teacher_lesson_versions_sections_check")),
    )


class TeacherLessonQuestion(Entity, Base):
    __tablename__ = "teacher_lesson_questions"
    version_id: Mapped[UUID] = teacher_reference("teacher_lesson_versions.id")
    question_revision_id: Mapped[UUID] = teacher_reference("question_revisions.id")
    position: Mapped[int] = mapped_column(Integer)
    __table_args__ = (
        UniqueConstraint("question_revision_id", name="teacher_lesson_questions_question_revision_id_key"),
        UniqueConstraint("version_id", "position", name="teacher_lesson_questions_version_id_position_key"),
        CheckConstraint("position > 0", name=conv("teacher_lesson_questions_position_check")),
    )


class TeacherLessonShare(Entity, Base):
    """Append-only events. Highest ordinal per lesson/class is its current share."""
    __tablename__ = "teacher_lesson_shares"
    teacher_lesson_id: Mapped[UUID] = teacher_reference("teacher_lessons.id")
    class_id: Mapped[UUID] = teacher_reference("classes.id", index=True)
    version_id: Mapped[UUID] = teacher_reference("teacher_lesson_versions.id")
    ordinal: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean)
    request_id: Mapped[UUID]
    __table_args__ = (
        CheckConstraint("ordinal > 0", name=conv("teacher_lesson_shares_ordinal_check")),
        UniqueConstraint("teacher_lesson_id", "class_id", "ordinal",
                         name="teacher_lesson_shares_teacher_lesson_id_class_id_ordinal_key"),
        UniqueConstraint("teacher_lesson_id", "class_id", "request_id",
                         name="teacher_lesson_shares_teacher_lesson_id_class_id_request_id_key"),
    )


class TeacherLessonMutation(Entity, Base):
    __tablename__ = "teacher_lesson_mutations"
    instructor_id: Mapped[UUID] = teacher_reference("users.id")
    request_id: Mapped[UUID]
    fingerprint: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSONB)
    __table_args__ = (UniqueConstraint("instructor_id", "request_id", name="teacher_lesson_mutations_instructor_id_request_id_key"),)
