from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Entity, choice, json_object, label, publication, reference


class CurriculumVersion(Entity, Base):
    __tablename__ = "curriculum_versions"
    code: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = label()
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(publication(), default="draft", server_default="draft")
    source_metadata: Mapped[dict] = json_object()
    verification_status: Mapped[str] = mapped_column(
        choice("verification", "unverified", "verified"), default="unverified", server_default="unverified"
    )
    published_at: Mapped[datetime | None]
    archived_at: Mapped[datetime | None]


class GradeLevel(Entity, Base):
    __tablename__ = "grade_levels"
    number: Mapped[int] = mapped_column(Integer, unique=True)
    name: Mapped[str] = label()
    __table_args__ = (CheckConstraint("number BETWEEN 1 AND 12", name="grade_range"),)


class Subject(Entity, Base):
    __tablename__ = "subjects"
    code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = label()
    description: Mapped[str | None] = mapped_column(Text)


class CurriculumGrade(Entity, Base):
    __tablename__ = "curriculum_grades"
    curriculum_version_id: Mapped[UUID] = reference("curriculum_versions.id")
    grade_level_id: Mapped[UUID] = reference("grade_levels.id")
    __table_args__ = (UniqueConstraint("curriculum_version_id", "grade_level_id"),)


class CurriculumSubject(Entity, Base):
    __tablename__ = "curriculum_subjects"
    curriculum_grade_id: Mapped[UUID] = reference("curriculum_grades.id")
    subject_id: Mapped[UUID] = reference("subjects.id")
    __table_args__ = (UniqueConstraint("curriculum_grade_id", "subject_id"),)


class Quarter(Entity, Base):
    __tablename__ = "quarters"
    curriculum_subject_id: Mapped[UUID] = reference("curriculum_subjects.id")
    number: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = label()
    __table_args__ = (
        UniqueConstraint("curriculum_subject_id", "number"),
        CheckConstraint("number BETWEEN 1 AND 4", name="quarter_range"),
    )


class CurriculumTopic(Entity, Base):
    __tablename__ = "curriculum_topics"
    quarter_id: Mapped[UUID] = reference("quarters.id")
    name: Mapped[str] = label()
    description: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(publication(), default="draft", server_default="draft")
    __table_args__ = (
        UniqueConstraint("quarter_id", "position"),
        CheckConstraint("position > 0", name="positive_position"),
    )


class Lesson(Entity, Base):
    __tablename__ = "lessons"
    topic_id: Mapped[UUID] = reference("curriculum_topics.id")
    name: Mapped[str] = label()
    description: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(publication(), default="draft", server_default="draft")
    source_metadata: Mapped[dict] = json_object()
    archived_at: Mapped[datetime | None]
    __table_args__ = (
        UniqueConstraint("topic_id", "position"),
        CheckConstraint("position > 0", name="positive_position"),
    )


class LearningCompetency(Entity, Base):
    __tablename__ = "learning_competencies"
    lesson_id: Mapped[UUID] = reference("lessons.id")
    code: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer)
    source_metadata: Mapped[dict] = json_object()
    __table_args__ = (
        UniqueConstraint("lesson_id", "position"),
        UniqueConstraint("lesson_id", "code", name="uq_learning_competencies_lesson_code"),
        CheckConstraint("position > 0", name="positive_position"),
    )
