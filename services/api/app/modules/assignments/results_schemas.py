from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.modules.assignments.schemas import Item


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class ReleaseInput(Model):
    run_id: UUID
    released: bool
    confirm: Literal[True]


class Evaluation(Model):
    id: UUID
    status: Literal["COMPLETE", "REVIEW_REQUIRED", "NOT_APPLICABLE"]
    engine_version: str
    policy_version: str
    evaluated_at: datetime


class ReviewItem(Model):
    result_id: UUID
    assignment_question_id: UUID
    question_revision_id: UUID
    response_id: UUID | None
    position: int
    question: Item
    answer: dict | None
    state: Literal["AUTO_GRADABLE", "MANUAL_REVIEW_REQUIRED", "NOT_APPLICABLE", "UNSUPPORTED"]
    correct: bool | None
    awarded_points: Decimal | None
    max_points: Decimal | None


class ResultView(Model):
    assignment_id: UUID
    class_id: UUID
    version_id: UUID
    title: str
    attempt_id: UUID | None
    student_id: UUID | None
    student_username: str | None
    submitted_at: datetime | None
    submission_status: Literal["not_started", "in_progress", "submitted"]
    state: Literal["not_submitted", "submitted", "awaiting_manual_review", "withheld", "released", "not_applicable"]
    released: bool
    revision: str
    pinned_run_id: UUID | None
    evaluation: Evaluation | None
    earned_points: Decimal | None
    possible_points: Decimal | None
    items: list[ReviewItem]


class ResultSummary(Model):
    attempt_id: UUID
    student_id: UUID
    student_username: str
    submitted_at: datetime


class ResultPage(Model):
    items: list[ResultSummary]
    has_more: bool
    offset: int
    limit: int


class EvaluationPage(Model):
    items: list[Evaluation]
    has_more: bool
    offset: int
    limit: int
