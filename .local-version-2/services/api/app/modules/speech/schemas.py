"""Speech recognition schemas and DTOs for Section 33."""

from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class ASRWordDTO(Model):
    word: str
    start_time_ms: int
    end_time_ms: int
    confidence: float | None = None


class TranscriptionRequestDTO(Model):
    attempt_id: UUID
    force_retranscribe: bool = False


class TranscriptionResponseDTO(Model):
    attempt_id: UUID
    activity_id: UUID
    transcription: str
    raw_transcript: str
    normalized_transcript: str
    detected_language: str
    prompt_language: str
    confidence: float | None = None
    duration_ms: int
    processing_time_ms: int
    model_id: str
    model_version: str
    simulated: bool
    silence_detected: bool
    words: list[ASRWordDTO] = Field(default_factory=list)
    scoring_status: str
    message: str


class TranscriptionStatusDTO(Model):
    attempt_id: UUID
    status: str
    has_transcription: bool
    transcription: str | None = None
    detected_language: str | None = None
    prompt_language: str | None = None
    silence_detected: bool = False
    simulated: bool = False


# ---------------------------------------------------------------------------
# Section 34: Pronunciation Assessment DTOs
# ---------------------------------------------------------------------------


class PhonemeAssessmentSchemaDTO(Model):
    phoneme: str
    accuracy_score: float
    status: str


class WordAssessmentSchemaDTO(Model):
    word: str
    target_phonemes: list[str]
    accuracy_score: float
    error_type: str
    phonemes: list[PhonemeAssessmentSchemaDTO] = Field(default_factory=list)
    tip: str | None = None


class PronunciationAssessmentDTO(Model):
    overall_score: float
    accuracy_score: float
    fluency_score: float
    completeness_score: float
    prosody_score: float
    words: list[WordAssessmentSchemaDTO] = Field(default_factory=list)
    target_language: str
    summary_feedback: str
    actionable_tips: list[str] = Field(default_factory=list)
    model_id: str
    model_version: str
    simulated: bool
    speech_rate_wpm: float
    confidence: float


class PronunciationAssessmentResponseDTO(Model):
    attempt_id: UUID
    activity_id: UUID
    scoring_status: str
    score: float | None = None
    feedback: str | None = None
    assessment: PronunciationAssessmentDTO | None = None
    transcription: str | None = None
    evaluator_configuration_id: UUID | None = None
    simulated: bool = False
    message: str

