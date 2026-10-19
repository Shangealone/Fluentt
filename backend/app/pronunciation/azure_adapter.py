"""Azure short-audio REST pronunciation adapter (azure-short-rest-adapter-v1).

Strict field paths only (NBest[0]); no retries, no redirects, bounded response.
"""

import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import httpx

from app.pronunciation.schemas import (
    ADAPTER_VERSION,
    PROVIDER,
)
from app.pronunciation.scoring import (
    PrimaryInvalid,
    ProviderResponseInvalid,
    parse_optional_score,
    parse_primary,
    parse_word_observations,
)

ADAPTER = ADAPTER_VERSION
PROVIDER_NAME = PROVIDER
MAX_PROVIDER_RESPONSE_BYTES = 262_144
SHORT_AUDIO_ROUTE = "/stt/speech/recognition/conversation/cognitiveservices/v1"

SUPPORTED_UNSCORABLE_STATUSES = {
    "InitialSilenceTimeout": "INITIAL_SILENCE",
    "BabbleTimeout": "BABBLE",
    "NoMatch": "NO_MATCH",
}


@dataclass
class ProviderOutcome:
    kind: str  # "scorable" | "unscorable" | "failed"
    recognition_status: str | None
    accuracy_score: Decimal | None = None
    pronunciation_score: Decimal | None = None
    completeness_score: Decimal | None = None
    fluency_score: Decimal | None = None
    raw_words: list[Any] | None = None
    error_code: str | None = None
    error_category: str | None = None  # RETRYABLE_SERVICE | SERVER_CONFIGURATION


class ProviderConfigurationError(Exception):
    """Credentials/config/unsupported contract; operator-correctable."""


class ProviderUnavailable(Exception):
    """Retryable provider/service failure."""


def parse_provider_payload(data: Any) -> ProviderOutcome:
    """Strict structural parse of one successful HTTP 200 provider body."""
    if not isinstance(data, dict):
        raise ProviderResponseInvalid("provider body is not an object")
    status = data.get("RecognitionStatus")
    if not isinstance(status, str):
        raise ProviderResponseInvalid("RecognitionStatus missing")
    if status in SUPPORTED_UNSCORABLE_STATUSES:
        return ProviderOutcome(kind="unscorable", recognition_status=status)
    if status == "Error":
        return ProviderOutcome(
            kind="failed",
            recognition_status=status,
            error_code="AZURE_RECOGNITION_ERROR",
            error_category="RETRYABLE_SERVICE",
        )
    if status != "Success":
        return ProviderOutcome(
            kind="failed",
            recognition_status=status,
            error_code="PROVIDER_RESPONSE_INVALID",
            error_category="SERVER_CONFIGURATION",
        )
    nbest = data.get("NBest")
    if not isinstance(nbest, list) or not nbest or not isinstance(nbest[0], dict):
        raise ProviderResponseInvalid("NBest[0] missing")
    candidate = nbest[0]
    if "AccuracyScore" not in candidate:
        raise ProviderResponseInvalid("primary AccuracyScore missing")
    try:
        primary = parse_primary(candidate["AccuracyScore"])
    except PrimaryInvalid as exc:
        raise ProviderResponseInvalid(str(exc)) from exc
    words = parse_word_observations(candidate.get("Words", []))
    try:
        return ProviderOutcome(
            kind="scorable",
            recognition_status=status,
            accuracy_score=primary,
            pronunciation_score=parse_optional_score(candidate.get("PronScore")),
            completeness_score=parse_optional_score(candidate.get("CompletenessScore")),
            fluency_score=parse_optional_score(candidate.get("FluencyScore")),
            raw_words=words,
        )
    except PrimaryInvalid as exc:
        raise ProviderResponseInvalid(str(exc)) from exc


def assess_utterance(
    wav_bytes: bytes,
    *,
    reference_text: str,
    endpoint: str,
    key: str,
    region: str,
    timeout_seconds: float = 20.0,
    client: httpx.Client | None = None,
) -> ProviderOutcome:
    """One bounded assessment call. Raises ProviderConfigurationError /
    ProviderUnavailable; returns ProviderOutcome for application statuses."""
    if not endpoint or not key:
        raise ProviderConfigurationError("AZURE_CONFIG_MISSING")
    url = endpoint.rstrip("/") + SHORT_AUDIO_ROUTE
    assessment = {
        "ReferenceText": reference_text,
        "GradingSystem": "HundredMark",
        "Granularity": "Phoneme",
        "Dimension": "Comprehensive",
        "EnableMiscue": True,
        "EnableProsodyAssessment": False,
    }
    import base64
    import json

    header_value = base64.b64encode(
        json.dumps(assessment, ensure_ascii=False, separators=(",", ":")).encode(
            "utf-8"
        )
    ).decode("ascii")
    headers = {
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Accept": "application/json",
        "Ocp-Apim-Subscription-Key": key,
        "Pronunciation-Assessment": header_value,
    }
    params = {"language": "en-US", "format": "detailed"}
    timeout = httpx.Timeout(timeout_seconds, connect=min(5.0, timeout_seconds))
    owns_client = client is None
    http = client or httpx.Client(
        timeout=timeout, follow_redirects=False, trust_env=False
    )
    try:
        started = time.monotonic()
        with http.stream(
            "POST",
            url,
            params=params,
            headers=headers,
            content=wav_bytes,
            timeout=timeout,
        ) as response:
            if response.status_code in (401, 403):
                raise ProviderConfigurationError("AZURE_CREDENTIALS_INVALID")
            if response.status_code == 429:
                raise ProviderUnavailable("AZURE_RATE_LIMIT")
            if response.status_code >= 500:
                raise ProviderUnavailable("AZURE_UNAVAILABLE")
            if response.status_code != 200:
                raise ProviderConfigurationError("PROVIDER_CONFIG_UNSUPPORTED")
            body = bytearray()
            for chunk in response.iter_bytes(chunk_size=8192):
                if time.monotonic() - started > timeout_seconds:
                    raise ProviderUnavailable("AZURE_TIMEOUT")
                if len(body) + len(chunk) > MAX_PROVIDER_RESPONSE_BYTES:
                    raise ProviderResponseInvalid(
                        "provider response exceeds size bound"
                    )
                body.extend(chunk)
    except httpx.TimeoutException as exc:
        raise ProviderUnavailable("AZURE_TIMEOUT") from exc
    except httpx.HTTPError as exc:
        raise ProviderUnavailable("AZURE_UNAVAILABLE") from exc
    finally:
        if owns_client:
            http.close()
    try:
        data = json.loads(body, parse_float=Decimal)
    except ValueError as exc:
        raise ProviderResponseInvalid("provider response is not JSON") from exc
    outcome = parse_provider_payload(data)
    outcome.error_code = outcome.error_code or "PROVIDER_RESPONSE_INVALID"
    return outcome


def http_client_version() -> str:
    return httpx.__version__
