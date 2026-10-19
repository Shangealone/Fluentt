"""Internal immutable evaluations; never overwrite submitted capture evidence."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID
from sqlalchemy import CheckConstraint, ForeignKeyConstraint, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, Entity, choice, json_object, reference


class GradingRun(Entity, Base):
    __tablename__ = "grading_runs"
    attempt_id: Mapped[UUID] = reference("assignment_attempts.id")
    assignment_version_id: Mapped[UUID] = reference("assignment_versions.id")
    actor_id: Mapped[UUID] = reference("users.id")
    engine_version: Mapped[str] = mapped_column(String(80))
    policy_version: Mapped[str] = mapped_column(String(80))
    policy_snapshot: Mapped[dict] = json_object()
    evaluated_at: Mapped[datetime]
    completed_at: Mapped[datetime | None]
    context: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(choice("grading_run_status", "COMPLETE", "REVIEW_REQUIRED", "NOT_APPLICABLE"))
    item_count: Mapped[int] = mapped_column(Integer)
    earned_points: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    possible_points: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    automatic_earned_points: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    automatic_possible_points: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    __table_args__ = (
        UniqueConstraint("attempt_id", "engine_version", "policy_version"),
        UniqueConstraint("id", "assignment_version_id", name="uq_grading_runs_version"),
        ForeignKeyConstraint(
            ["attempt_id", "assignment_version_id"],
            ["assignment_attempts.id", "assignment_attempts.assignment_version_id"],
            ondelete="RESTRICT",
            name="fk_grading_runs_attempt_version",
        ),
        CheckConstraint(
            "item_count > 0 AND automatic_earned_points >= 0 AND automatic_possible_points >= automatic_earned_points",
            name="valid_subtotals",
        ),
        CheckConstraint(
            "(status='COMPLETE' AND earned_points IS NOT NULL AND possible_points IS NOT NULL AND earned_points >= 0 AND possible_points >= earned_points AND possible_points > 0) OR (status <> 'COMPLETE' AND earned_points IS NULL AND possible_points IS NULL)",
            name="valid_totals",
        ),
        CheckConstraint("context='ordinary_classroom'", name="classroom_only"),
    )


class GradingItemResult(Entity, Base):
    __tablename__ = "grading_item_results"
    run_id: Mapped[UUID] = reference("grading_runs.id")
    assignment_version_id: Mapped[UUID] = reference("assignment_versions.id")
    assignment_question_id: Mapped[UUID] = reference("assignment_questions.id")
    question_revision_id: Mapped[UUID] = reference("question_revisions.id")
    response_id: Mapped[UUID | None] = reference("student_responses.id", nullable=True)
    key_id: Mapped[UUID | None] = reference("question_answer_keys.id", nullable=True)
    source_grading_version: Mapped[str | None] = mapped_column(String(80))
    rubric_version: Mapped[str] = mapped_column(String(80))
    method: Mapped[str] = mapped_column(String(40))
    position: Mapped[int] = mapped_column(Integer)
    state: Mapped[str] = mapped_column(
        choice("grading_item_state", "AUTO_GRADABLE", "MANUAL_REVIEW_REQUIRED", "NOT_APPLICABLE", "UNSUPPORTED")
    )
    reason: Mapped[str] = mapped_column(String(80))
    correct: Mapped[bool | None]
    awarded_points: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    max_points: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    evaluation_metadata: Mapped[dict] = json_object()
    __table_args__ = (
        UniqueConstraint("run_id", "assignment_question_id"),
        UniqueConstraint("run_id", "position", name="uq_grading_item_results_position"),
        ForeignKeyConstraint(
            ["run_id", "assignment_version_id"],
            ["grading_runs.id", "grading_runs.assignment_version_id"],
            ondelete="RESTRICT",
            name="fk_grading_items_run_version",
        ),
        ForeignKeyConstraint(
            ["assignment_question_id", "assignment_version_id"],
            ["assignment_questions.id", "assignment_questions.assignment_version_id"],
            ondelete="RESTRICT",
            name="fk_grading_items_question_version",
        ),
        CheckConstraint("position > 0", name="positive_position"),
        CheckConstraint(
            "(state='AUTO_GRADABLE' AND correct IS NOT NULL AND max_points IS NOT NULL AND max_points=1.00 AND awarded_points IS NOT NULL AND awarded_points IN (0.00,1.00) AND awarded_points=CASE WHEN correct THEN 1.00 ELSE 0.00 END) OR (state <> 'AUTO_GRADABLE' AND correct IS NULL AND awarded_points IS NULL AND max_points IS NULL)",
            name="valid_outcome",
        ),
    )
