import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Decimal is preserved in Python and persisted JSON evidence; the HTTP renderer
# emits exact decimal JSON numbers without passing through a binary float.
LosslessScore = Decimal | None

CATEGORY_POLICY_VERSION = "pronunciation-category-v1"
FEEDBACK_POLICY_VERSION = "pronunciation-feedback-v1"
SCHEMA_VERSION = "pronunciation-result-v1"
PROVIDER = "azure_speech_pronunciation"
ASSESSMENT_CONFIG_VERSION = "azure-pa-en-us-term-v1"
ADAPTER_VERSION = "azure-short-rest-adapter-v1"
INTEGRATION = "short_audio_rest"
API_CONTRACT = "cognitiveservices/v1"
CONVERTER_PROFILE_VERSION = "ffmpeg-pcm16k-mono-v1"
CAPTURE_PROFILE_VERSION = "expo57-term-m4a-v1"


class PronunciationAttemptMetadata(BaseModel):
    """Exact metadata part; extra keys forbidden."""

    model_config = ConfigDict(extra="forbid")

    client_pronunciation_attempt_id: uuid.UUID
    content_release_id: uuid.UUID
    vocabulary_item_id: uuid.UUID
    content_revision_id: uuid.UUID
    original_interaction_at: datetime
    capture_profile_version: Literal["expo57-term-m4a-v1"]
    device_platform: Literal["android"]
    application_version: str = Field(..., min_length=1, max_length=32)
    target_kind: Literal["term", "sentence"]

    @model_validator(mode="after")
    def aware_timestamp(self) -> "PronunciationAttemptMetadata":
        if self.original_interaction_at.tzinfo is None:
            raise ValueError("original_interaction_at must be timezone-aware")
        self.original_interaction_at = self.original_interaction_at.astimezone(UTC)
        return self


class TargetContract(BaseModel):
    vocabulary_item_id: uuid.UUID
    content_revision_id: uuid.UUID
    content_release_id: uuid.UUID
    target_kind: Literal["term", "sentence"]
    term: str


class AssessmentContract(BaseModel):
    accuracy_score: LosslessScore
    accuracy_score_display: str | None
    category: Literal["A", "B", "C", "D"] | None
    category_policy_version: str | None
    pronunciation_score: LosslessScore
    completeness_score: LosslessScore
    fluency_score: LosslessScore


class PhonemeObservation(BaseModel):
    phoneme_index: int = Field(..., ge=0)
    target_unit: str = Field(..., max_length=32)
    accuracy_score: LosslessScore


class WordObservation(BaseModel):
    word_index: int = Field(..., ge=0)
    target_unit: str = Field(..., max_length=255)
    is_target: bool
    accuracy_score: LosslessScore
    provider_error_type: Literal["None", "Mispronunciation", "Omission", "Insertion"]
    offset_100ns: int | None = Field(default=None, ge=0)
    duration_100ns: int | None = Field(default=None, ge=0)
    phonemes: list[PhonemeObservation] = Field(..., max_length=64)


class Issue(BaseModel):
    id: str
    level: Literal["word", "phoneme"]
    word_index: int = Field(..., ge=0)
    phoneme_index: int | None = Field(default=None, ge=0)
    target_unit: str
    accuracy_score: LosslessScore
    provider_error_type: (
        Literal["None", "Mispronunciation", "Omission", "Insertion"] | None
    )


class FeedbackContract(BaseModel):
    general_feedback_key: str | None
    selected_issue_refs: list[str]
    feedback_policy_version: str | None


class ProviderMetadata(BaseModel):
    provider: str
    locale: str
    assessment_config_version: str
    integration: str
    api_contract: str
    adapter_version: str
    http_client_version: str | None
    sdk_version: str | None
    hosted_model_version: str | None
    recognition_status: str | None
    capture_profile_version: str
    converter_profile_version: str
    converter_version: str | None


class ReasonContract(BaseModel):
    category: Literal["USER_CORRECTABLE", "RETRYABLE_SERVICE", "SERVER_CONFIGURATION"]
    code: str
    recovery: Literal["rerecord", "check_status", "retry_later", "operator_action"]


class TimestampsContract(BaseModel):
    original_interaction_at: datetime
    received_at: datetime
    processing_started_at: datetime | None
    completed_at: datetime | None


class PronunciationResponse(BaseModel):
    schema_version: Literal["pronunciation-result-v1"]
    status: Literal["scored", "unscorable", "processing", "failed"]
    attempt_id: uuid.UUID | None
    client_pronunciation_attempt_id: uuid.UUID
    target: TargetContract | None
    assessment: AssessmentContract
    word_observations: list[WordObservation]
    issues: list[Issue]
    feedback: FeedbackContract
    provider_metadata: ProviderMetadata
    reason: ReasonContract | None
    timestamps: TimestampsContract


class PronunciationErrorEnvelope(BaseModel):
    detail: str
    code: str
    category: Literal[
        "USER_CORRECTABLE", "RETRYABLE_SERVICE", "SERVER_CONFIGURATION", "AUTH"
    ]
    result: PronunciationResponse | None
