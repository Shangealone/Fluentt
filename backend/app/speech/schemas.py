from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ValidationStatus = Literal["unvalidated_model_prediction", "validated"]


class StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid", strict=True, allow_inf_nan=False, hide_input_in_errors=True
    )


class ModelIdentity(StrictModel):
    model_id: str = Field(min_length=1, max_length=200)
    model_revision: str = Field(min_length=1, max_length=128)
    validation_status: ValidationStatus


class RecognitionPrediction(ModelIdentity):
    transcript: str = Field(max_length=2000)
    decoder_version: str = Field(min_length=1, max_length=128)


class WordMatch(StrictModel):
    target_index: int = Field(ge=0, le=59)
    expected_word: str = Field(min_length=1, max_length=100)
    recognized_word: str | None = Field(max_length=100)
    state: Literal["pending", "match", "mismatch"]


class RecognitionResponse(RecognitionPrediction):
    request_id: str
    sequence: int = Field(ge=0)
    is_final: bool
    words: list[WordMatch] = Field(max_length=60)


class PhonePrediction(StrictModel):
    phone: str = Field(min_length=1, max_length=12)
    score: float = Field(ge=0, le=100)
    pherr_prob: float = Field(ge=0, le=1)
    error: bool

    @model_validator(mode="after")
    def check_threshold(self):
        if self.error != (self.pherr_prob >= 0.70):
            raise ValueError("Inconsistent phoneme prediction")
        return self


class WordPrediction(StrictModel):
    word: str = Field(min_length=1, max_length=100)
    score: float = Field(ge=0, le=100)
    phonemes: list[PhonePrediction] = Field(min_length=1, max_length=100)


class AssessmentPrediction(ModelIdentity):
    overall_score: float = Field(ge=0, le=100)
    n_errors: int = Field(ge=0, le=600)
    words: list[WordPrediction] = Field(min_length=1, max_length=60)

    @model_validator(mode="after")
    def check_errors(self):
        phones = [p for w in self.words for p in w.phonemes]
        if len(phones) > 600 or self.n_errors != sum(p.error for p in phones):
            raise ValueError("Inconsistent phoneme coverage")
        return self


class AssessmentResponse(AssessmentPrediction):
    status: Literal["scored"] = "scored"
    request_id: str
    duration_ms: int = Field(ge=1, le=10000)


class Capability(StrictModel):
    mode: Literal["unavailable", "learner", "internal_qa"] = "unavailable"
    reason: str
    model_id: str | None = None
    model_revision: str | None = None
    validation_status: ValidationStatus | None = None


class SpeechCapabilities(StrictModel):
    language_code: Literal["en", "fil"]
    recognition: Capability
    assessment: Capability
    recognition_consent_version: str = "speech-recognition-v1"
    assessment_consent_version: str = "speech-assessment-v1"


class WorkerCapability(ModelIdentity):
    ready: bool
    language_code: Literal["en"] = "en"
