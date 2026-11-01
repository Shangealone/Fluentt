"""Tagalog ASR/text comparison only. No acoustic score or fabricated confidence."""

from datetime import datetime
from difflib import SequenceMatcher
import unicodedata
from typing import Literal
from uuid import UUID

from pydantic import Field
from .wavlm_contract import StrictModel
from .speech_text import normalize

MODEL_ID = "facebook/mms-1b-all"
REVISION = "3d33597edbdaaba14a8e858e2c8caa76e3cec0cd"
CONTRACT = "mms-tgl-transcription-comparison-v1"
CONSENT = "local-mms-audio-and-transcript-v1"
NORMALIZATION = "tagalog-nfc-casefold-punctuation-v1"


def reference(text):
    if not isinstance(text, str) or not text.strip() or len(text) > 500:
        raise ValueError("Use a Tagalog reference up to 500 characters.")
    if any(unicodedata.category(char) in {"Cc", "Cf", "Cs"} and char not in "\n\r\t" for char in text):
        raise ValueError("Unsupported reference characters")
    for char in text:
        if char.isalpha() and "LATIN" not in unicodedata.name(char, ""):
            raise ValueError("Latin-script Tagalog required")
    value = normalize(text)
    if not any(char.isalpha() for char in value) or not 1 <= len(value.split()) <= 60:
        raise ValueError("Use 1–60 Tagalog words.")
    return text, value


class Difference(StrictModel):
    kind: Literal["equal", "replace", "delete", "insert"]
    reference: list[str]
    recognized: list[str]


class Comparison(StrictModel):
    normalization_version: Literal["tagalog-nfc-casefold-punctuation-v1"] = NORMALIZATION
    normalized_reference: str
    normalized_transcript: str
    exact_match: bool
    differences: list[Difference]


def compare(expected, recognized):
    _, left = reference(expected)
    if not isinstance(recognized, str) or len(recognized) > 2000:
        raise ValueError("Invalid recognized speech")
    if any(unicodedata.category(char) in {"Cc", "Cf", "Cs"} and char not in "\n\r\t" for char in recognized):
        raise ValueError("Unsupported recognized characters")
    if not any(char.isalpha() for char in recognized) or any(
            char.isalpha() and "LATIN" not in unicodedata.name(char, "") for char in recognized):
        raise ValueError("No usable Latin-script Tagalog transcript")
    right = normalize(recognized)
    if not right or len(recognized) > 2000:
        raise ValueError("No usable recognized speech")
    a, b = left.split(), right.split()
    return Comparison(
        normalized_reference=left, normalized_transcript=right, exact_match=left == right,
        differences=[Difference(kind=kind, reference=a[i:j], recognized=b[k:l])
                     for kind, i, j, k, l in SequenceMatcher(None, a, b, autojunk=False).get_opcodes()],
    )


class Prediction(StrictModel):
    transcript: str = Field(min_length=1, max_length=2000)
    # CTC greedy decoding does not give calibrated utterance correctness confidence.
    confidence: None = None
    confidence_status: Literal["unavailable_uncalibrated"] = "unavailable_uncalibrated"
    duration_ms: int = Field(ge=500, le=30000)
    processing_duration_ms: int = Field(ge=0)
    initialization_ms: int = Field(ge=0)


class Transcription(Prediction):
    status: Literal["transcribed"] = "transcribed"
    contract_version: Literal["mms-tgl-transcription-comparison-v1"] = CONTRACT
    assessment_id: UUID
    activity_id: UUID
    activity_version: int
    expected_text: str
    assessed_language: Literal["tagalog"] = "tagalog"
    attempted_at: datetime
    attempt_number: int
    model_id: Literal["facebook/mms-1b-all"] = MODEL_ID
    model_version: Literal["3d33597edbdaaba14a8e858e2c8caa76e3cec0cd"] = REVISION
    adapter: Literal["tgl"] = "tgl"
    simulated: Literal[False] = False
    validation_status: Literal["unvalidated_asr_prediction"] = "unvalidated_asr_prediction"
    pronunciation_scoring: Literal["unavailable"] = "unavailable"
    overall_score: None = None
    comparison: Comparison
    feedback: str = "Compare the recognized words with the reference and listen to your recording. ASR can make mistakes; text agreement does not establish pronunciation quality. Confidence is unavailable."
