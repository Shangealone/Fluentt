"""Azure short-audio adapter oracles: strict parse + HTTP status mapping.

All provider bodies are FIXTURES shaped from the documented contract; no live
provider call is made anywhere in this module.
"""

from decimal import Decimal

import httpx
import pytest

from app.pronunciation import azure_adapter, scoring
from tests.pronunciation_helpers import scorable_payload, unscorable_payload


def _client_returning(
    status_code: int, body: bytes, capture: dict | None = None
) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        if capture is not None:
            capture["request"] = request
        return httpx.Response(status_code, content=body)

    return httpx.Client(transport=httpx.MockTransport(handler))


def _assess(client: httpx.Client) -> azure_adapter.ProviderOutcome:
    return azure_adapter.assess_utterance(
        b"RIFF-fake-wav-bytes",
        reference_text="good morning",
        endpoint="https://example.speech.microsoft.com",
        key="fixture-key-not-a-secret",
        region="eastus",
        client=client,
    )


def test_parse_scorable_fixture_extracts_primary_and_words() -> None:
    outcome = azure_adapter.parse_provider_payload(scorable_payload("good morning"))
    assert outcome.kind == "scorable"
    assert outcome.recognition_status == "Success"
    assert outcome.accuracy_score == Decimal("89.995")
    assert outcome.pronunciation_score == Decimal("88.5")
    assert outcome.completeness_score == Decimal("96.0")
    assert outcome.fluency_score == Decimal("90.0")
    assert len(outcome.raw_words or []) == 2


@pytest.mark.parametrize(
    "status", ["NoMatch", "InitialSilenceTimeout", "BabbleTimeout"]
)
def test_parse_unscorable_statuses(status: str) -> None:
    outcome = azure_adapter.parse_provider_payload(unscorable_payload(status))
    assert outcome.kind == "unscorable"
    assert outcome.recognition_status == status
    assert outcome.accuracy_score is None


def test_parse_root_error_status_is_retryable() -> None:
    outcome = azure_adapter.parse_provider_payload({"RecognitionStatus": "Error"})
    assert outcome.kind == "failed"
    assert outcome.error_code == "AZURE_RECOGNITION_ERROR"
    assert outcome.error_category == "RETRYABLE_SERVICE"


def test_parse_unknown_status_is_configuration_fault() -> None:
    outcome = azure_adapter.parse_provider_payload({"RecognitionStatus": "Weird"})
    assert outcome.kind == "failed"
    assert outcome.error_code == "PROVIDER_RESPONSE_INVALID"
    assert outcome.error_category == "SERVER_CONFIGURATION"


@pytest.mark.parametrize(
    "body",
    [
        [],
        {},
        {"RecognitionStatus": 42},
        {"RecognitionStatus": "Success"},  # NBest missing
        {"RecognitionStatus": "Success", "NBest": []},
        {"RecognitionStatus": "Success", "NBest": [{"PronScore": 88}]},
        {"RecognitionStatus": "Success", "NBest": [{"AccuracyScore": "high"}]},
        {"RecognitionStatus": "Success", "NBest": [{"AccuracyScore": 101}]},
        {"RecognitionStatus": "Success", "NBest": [{"AccuracyScore": True}]},
        {
            "RecognitionStatus": "Success",
            "NBest": [{"AccuracyScore": 90, "Words": "no"}],
        },
        {
            "RecognitionStatus": "Success",
            "NBest": [{"AccuracyScore": 90, "Words": [{"Word": ""}]}],
        },
        {
            "RecognitionStatus": "Success",
            "NBest": [
                {
                    "AccuracyScore": 90,
                    "Words": [
                        {
                            "Word": "x",
                            "AccuracyScore": 90,
                            "ErrorType": "Whatever",
                        }
                    ],
                }
            ],
        },
    ],
)
def test_parse_rejects_malformed_structures(body) -> None:
    with pytest.raises(scoring.ProviderResponseInvalid):
        azure_adapter.parse_provider_payload(body)


