from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.modules.grading.engine import POLICY_VERSION


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True, from_attributes=True)


class EvaluationInput(Model):
    policy_version: Literal["objective-exact-v1"] = POLICY_VERSION


class Query(Model):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=100000)


class ItemView(Model):
    id: UUID
    assignment_question_id: UUID
    question_revision_id: UUID
    response_id: UUID | None
    key_id: UUID | None
    source_grading_version: str | None
    rubric_version: str
    method: str
    position: int
    state: Literal["AUTO_GRADABLE", "MANUAL_REVIEW_REQUIRED", "NOT_APPLICABLE", "UNSUPPORTED"]
    reason: str
    correct: bool | None
    awarded_points: Decimal | None
    max_points: Decimal | None
    evaluation_metadata: dict


class RunSummary(Model):
    id: UUID
    attempt_id: UUID
    assignment_version_id: UUID
    actor_id: UUID
    engine_version: str
    policy_version: str
    evaluated_at: datetime
    completed_at: datetime
    context: Literal["ordinary_classroom"]
    status: Literal["COMPLETE", "REVIEW_REQUIRED", "NOT_APPLICABLE"]
    item_count: int
    earned_points: Decimal | None
    possible_points: Decimal | None
    automatic_earned_points: Decimal
    automatic_possible_points: Decimal


class RunView(RunSummary):
    policy_snapshot: dict
    items: list[ItemView]


class Page(Model):
    items: list[RunSummary]
    has_more: bool
    offset: int
    limit: int
