"""Spaced repetition engine foundation: typed interfaces, event schemas, and algorithm contracts.
Preserves scientific comparability across SM-2, FSRS-6, and FIFAKT without formulas.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

ReviewRating = Literal["again", "hard", "good", "easy"]
EvaluationContext = Literal["self_study", "classroom", "research"]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class ReviewEventInput(Model):
    event_key: UUID
    vocabulary_item_id: UUID
    recall_rating: ReviewRating
    response_duration_ms: int = Field(ge=0, le=300000)
    reviewed_at: datetime
    context_type: EvaluationContext = "self_study"
    class_id: UUID | None = None
    study_id: UUID | None = None


class AlgorithmIdentity(Model):
    algorithm: Literal["sm2", "fsrs6", "fifakt", "unsupported"]
    implementation_version: str
    configuration_version: int
    parameters: dict[str, Any] = Field(default_factory=dict)


class CardSchedulingState(Model):
    context_id: UUID
    vocabulary_item_id: UUID
    algorithm: str
    implementation_version: str
    configuration_version: int
    state_revision: int = Field(ge=1)
    state_data: dict[str, Any] = Field(default_factory=dict)
    due_at: datetime
    last_reviewed_at: datetime | None = None


class ScheduleDecision(Model):
    algorithm: str
    implementation_version: str
    configuration_version: int
    previous_state: dict[str, Any]
    resulting_state: dict[str, Any]
    previous_interval_seconds: Decimal
    resulting_interval_seconds: Decimal
    due_at: datetime
    state_revision: int


class DueReviewItem(Model):
    review_state_id: UUID
    vocabulary_item_id: UUID
    term: str
    meaning: str
    language: str
    due_at: datetime
    last_reviewed_at: datetime | None = None
    overdue_seconds: float = 0.0


class DueReviewBatch(Model):
    items: list[DueReviewItem]
    total_due: int
    algorithm: str
    as_of: datetime
