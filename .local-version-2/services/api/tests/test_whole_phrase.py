"""Synthetic transport fixtures, not live Azure assessment or human validity evidence."""

import base64
import io
import json
import wave
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.modules.identity.errors import IdentityError
from app.modules.pronunciation import whole_phrase as scoring


def configured(**changes):
    return Settings(
        _env_file=None,
        **{
            "pronunciation_azure_enabled": True,
            "pronunciation_azure_resource": "synthetic-resource",
            "pronunciation_azure_key": "SYNTHETIC-NOT-A-REAL-KEY",
            "pronunciation_cloud_authorization_reference": "SYNTHETIC-QA-NOT-APPROVAL",
            **changes,
        },
    )


def wav(frames=16000, channels=1, width=2, rate=16000):
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as target:
        target.setnchannels(channels)
        target.setsampwidth(width)
        target.setframerate(rate)
        target.writeframes(b"\x01\x00" * (frames * channels * width // 2))
    return buffer.getvalue()


def response(**changes):
    return {
        "RecognitionStatus": "Success",
        "NBest": [
            {
                "PronScore": 37.5,
                "AccuracyScore": 91,
                "FluencyScore": 82,
                "CompletenessScore": 75,
                **changes,
            }
        ],
    }


def test_default_off_english_only_and_deployment_authorization_gates():
    assert scoring.capability(Settings(_env_file=None), "english").reason == "disabled"
    assert scoring.capability(configured(pronunciation_azure_key=None), "english").reason == "not_configured"
    assert (
        scoring.capability(configured(pronunciation_cloud_authorization_reference=None), "english").reason
        == "authorization_missing"
    )
    assert scoring.capability(configured(), "tagalog").reason == "language_unsupported"
    assert scoring.capability(configured(), "english").available
    # The synthetic configured state is not an actual cloud connection or institutional approval.
    assert "SYNTHETIC" not in scoring.capability(configured(), "english").model_dump_json()


@pytest.mark.parametrize("resource", ["http://localhost", "foo.example", "bad/name", "foo\nHost:x", "-bad"])
def test_azure_resource_is_not_an_arbitrary_url(resource):
    with pytest.raises(ValidationError):
        configured(pronunciation_azure_resource=resource)


@pytest.mark.parametrize(
    "audio",
    [
        wav(7999),
        wav(480001),
        wav(channels=2),
        wav(width=1),
        wav(rate=8000),
        wav()[:-2],
        b"RIFF junk",
        b"x" * (scoring.MAX_BYTES + 1),
    ],
    ids=["too-short", "too-long", "stereo", "wrong-width", "wrong-rate", "truncated", "invalid", "oversized"],
)
def test_audio_validation_checks_actual_format_length_and_duration(audio):
    with pytest.raises(IdentityError) as error:
        scoring.validate_wav(audio)
    assert error.value.code == "whole_phrase_audio_invalid"


def test_zero_signal_is_not_a_perfect_pronunciation_score():
    audio = bytearray(wav())
    audio[44:] = bytes(len(audio) - 44)
    with pytest.raises(IdentityError) as error:
        scoring.validate_wav(bytes(audio))
    assert error.value.code == "whole_phrase_no_speech"
    assert scoring.validate_wav(wav()) == 1000


def test_transport_sends_one_complete_clip_and_returns_provider_overall_not_word_average():
    calls = []

    def handler(request):
        calls.append(request)
        assert request.url.host == "synthetic-resource.cognitiveservices.azure.com"
        assert request.url.scheme == "https" and request.url.params["language"] == "en-US"
        assert request.content == wav()
        params = json.loads(base64.b64decode(request.headers["Pronunciation-Assessment"]))
        assert params == {
            "ReferenceText": "I like eating pizza.",
            "GradingSystem": "HundredMark",
            "Granularity": "FullText",
            "Dimension": "Comprehensive",
            "EnableMiscue": "True",
        }
        return httpx.Response(200, json=response(Words=[{"AccuracyScore": 100}, {"AccuracyScore": 100}]))

    result = scoring.assess_with_azure(
        configured(), wav(), "I like eating pizza.", transport=httpx.MockTransport(handler)
    )
    assert result["overall_score"] == 37.5 and len(calls) == 1


@pytest.mark.parametrize("score", [None, True, float("nan"), float("inf"), -1, 101, "98"])
def test_missing_invalid_or_unbounded_provider_score_never_becomes_a_grade(score):
    # Encode ourselves to include nonfinite numbers for defensive parsing tests.
    transport = httpx.MockTransport(lambda _: httpx.Response(200, content=json.dumps(response(PronScore=score))))
    with pytest.raises(IdentityError) as error:
        scoring.assess_with_azure(configured(), wav(), "Whole target", transport=transport)
    assert error.value.status == 502


def test_provider_failure_and_redirect_are_not_retried_or_leaked():
    for status in (302, 401, 429, 500):
        calls = []

        def handler(request):
            calls.append(request)
            return httpx.Response(
                status, headers={"Location": "https://untrusted.invalid"}, text="SYNTHETIC-PRIVATE-PROVIDER-ERROR"
            )

        with pytest.raises(IdentityError) as error:
            scoring.assess_with_azure(configured(), wav(), "Whole target", transport=httpx.MockTransport(handler))
        assert len(calls) == 1 and error.value.status == 503
        assert "SYNTHETIC" not in error.value.message


def test_service_uses_pinned_reference_once_and_does_not_write_learning_records(monkeypatch):
    activity = SimpleNamespace(id=uuid4(), version=3, target_text="I like eating pizza.", language="english")
    db = MagicMock()
    db.scalar.return_value = activity
    user = SimpleNamespace(role="personal_student", profile_status="active")
    calls = []

    def provider(settings, audio, reference):
        calls.append((audio, reference))
        return {"overall_score": 37.5, "accuracy_score": 91, "fluency_score": 82, "completeness_score": 75}

    monkeypatch.setattr(scoring, "assess_with_azure", provider)
    value = scoring.assess_whole_phrase(db, user, configured(), activity.id, 3, wav(), scoring.CONSENT_VERSION)
    assert value.overall_score == 37.5 and value.simulated is False
    assert calls == [(wav(), activity.target_text)]
    db.add.assert_not_called()
    db.flush.assert_not_called()
    for consent, version, expected in [("", 3, 403), (scoring.CONSENT_VERSION, 2, 409)]:
        with pytest.raises(IdentityError) as error:
            scoring.assess_whole_phrase(db, user, configured(), activity.id, version, wav(), consent)
        assert error.value.status == expected
    assert len(calls) == 1
    activity.language = "tagalog"
    with pytest.raises(IdentityError):
        scoring.assess_whole_phrase(db, user, configured(), activity.id, 3, wav(), scoring.CONSENT_VERSION)
    for role in ("school_student", "instructor"):
        with pytest.raises(IdentityError):
            scoring.require_personal(SimpleNamespace(role=role, profile_status="active"))
    assert len(calls) == 1
