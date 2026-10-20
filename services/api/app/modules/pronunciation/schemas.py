"""Pronunciation schemas and DTOs for Section 32."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

LanguageTrack = Literal["tagalog", "english"]
ScoringStatus = Literal["pending", "processing", "scored", "unsupported", "failed", "unscored"]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class PronunciationActivityDTO(Model):
    id: UUID
    lesson_id: UUID | None = None
    target_text: str
    language: LanguageTrack
    instructions: str | None = None
    reference_audio_metadata: dict[str, Any] = Field(default_factory=dict)
    version: int = 1


class PronunciationActivitiesResponse(Model):
    activities: list[PronunciationActivityDTO]
    total: int


class PronunciationAttemptSubmissionDTO(Model):
    attempt_id: UUID
    activity_id: UUID
    target_text: str
    language: str
    attempted_at: datetime
    scoring_status: ScoringStatus
    file_size_bytes: int
    duration_ms: int
    mime_type: str
    simulated: bool = False
    message: str
    transcription: str | None = None
    transcription_metadata: dict[str, Any] | None = None
    score: float | None = None
    feedback: str | None = None
    assessment: dict[str, Any] | None = None


class PronunciationAttemptHistoryDTO(Model):
    attempt_id: UUID
    activity_id: UUID
    target_text: str
    language: str
    attempted_at: datetime
    scoring_status: ScoringStatus
    file_size_bytes: int
    duration_ms: int
    transcription: str | None = None
    score: float | None = None
    feedback: str | None = None

