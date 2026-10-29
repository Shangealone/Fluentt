"""Opt-in personal English assessment of one complete audio clip, never transcript scoring.

No persistence, personal progress writer, research context, simulated fallback, or word-score average.
Azure credentials and the deployment's independently reviewed audio authorization stay server-side.
"""

import base64
import io
import json
import math
import wave
from typing import Literal
from uuid import UUID

import httpx
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app.models.ai import PronunciationActivity
from app.modules.identity.errors import IdentityError

CONSENT_VERSION = "azure-whole-phrase-audio-v1"
MAX_BYTES = 1_000_000
MAX_MS = 30_000


class Capability(BaseModel):
    available: bool
    provider: Literal["azure-speech"] = "azure-speech"
    locale: str | None
    maximum_duration_ms: int = MAX_MS
    consent_version: str = CONSENT_VERSION
    reason: Literal["ready", "disabled", "not_configured", "authorization_missing", "language_unsupported"]


class WholePhraseScore(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    status: Literal["scored"] = "scored"
    activity_id: UUID
    activity_version: int
    overall_score: float = Field(ge=0, le=100)
    accuracy_score: float = Field(ge=0, le=100)
    fluency_score: float = Field(ge=0, le=100)
    completeness_score: float = Field(ge=0, le=100)
    duration_ms: int
    provider: Literal["azure-speech"] = "azure-speech"
    locale: Literal["en-US"] = "en-US"
    contract_version: Literal["whole-phrase-azure-rest-v1"] = "whole-phrase-azure-rest-v1"
    # The hosted model build is not disclosed by this API; do not invent a model version.
    model_version: None = None
    simulated: Literal[False] = False


def fail(status, code, message):
    return IdentityError(status, code, message)


def require_personal(user):
    if user.role != "personal_student" or user.profile_status != "active":
        raise fail(403, "personal_only", "Whole-phrase scoring is available only in active Personal Learning.")


def capability(settings, language):
    reason = "ready"
    if language != "english":
        reason = "language_unsupported"
    elif not settings.pronunciation_azure_enabled:
        reason = "disabled"
    elif (
        not settings.pronunciation_azure_resource
        or not settings.pronunciation_azure_key
        or not settings.pronunciation_azure_key.get_secret_value().strip()
    ):
        reason = "not_configured"
    elif not settings.pronunciation_cloud_authorization_reference:
        reason = "authorization_missing"
    return Capability(available=reason == "ready", locale="en-US" if language == "english" else None, reason=reason)


def validate_wav(audio):
    """Parse actual bytes/duration; no trust in MIME or client clocks."""
    if not 44 <= len(audio) <= MAX_BYTES:
        raise fail(422, "whole_phrase_audio_invalid", "Use one WAV recording of 0.5 to 30 seconds.")
    try:
        with wave.open(io.BytesIO(audio), "rb") as source:
            if (source.getnchannels(), source.getsampwidth(), source.getframerate(), source.getcomptype()) != (
                1,
                2,
                16000,
                "NONE",
            ):
                raise ValueError("format")
            frames = source.getnframes()
            if not 8000 <= frames <= 480000:
                raise ValueError("duration")
            pcm = source.readframes(frames)
            if len(pcm) != frames * 2:
                raise ValueError("truncated")
    except (wave.Error, EOFError, ValueError, OSError):
        raise fail(
            422, "whole_phrase_audio_invalid", "Use a complete 16 kHz mono PCM16 WAV recording of 0.5 to 30 seconds."
        ) from None
    if not any(pcm):
        raise fail(422, "whole_phrase_no_speech", "The recording contains no audible signal. Please record again.")
    return round(frames / 16)


def assess_with_azure(settings, audio, reference_text, *, transport=None):
    """One final request to a fixed Azure host. Never send user IDs or credentials to clients."""
    parameters = {
        "ReferenceText": reference_text,
        "GradingSystem": "HundredMark",
        "Granularity": "FullText",
        "Dimension": "Comprehensive",
        "EnableMiscue": "True",
    }
    header = base64.b64encode(json.dumps(parameters, ensure_ascii=False).encode()).decode()
    url = f"https://{settings.pronunciation_azure_resource}.cognitiveservices.azure.com/stt/speech/recognition/conversation/cognitiveservices/v1"
    try:
        with httpx.Client(
            timeout=httpx.Timeout(25, connect=5), follow_redirects=False, trust_env=False, transport=transport
        ) as client:
            with client.stream(
                "POST",
                url,
                params={"language": "en-US", "format": "detailed"},
                content=audio,
                headers={
                    "Ocp-Apim-Subscription-Key": settings.pronunciation_azure_key.get_secret_value(),
                    "Pronunciation-Assessment": header,
                    "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
                    "Accept": "application/json",
                },
            ) as response:
                if response.status_code != 200:
                    raise fail(
                        503,
                        "whole_phrase_provider_unavailable",
                        "Pronunciation scoring is unavailable. No score was generated.",
                    )
                body = bytearray()
                for chunk in response.iter_bytes():
                    body.extend(chunk)
                    if len(body) > 256_000:
                        raise ValueError("oversized provider response")
                data = json.loads(body)
    except IdentityError:
        raise
    except httpx.HTTPError:
        # Never include response bodies, keys, transcripts, URLs or audio in errors/logs.
        raise fail(
            503,
            "whole_phrase_provider_unavailable",
            "Pronunciation scoring did not finish. No score is available; it is not retried automatically.",
        ) from None
    except (ValueError, TypeError):
        raise fail(
            502,
            "whole_phrase_provider_invalid",
            "The scoring service returned an incomplete result. No score is available.",
        ) from None
    if not isinstance(data, dict):
        raise fail(
            502,
            "whole_phrase_provider_invalid",
            "The scoring service returned an incomplete result. No score is available.",
        )
    if data.get("RecognitionStatus") in ("NoMatch", "InitialSilenceTimeout", "BabbleTimeout"):
        raise fail(
            422,
            "whole_phrase_no_speech",
            "The scoring service could not assess speech in this recording. Try the whole sentence again.",
        )
    if data.get("RecognitionStatus") != "Success":
        raise fail(
            503, "whole_phrase_provider_unavailable", "Pronunciation scoring is unavailable. No score was generated."
        )
    try:
        best = data["NBest"][0]
        # REST uses top-level score fields; accept the SDK's nested equivalent as well.
        scores = best.get("PronunciationAssessment", best)
        values = [scores[key] for key in ("PronScore", "AccuracyScore", "FluencyScore", "CompletenessScore")]
        if any(
            type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 100 for value in values
        ):
            raise ValueError("invalid score")
        return dict(zip(("overall_score", "accuracy_score", "fluency_score", "completeness_score"), values))
    except (KeyError, IndexError, TypeError, AttributeError, ValueError):
        raise fail(
            502,
            "whole_phrase_provider_invalid",
            "The scoring service returned an incomplete result. No score is available.",
        ) from None


def assess_whole_phrase(db, user, settings, activity_id, activity_version, audio, consent_version):
    require_personal(user)
    activity = db.scalar(
        select(PronunciationActivity)
        .where(PronunciationActivity.id == activity_id, PronunciationActivity.status == "published")
        .with_for_update(read=True)
    )
    if not activity:
        raise fail(404, "activity_not_found", "Pronunciation phrase is unavailable.")
    if activity.version != activity_version:
        raise fail(409, "whole_phrase_version_changed", "The phrase changed. Reload it before recording again.")
    if not capability(settings, activity.language).available:
        raise fail(
            503,
            "whole_phrase_scoring_unavailable",
            "Genuine pronunciation scoring is not configured for this language. No score was generated.",
        )
    if consent_version != CONSENT_VERSION:
        raise fail(
            403,
            "whole_phrase_permission_required",
            "Allow this recording to be sent to Microsoft Azure before requesting a score.",
        )
    if not activity.target_text.strip() or len(activity.target_text) > 2000:
        raise fail(422, "whole_phrase_reference_invalid", "This phrase is not eligible for whole-sentence scoring.")
    duration = validate_wav(audio)
    values = assess_with_azure(settings, audio, activity.target_text)
    return WholePhraseScore(activity_id=activity.id, activity_version=activity.version, duration_ms=duration, **values)
