import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    device_platform: str = Field(..., max_length=32)
    application_version: str = Field(..., max_length=32)
    submitted_answer: str | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_attempt_input(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # 1. Map session_id to client_session_id if client_session_id is absent
            if "client_session_id" not in data and "session_id" in data:
                data["client_session_id"] = data["session_id"]

            # 2. Map created_at to client_interaction_at if absent
            if "client_interaction_at" not in data and "created_at" in data:
                data["client_interaction_at"] = data["created_at"]

            # 3. Map legacy performance_rating to submitted_answer if absent
            if "submitted_answer" not in data and "performance_rating" in data:
                data["submitted_answer"] = str(data["performance_rating"])

            # 4. Default correct to True only if omitted
            if "correct" not in data:
                data["correct"] = True

            # 5. Provide standard defaults for metadata if not provided
            if "device_platform" not in data:
                data["device_platform"] = "android"
            if "application_version" not in data:
                data["application_version"] = "v0.1"

        return data


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
