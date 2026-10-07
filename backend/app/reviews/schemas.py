import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.content.schemas import VocabularyItemResponse


class ReviewSessionCreate(BaseModel):
    client_session_id: uuid.UUID


class ReviewSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_session_id: uuid.UUID
    created_at: datetime


class TimingEvidence(BaseModel):
    """Observed timing limitations; no research exclusion/validity classification."""

    version: Literal[1]
    clock_source: Literal["native_performance_now", "performance_now", "date_now_fallback"]
    start_boundary: Literal["prompt_layout_frame"]
    interruption_count: int = Field(ge=0, strict=True)
    interruption_reasons: list[Literal[
        "app_inactive", "app_background", "app_state_unknown", "app_blur",
        "screen_blur", "navigation_transition", "navigation_away",
    ]]

    @model_validator(mode="after")
    def consistent_interruptions(self) -> "TimingEvidence":
        reasons = self.interruption_reasons
        if (len(set(reasons)) != len(reasons) or len(reasons) > self.interruption_count
                or (self.interruption_count == 0) != (len(reasons) == 0)):
            raise ValueError("Inconsistent interruption evidence")
        return self


class ReviewAttemptCreate(BaseModel):
    client_event_id: uuid.UUID
    client_session_id: uuid.UUID
    session_id: uuid.UUID | None = None
    vocabulary_item_id: uuid.UUID
    # Absence is parsed only to reconcile pre-D5 accepted UUIDs. The shared
    # acceptance service requires both for every new event after its ledger check.
    content_revision_id: uuid.UUID | None = None
    content_release_id: uuid.UUID | None = None
    correct: bool
    response_time_ms: int = Field(
        ...,
        ge=0,
        le=3_600_000,
        description="Measured on-device elapsed milliseconds. Upper bound is a software sanity limit only.",
    )
    client_interaction_at: datetime
    device_platform: str = Field(..., min_length=1, max_length=32)
    application_version: str = Field(..., min_length=1, max_length=32)
    submitted_answer: str | None = None
    timing_evidence: TimingEvidence | None = None


class ReviewAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_event_id: uuid.UUID
    session_id: uuid.UUID
    vocabulary_item_id: uuid.UUID
    content_revision_id: uuid.UUID | None = None
    content_release_id: uuid.UUID | None = None
    correct: bool
    response_time_ms: int
    timing_evidence: TimingEvidence | None = None
    scheduler_type: str
    algorithm_version: str
    next_interval_seconds: int
    next_due_at: datetime
    server_acceptance_at: datetime
    scheduler_state: dict[str, Any] | None = None


class CurrentScheduleResponse(BaseModel):
    id: uuid.UUID
    scheduler_type: str
    algorithm_version: str
    next_interval_seconds: int
    next_due_at: datetime
    scheduler_state: dict[str, Any] | None


class PublishedReviewVocabularyItemResponse(VocabularyItemResponse):
    content_revision_id: uuid.UUID
    content_release_id: uuid.UUID


class EligibleReviewItem(BaseModel):
    vocabulary_item: PublishedReviewVocabularyItemResponse
    eligibility: Literal["new", "due"]
    current_schedule: CurrentScheduleResponse | None


class ReviewEligibilityResponse(BaseModel):
    lesson_id: uuid.UUID
    content_release_id: uuid.UUID
    evaluated_at: datetime
    items: list[EligibleReviewItem]
