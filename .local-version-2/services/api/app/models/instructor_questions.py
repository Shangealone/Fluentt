"""Private instructor/class question supplements to published curriculum lessons."""
from uuid import UUID
from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, Entity, reference


class InstructorLessonQuestion(Entity, Base):
    __tablename__ = "instructor_lesson_questions"
    instructor_id: Mapped[UUID] = reference("users.id")
    class_id: Mapped[UUID] = reference("classes.id")
    lesson_id: Mapped[UUID] = reference("lessons.id")
    question_id: Mapped[UUID] = reference("questions.id")
    request_id: Mapped[UUID]
    fingerprint: Mapped[str] = mapped_column(String(64))
    __table_args__ = (UniqueConstraint("question_id"), UniqueConstraint("instructor_id", "request_id"))
