"""Append-only visibility decisions, separate from immutable evaluations and responses."""

from uuid import UUID
from sqlalchemy import CheckConstraint, ForeignKeyConstraint, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, Entity, reference


class AssessmentResultRelease(Entity, Base):
    __tablename__ = "assessment_result_releases"
    attempt_id: Mapped[UUID] = reference("assignment_attempts.id")
    run_id: Mapped[UUID] = reference("grading_runs.id")
    assignment_version_id: Mapped[UUID] = reference("assignment_versions.id")
    actor_id: Mapped[UUID] = reference("users.id")
    request_key: Mapped[UUID]
    sequence: Mapped[int] = mapped_column(Integer)
    released: Mapped[bool]
    __table_args__ = (
        UniqueConstraint("attempt_id", "sequence", name="uq_result_release_sequence"),
        UniqueConstraint("actor_id", "request_key", name="uq_result_release_request"),
        ForeignKeyConstraint(
            ["run_id", "assignment_version_id"],
            ["grading_runs.id", "grading_runs.assignment_version_id"],
            ondelete="RESTRICT",
            name="fk_result_release_run_version",
        ),
        CheckConstraint("sequence > 0", name="positive_sequence"),
    )
