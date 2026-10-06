import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ReviewSessionCreate(BaseModel):
    client_session_id: uuid.UUID


class ReviewSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_session_id: uuid.UUID
    created_at: datetime


class ReviewAttemptCreate(BaseModel):
    client_event_id: uuid.UUID
    client_session_id: uuid.UUID
    session_id: uuid.UUID | None = None
    vocabulary_item_id: uuid.UUID
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


class ReviewAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_event_id: uuid.UUID
    session_id: uuid.UUID
    vocabulary_item_id: uuid.UUID
    correct: bool
    response_time_ms: int
    scheduler_type: str
    algorithm_version: str
    next_interval_seconds: int
    next_due_at: datetime
    server_acceptance_at: datetime
    scheduler_state: dict[str, Any] | None = None
