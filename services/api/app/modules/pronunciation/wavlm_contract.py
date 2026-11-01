"""Strict model-prediction DTOs. No transcript scoring, simulated fallback or certainty claims."""

import math
import re
from typing import Literal
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

MODEL_ID = "Jianshu001/wavlm-phoneme-scorer"
REVISION = "19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da"
BASE_REVISION = "c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c"
ALIGNMENT_REVISION = "2c733782da5604684829819a5eb744c193fe9398"
CONTRACT = "wavlm-english-read-aloud-v1"
CONSENT = "local-wavlm-audio-and-results-v1"
THRESHOLD = 0.70
MAX_BYTES = 10 * 1024 * 1024


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False, hide_input_in_errors=True)


class Phone(StrictModel):
    phone: str = Field(pattern=r"^[a-z]{1,3}$")
    score: float = Field(ge=0, le=100)
    pherr_prob: float = Field(ge=0, le=1)
    error: bool
    tip: str | None = None


class Word(StrictModel):
    word: str = Field(min_length=1, max_length=100)
    score: float = Field(ge=0, le=100)
    phonemes: list[Phone] = Field(min_length=1, max_length=100)


class Prediction(StrictModel):
    overall_score: float = Field(ge=0, le=100)
    n_errors: int = Field(ge=0)
    words: list[Word] = Field(min_length=1, max_length=60)
    duration_ms: int = Field(ge=500, le=30000)
    processing_duration_ms: int = Field(ge=0)
    initialization_ms: int = Field(ge=0)


class Score(Prediction):
    status: Literal["scored"] = "scored"
    contract_version: Literal["wavlm-english-read-aloud-v1"] = CONTRACT
    assessment_id: UUID
    activity_id: UUID
    activity_version: int
    expected_text: str
    assessed_language: Literal["english"] = "english"
    attempted_at: datetime
    attempt_number: int
    model_id: Literal["Jianshu001/wavlm-phoneme-scorer"] = MODEL_ID
    model_version: Literal["19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da"] = REVISION
    simulated: Literal[False] = False
    validation_status: Literal["unvalidated_model_prediction"] = "unvalidated_model_prediction"
    feedback: str = "Model feedback is uncertain. Practise the highlighted sounds and compare with reference speech."


TIPS = {
    "dh": "Practise voiced TH: place your tongue lightly between your teeth and use your voice.",
    "th": "Practise unvoiced TH: place your tongue lightly between your teeth and gently blow air.",
    "v": "Rest your upper teeth lightly on your lower lip and use your voice.",
    "f": "Rest your upper teeth lightly on your lower lip and gently blow air.",
    "ng": "Practise the final sound in 'sing'; let air pass through your nose without adding a hard G.",
    "sh": "Round your lips slightly and gently make the SH sound in 'ship'.",
    "p": "Close your lips, then release a small puff of air for P.",
    "b": "Close your lips, use your voice, then release them for B.",
    "iy": "Practise the vowel in 'see'; keep your tongue high and toward the front.",
    "ih": "Practise the relaxed short vowel in 'sit'.",
}


def reference(text):
    # This normalization affects only this opt-in acoustic reference, never answer validators.
    value = " ".join(text.replace("’", "'").split())
    words = re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", value)
    if not value or len(value) > 500 or not 1 <= len(words) <= 60 or re.search(r"[^A-Za-z' .,!?;:\-]", value):
        raise ValueError("Use an English alphabetic reference of 1–60 words, up to 500 characters.")
    return value, words


def prediction(raw, expected):
    """Accept only complete actual output; never repair missing words/phones with zeros."""
    result = Prediction.model_validate(raw)
    _, words = reference(expected)
    if [w.word.casefold() for w in result.words] != [w.casefold() for w in words]:
        raise ValueError("Incomplete reference alignment")
    phones = [p for w in result.words for p in w.phonemes]
    if len(phones) > 600 or result.n_errors != sum(p.error for p in phones):
        raise ValueError("Inconsistent model output")
    for phone in phones:
        if phone.error != (phone.pherr_prob >= THRESHOLD):
            raise ValueError("Inconsistent phoneme threshold")
        phone.tip = (
            (TIPS.get(phone.phone) or "Listen to the reference, then practise this sound slowly.")
            if phone.error
            else None
        )
    # Reject unbounded/non-finite values above; do not rescale, round up or force a minimum score.
    assert math.isfinite(result.overall_score)
    return result