def test_parse_enforces_word_and_phoneme_bounds() -> None:
    payload = scorable_payload("good morning")
    payload["NBest"][0]["Words"] = [
        {"Word": f"w{i}", "AccuracyScore": 90, "ErrorType": "None", "Phonemes": []}
        for i in range(65)
    ]
    with pytest.raises(scoring.ProviderResponseInvalid, match="too many word"):
        azure_adapter.parse_provider_payload(payload)


def test_assess_builds_documented_request_without_leaking_response_contract() -> None:
    capture: dict = {}
    body = scorable_payload("good morning")
    import json

    client = _client_returning(200, json.dumps(body).encode(), capture)
    outcome = _assess(client)
    assert outcome.kind == "scorable"
    request = capture["request"]
    assert request.url.path.endswith(azure_adapter.SHORT_AUDIO_ROUTE)
    assert request.url.params["language"] == "en-US"
    assert request.url.params["format"] == "detailed"
    assert request.headers["content-type"].startswith("audio/wav")
    assert request.headers["Ocp-Apim-Subscription-Key"] == "fixture-key-not-a-secret"
    assessment_header = request.headers["Pronunciation-Assessment"]
    import base64

    decoded = json.loads(base64.b64decode(assessment_header))
    assert decoded["ReferenceText"] == "good morning"
    assert decoded["GradingSystem"] == "HundredMark"
    assert decoded["Granularity"] == "Phoneme"
    assert decoded["EnableMiscue"] is True
    assert "RecognitionStatus" not in decoded


def test_http_401_and_403_are_credential_configuration_faults() -> None:
    for status in (401, 403):
        client = _client_returning(status, b"forbidden")
        with pytest.raises(azure_adapter.ProviderConfigurationError) as exc:
            _assess(client)
        assert str(exc.value) == "AZURE_CREDENTIALS_INVALID"


def test_http_429_is_rate_limited_retryable() -> None:
    client = _client_returning(429, b"throttled")
    with pytest.raises(azure_adapter.ProviderUnavailable) as exc:
        _assess(client)
    assert str(exc.value) == "AZURE_RATE_LIMIT"


def test_http_500_is_unavailable_retryable() -> None:
    client = _client_returning(500, b"boom")
    with pytest.raises(azure_adapter.ProviderUnavailable) as exc:
        _assess(client)
    assert str(exc.value) == "AZURE_UNAVAILABLE"


def test_http_400_is_provider_contract_fault() -> None:
    client = _client_returning(400, b"bad request")
    with pytest.raises(azure_adapter.ProviderConfigurationError) as exc:
        _assess(client)
    assert str(exc.value) == "PROVIDER_CONFIG_UNSUPPORTED"


def test_timeout_is_retryable_and_does_not_mask_as_learner_auth() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("fixture timeout", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(azure_adapter.ProviderUnavailable) as exc:
        _assess(client)
    assert str(exc.value) == "AZURE_TIMEOUT"


def test_missing_configuration_is_rejected_before_any_request() -> None:
    client = _client_returning(200, b"{}")
    with pytest.raises(azure_adapter.ProviderConfigurationError) as exc:
        azure_adapter.assess_utterance(
            b"wav",
            reference_text="good morning",
            endpoint="",
            key="",
            region="eastus",
            client=client,
        )
    assert str(exc.value) == "AZURE_CONFIG_MISSING"


def test_oversized_provider_response_is_rejected() -> None:
    client = _client_returning(
        200, bytes(azure_adapter.MAX_PROVIDER_RESPONSE_BYTES + 1)
    )
    with pytest.raises(scoring.ProviderResponseInvalid, match="size bound"):
        _assess(client)


def test_non_json_provider_response_is_rejected() -> None:
    client = _client_returning(200, b"<html>not json</html>")
    with pytest.raises(scoring.ProviderResponseInvalid, match="not JSON"):
        _assess(client)
