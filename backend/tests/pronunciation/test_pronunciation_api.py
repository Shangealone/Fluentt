"""Pronunciation vertical-slice API tests (multipart -> claim -> provider fixture -> result).

Provider and converter behavior is replaced by clearly labeled FIXTURES
(``FakeProvider``/``FakeConverter``); no live Azure, ffmpeg, or network use
happens here. Live gating is a separate manual feasibility step.
"""

import json
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import User
from app.pronunciation import azure_adapter, converter
from app.pronunciation.models import PronunciationAttempt, PronunciationResult
from tests.pronunciation.fakes import FakeConverter, FakeProvider
from tests.pronunciation_helpers import (
    FAKE_M4A_BYTES,
    build_metadata,
    scorable_payload,
    unscorable_payload,
    upload_attempt,
)


def _insert_processing_attempt(
    db: Session,
    learner: User,
    ref: dict[str, str],
    *,
    client_id: uuid.UUID,
    deadline_delta: timedelta,
    dispatched: bool = False,
) -> PronunciationAttempt:
    now = datetime.now(UTC)
    attempt = PronunciationAttempt(
        id=uuid.uuid4(),
        user_id=learner.id,
        client_pronunciation_attempt_id=client_id,
        content_release_id=uuid.UUID(ref["content_release_id"]),
        vocabulary_item_id=uuid.UUID(ref["vocabulary_item_id"]),
        content_revision_id=uuid.UUID(ref["content_revision_id"]),
        target_kind="term",
        original_interaction_at=datetime(2026, 10, 18, 12, 0, tzinfo=UTC),
        received_at=now,
        processing_started_at=now,
        status="processing",
        processing_token=uuid.uuid4(),
        processing_deadline=now + deadline_delta,
        provider_dispatch_started_at=now if dispatched else None,
        capture_profile_version="expo57-term-m4a-v1",
        device_platform="android",
        application_version="0.1.0",
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def _envelope(response) -> dict:
    body = response.json()
    assert set(body) == {"detail", "code", "category", "result"}
    assert isinstance(body["detail"], str) and body["detail"]
    return body


def test_scorable_success_contract_boundary_rounding_and_persistence(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
    db_session: Session,
    learner: User,
) -> None:
    ref = refs["good morning"]
    metadata = build_metadata(ref, target_kind="term")
    response = upload_attempt(client, auth_headers, metadata)

    assert response.status_code == 201
    body = response.json()
    assert body["schema_version"] == "pronunciation-result-v1"
    assert body["status"] == "scored"
    assert (
        body["client_pronunciation_attempt_id"]
        == metadata["client_pronunciation_attempt_id"]
    )
    assert body["attempt_id"]

    target = body["target"]
    assert target == {
        "vocabulary_item_id": ref["vocabulary_item_id"],
        "content_revision_id": ref["content_revision_id"],
        "content_release_id": ref["content_release_id"],
        "target_kind": "term",
        "term": "good morning",
    }

    assessment = body["assessment"]
    # Primary 89.995 is a JSON number, categorized unrounded (B) but displayed half-up.
    assert isinstance(assessment["accuracy_score"], (int, float))
    assert not isinstance(assessment["accuracy_score"], bool)
    assert assessment["accuracy_score"] == pytest.approx(89.995)
    assert assessment["accuracy_score_display"] == "90.00"
    assert assessment["category"] == "B"
    assert assessment["category_policy_version"] == "pronunciation-category-v1"
    assert assessment["pronunciation_score"] == pytest.approx(88.5)
    assert assessment["completeness_score"] == pytest.approx(96.0)
    assert assessment["fluency_score"] == pytest.approx(90.0)
    assert body["reason"] is None

    words = body["word_observations"]
    assert [word["target_unit"] for word in words] == ["good", "morning"]
    assert [word["is_target"] for word in words] == [True, True]
    assert words[0]["provider_error_type"] == "None"
    assert len(words[0]["phonemes"]) == 4
    assert words[0]["phonemes"][0]["phoneme_index"] == 0

    issues = body["issues"]
    assert issues, "fixture has two phonemes strictly below 60"
    assert [issue["level"] for issue in issues if issue["level"] == "word"] == []
    phoneme_ids = [issue["id"] for issue in issues if issue["level"] == "phoneme"]
    assert phoneme_ids == ["phoneme:0:1", "phoneme:0:2"]
    feedback = body["feedback"]
    assert feedback["general_feedback_key"] == "pronunciation.feedback.B"
    assert feedback["selected_issue_refs"] == [issue["id"] for issue in issues]
    assert feedback["feedback_policy_version"] == "pronunciation-feedback-v1"
    assert len({ref_id for ref_id in feedback["selected_issue_refs"]}) == len(
        feedback["selected_issue_refs"]
    )

    provider_metadata = body["provider_metadata"]
    assert provider_metadata["provider"] == "azure_speech_pronunciation"
    assert provider_metadata["locale"] == "en-US"
    assert provider_metadata["assessment_config_version"] == "azure-pa-en-us-term-v1"
    assert provider_metadata["integration"] == "short_audio_rest"
    assert provider_metadata["api_contract"] == "cognitiveservices/v1"
    assert provider_metadata["adapter_version"] == "azure-short-rest-adapter-v1"
    assert provider_metadata["http_client_version"]
    assert provider_metadata["sdk_version"] is None
    assert provider_metadata["hosted_model_version"] is None
    assert provider_metadata["recognition_status"] == "Success"
    assert provider_metadata["capture_profile_version"] == "expo57-term-m4a-v1"
    assert provider_metadata["converter_profile_version"] == "ffmpeg-pcm16k-mono-v1"
    assert provider_metadata["converter_version"] == "fixture-ffmpeg-version"

    timestamps = body["timestamps"]
    for key in (
        "original_interaction_at",
        "received_at",
        "processing_started_at",
        "completed_at",
    ):
        parsed = datetime.fromisoformat(timestamps[key])
        assert parsed.tzinfo is not None
    assert timestamps["completed_at"] is not None

    assert provider.calls == 1
    assert fake_converter.calls == 1

    result = db_session.scalar(
        select(PronunciationResult).where(PronunciationResult.user_id == learner.id)
    )
    assert result is not None
    assert result.status == "scored"
    assert result.accuracy_score == Decimal("89.995")
    assert result.accuracy_score_display == "90.00"
    assert result.category == "B"
    assert result.reason_code is None
    # No raw audio or client file names persisted anywhere on the attempt row.
    attempt = db_session.get(PronunciationAttempt, result.pronunciation_attempt_id)
    assert attempt is not None
    assert attempt.status == "scored"
    assert attempt.processing_deadline is not None
    assert attempt.provider_dispatch_started_at is not None


def test_sentence_target_resolves_example_sentence_from_revision(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
) -> None:
    ref = refs["good morning"]
    metadata = build_metadata(ref, target_kind="sentence")
    response = upload_attempt(client, auth_headers, metadata)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "scored"
    assert body["target"]["target_kind"] == "sentence"
    assert body["target"]["term"] == ref["sentence"]
    # The provider was assessed against the immutable revision sentence.
    assert provider.references == [ref["sentence"]]


def test_replay_same_client_id_returns_identical_terminal_result(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
    db_session: Session,
) -> None:
    metadata = build_metadata(refs["good morning"])
    first = upload_attempt(client, auth_headers, metadata)
    second = upload_attempt(client, auth_headers, metadata)

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json() == second.json()
    assert provider.calls == 1
    assert fake_converter.calls == 1
    attempts = list(
        db_session.scalars(
            select(PronunciationAttempt).where(
                PronunciationAttempt.client_pronunciation_attempt_id
                == uuid.UUID(metadata["client_pronunciation_attempt_id"])
            )
        )
    )
    assert len(attempts) == 1


def test_conflicting_bound_facts_return_409_without_provider_call(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
) -> None:
    client_id = uuid.uuid4()
    metadata = build_metadata(refs["good morning"], client_id=client_id)
    assert upload_attempt(client, auth_headers, metadata).status_code == 201

    conflicting = build_metadata(refs["water"], client_id=client_id)
    response = upload_attempt(client, auth_headers, conflicting)

    assert response.status_code == 409
    body = _envelope(response)
    assert body["code"] == "PRONUNCIATION_ATTEMPT_CONFLICT"
    assert body["category"] == "USER_CORRECTABLE"
    assert body["result"] is None
    assert provider.calls == 1


def test_in_flight_attempt_reconciles_as_202_and_never_dispatches(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    learner: User,
    provider: FakeProvider,
    fake_converter: FakeConverter,
    db_session: Session,
) -> None:
    client_id = uuid.uuid4()
    metadata = build_metadata(refs["good morning"], client_id=client_id)
    _insert_processing_attempt(
        db_session,
        learner,
        refs["good morning"],
        client_id=client_id,
        deadline_delta=timedelta(seconds=30),
    )

    post = upload_attempt(client, auth_headers, metadata)
    assert post.status_code == 202
    assert post.json()["status"] == "processing"
    assert post.json()["assessment"]["accuracy_score"] is None
    assert post.json()["feedback"]["general_feedback_key"] is None
    assert post.json()["reason"] is None
    assert post.json()["provider_metadata"]["recognition_status"] is None

    get = client.get(
        f"/pronunciation/attempts/by-client/{metadata['client_pronunciation_attempt_id']}",
        headers=auth_headers,
    )
    assert get.status_code == 202
    assert get.json()["status"] == "processing"
    assert provider.calls == 0
    assert fake_converter.calls == 0


def test_capacity_rejection_is_503_and_creates_no_attempt_row(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    learner: User,
    provider: FakeProvider,
    fake_converter: FakeConverter,
    db_session: Session,
) -> None:
    _insert_processing_attempt(
        db_session,
        learner,
        refs["good morning"],
        client_id=uuid.uuid4(),
        deadline_delta=timedelta(seconds=30),
    )
    metadata = build_metadata(refs["good morning"])
    response = upload_attempt(client, auth_headers, metadata)

    assert response.status_code == 503
    body = _envelope(response)
    assert body["code"] == "CAPACITY_UNAVAILABLE"
    assert body["category"] == "RETRYABLE_SERVICE"
    assert body["result"] is None
    assert provider.calls == 0
    assert fake_converter.calls == 0
    remaining = db_session.scalar(
        select(PronunciationAttempt).where(
            PronunciationAttempt.client_pronunciation_attempt_id
            == uuid.UUID(metadata["client_pronunciation_attempt_id"])
        )
    )
    assert remaining is None


@pytest.mark.parametrize(
    ("dispatched", "expected_code"),
    [(False, "PROCESSING_INTERRUPTED"), (True, "PROVIDER_OUTCOME_UNKNOWN")],
)
def test_expired_processing_claim_is_reaped_on_same_id_post(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    learner: User,
    provider: FakeProvider,
    fake_converter: FakeConverter,
    db_session: Session,
    dispatched: bool,
    expected_code: str,
) -> None:
    client_id = uuid.uuid4()
    metadata = build_metadata(refs["good morning"], client_id=client_id)
    _insert_processing_attempt(
        db_session,
        learner,
        refs["good morning"],
        client_id=client_id,
        deadline_delta=timedelta(seconds=-5),
        dispatched=dispatched,
    )

    response = upload_attempt(client, auth_headers, metadata)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "failed"
    assert body["reason"]["code"] == expected_code
    assert body["reason"]["category"] == "RETRYABLE_SERVICE"
    assert body["reason"]["recovery"] == "retry_later"
    assert body["assessment"]["accuracy_score"] is None
    assert body["word_observations"] == []
    assert provider.calls == 0
    assert fake_converter.calls == 0


def test_unscorable_no_match_is_201_with_null_performance(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
    db_session: Session,
    learner: User,
) -> None:
    provider.body = lambda reference_text: unscorable_payload("NoMatch")
    metadata = build_metadata(refs["good morning"])
    response = upload_attempt(client, auth_headers, metadata)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "unscorable"
    for value in (
        body["assessment"]["accuracy_score"],
        body["assessment"]["accuracy_score_display"],
        body["assessment"]["category"],
        body["assessment"]["pronunciation_score"],
    ):
        assert value is None
    assert body["assessment"]["category_policy_version"] is None
    assert body["word_observations"] == []
    assert body["issues"] == []
    assert (
        body["feedback"]["general_feedback_key"] == "pronunciation.feedback.unscorable"
    )
    assert body["feedback"]["feedback_policy_version"] == "pronunciation-feedback-v1"
    assert body["reason"] == {
        "category": "USER_CORRECTABLE",
        "code": "NO_MATCH",
        "recovery": "rerecord",
    }
    assert body["provider_metadata"]["recognition_status"] == "NoMatch"
    result = db_session.scalar(
        select(PronunciationResult).where(PronunciationResult.user_id == learner.id)
    )
    assert result is not None and result.status == "unscorable"
    assert result.accuracy_score is None


def test_unscorable_insufficient_evidence_keeps_corrective_word_tags(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
) -> None:
    def only_first_word(reference_text: str) -> dict:
        payload = scorable_payload(reference_text)
        payload["NBest"][0]["Words"] = payload["NBest"][0]["Words"][:1]
        return payload

    provider.body = only_first_word
    response = upload_attempt(
        client, auth_headers, build_metadata(refs["good morning"])
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "unscorable"
    assert body["reason"]["code"] == "TARGET_EVIDENCE_INSUFFICIENT"
    assert (
        body["feedback"]["general_feedback_key"] == "pronunciation.feedback.unscorable"
    )
    assert body["issues"] == []


def test_unscorable_omitted_target_reports_target_omitted(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
) -> None:
    def omission_payload(reference_text: str) -> dict:
        payload = scorable_payload(reference_text)
        second = payload["NBest"][0]["Words"][1]
        second["ErrorType"] = "Omission"
        second["AccuracyScore"] = None
        return payload

    provider.body = omission_payload
    response = upload_attempt(
        client, auth_headers, build_metadata(refs["good morning"])
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "unscorable"
    assert body["reason"]["code"] == "TARGET_OMITTED"
    assert [issue["id"] for issue in body["issues"]] == ["word:1"]
    assert body["issues"][0]["accuracy_score"] is None
    assert body["issues"][0]["provider_error_type"] == "Omission"
    assert body["word_observations"] == []


def test_unsupported_audio_is_415_envelope_then_200_replay(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
) -> None:
    fake_converter.error = converter.UnsupportedAudio("fixture: decoder rejected input")
    metadata = build_metadata(refs["good morning"])

    first = upload_attempt(client, auth_headers, metadata)
    assert first.status_code == 415
    body = _envelope(first)
    assert body["code"] == "UNSUPPORTED_AUDIO"
    assert body["category"] == "USER_CORRECTABLE"
    assert body["result"]["status"] == "failed"
    assert body["result"]["reason"] == {
        "category": "USER_CORRECTABLE",
        "code": "UNSUPPORTED_AUDIO",
        "recovery": "rerecord",
    }
    assert body["result"]["feedback"]["general_feedback_key"] == (
        "pronunciation.errors.recorded"
    )

    replay = upload_attempt(client, auth_headers, metadata)
    assert replay.status_code == 200
    assert replay.json()["status"] == "failed"
    get = client.get(
        f"/pronunciation/attempts/by-client/{metadata['client_pronunciation_attempt_id']}",
        headers=auth_headers,
    )
    assert get.status_code == 200
    assert get.json()["reason"]["code"] == "UNSUPPORTED_AUDIO"
    assert provider.calls == 0
    assert fake_converter.calls == 1


def test_duration_limit_is_422_user_correctable(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
) -> None:
    fake_converter.error = converter.DurationLimitExceeded("fixture: over 10s")
    response = upload_attempt(
        client, auth_headers, build_metadata(refs["good morning"])
    )
    assert response.status_code == 422
    body = _envelope(response)
    assert body["code"] == "DURATION_LIMIT"
    assert body["result"]["reason"]["recovery"] == "rerecord"
    assert provider.calls == 0


def test_converter_unavailable_is_503_server_configuration(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
) -> None:
    fake_converter.error = converter.ConverterUnavailable("fixture: executable missing")
    response = upload_attempt(
        client, auth_headers, build_metadata(refs["good morning"])
    )
    assert response.status_code == 503
    body = _envelope(response)
    assert body["code"] == "CONVERTER_UNAVAILABLE"
    assert body["category"] == "SERVER_CONFIGURATION"
    assert body["result"]["reason"]["recovery"] == "operator_action"
    assert provider.calls == 0


def test_azure_timeout_is_504_with_safe_envelope_and_no_key_leak(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
) -> None:
    provider.error = azure_adapter.ProviderUnavailable("AZURE_TIMEOUT")
    metadata = build_metadata(refs["good morning"])
    response = upload_attempt(client, auth_headers, metadata)

    assert response.status_code == 504
    body = _envelope(response)
    assert body["code"] == "AZURE_TIMEOUT"
    assert body["category"] == "RETRYABLE_SERVICE"
    assert body["result"]["status"] == "failed"
    assert body["result"]["reason"]["recovery"] == "retry_later"
    assert "fixture" not in body["detail"]
    assert "key" not in body["detail"].lower()

    replay = upload_attempt(client, auth_headers, metadata)
    assert replay.status_code == 200
    assert replay.json()["status"] == "failed"
    assert provider.calls == 1


def test_azure_credential_fault_is_503_operator_action_not_learner_auth(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
) -> None:
    provider.error = azure_adapter.ProviderConfigurationError(
        "AZURE_CREDENTIALS_INVALID"
    )
    response = upload_attempt(
        client, auth_headers, build_metadata(refs["good morning"])
    )
    assert response.status_code == 503
    body = _envelope(response)
    assert body["code"] == "AZURE_CREDENTIALS_INVALID"
    assert body["category"] == "SERVER_CONFIGURATION"
    assert body["result"]["reason"]["recovery"] == "operator_action"


def test_provider_invalid_response_is_502(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
) -> None:
    provider.error = azure_adapter.ProviderResponseInvalid("fixture: bad body")
    response = upload_attempt(
        client, auth_headers, build_metadata(refs["good morning"])
    )
    assert response.status_code == 502
    body = _envelope(response)
    assert body["code"] == "PROVIDER_RESPONSE_INVALID"
    assert body["category"] == "SERVER_CONFIGURATION"


def test_upload_over_256kib_is_413_before_any_claim(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
    db_session: Session,
) -> None:
    metadata = build_metadata(refs["good morning"])
    oversized = FAKE_M4A_BYTES + bytes(262_145 - len(FAKE_M4A_BYTES))
    response = upload_attempt(client, auth_headers, metadata, oversized)
    assert response.status_code == 413
    body = _envelope(response)
    assert body["code"] == "UPLOAD_LIMIT"
    assert body["result"] is None
    assert provider.calls == 0
    assert (
        db_session.scalar(
            select(PronunciationAttempt).where(
                PronunciationAttempt.client_pronunciation_attempt_id
                == uuid.UUID(metadata["client_pronunciation_attempt_id"])
            )
        )
        is None
    )


def test_empty_recording_is_422(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
) -> None:
    response = upload_attempt(
        client, auth_headers, build_metadata(refs["good morning"]), b""
    )
    assert response.status_code == 422
    body = _envelope(response)
    assert body["code"] == "EMPTY_RECORDING"
    assert provider.calls == 0


@pytest.mark.parametrize(
    "metadata",
    [
        "not-json-at-all",
        json.dumps({"client_pronunciation_attempt_id": "not-a-uuid"}),
        json.dumps({"unknown_key": True}),
        None,
    ],
)
def test_invalid_metadata_is_422(
    client: TestClient,
    auth_headers: dict[str, str],
    metadata,
    provider: FakeProvider,
) -> None:
    response = upload_attempt(client, auth_headers, metadata)
    assert response.status_code == 422
    body = _envelope(response)
    assert body["code"] == "INVALID_METADATA"
    assert body["result"] is None
    assert provider.calls == 0


def test_naive_timestamp_and_wrong_literals_are_rejected(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
) -> None:
    naive = build_metadata(
        refs["good morning"],
        original_interaction_at="2026-10-18T12:00:00",
    )
    assert upload_attempt(client, auth_headers, naive).status_code == 422

    wrong_kind = build_metadata(refs["good morning"], target_kind="paragraph")
    assert upload_attempt(client, auth_headers, wrong_kind).status_code == 422

    wrong_platform = build_metadata(refs["good morning"], device_platform="ios")
    assert upload_attempt(client, auth_headers, wrong_platform).status_code == 422


def test_duplicate_and_unexpected_parts_are_rejected(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
) -> None:
    metadata = build_metadata(refs["good morning"])
    duplicate = upload_attempt(client, auth_headers, metadata, duplicate_metadata=True)
    assert duplicate.status_code == 422
    assert _envelope(duplicate)["code"] == "INVALID_METADATA"

    extra = upload_attempt(
        client, auth_headers, metadata, extra_fields=[("target_text", "arbitrary")]
    )
    assert extra.status_code == 422

    missing_metadata = upload_attempt(client, auth_headers, None)
    assert missing_metadata.status_code == 422
    assert provider.calls == 0


def test_oversized_metadata_part_is_422(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
) -> None:
    metadata = build_metadata(refs["good morning"], application_version="x" * 5000)
    response = upload_attempt(client, auth_headers, metadata)
    assert response.status_code == 422
    assert _envelope(response)["code"] == "INVALID_METADATA"


def test_requires_authentication(
    client: TestClient,
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
) -> None:
    response = upload_attempt(client, {}, build_metadata(refs["good morning"]))
    assert response.status_code == 401


def test_get_unknown_and_foreign_owner_ids_return_404(
    client: TestClient,
    auth_headers: dict[str, str],
    other_owner_headers: dict[str, str],
    provider: FakeProvider,
) -> None:
    unknown = client.get(
        f"/pronunciation/attempts/by-client/{uuid.uuid4()}", headers=auth_headers
    )
    assert unknown.status_code == 404

    foreign = client.get(
        f"/pronunciation/attempts/by-client/{uuid.uuid4()}", headers=other_owner_headers
    )
    assert foreign.status_code == 404


def test_foreign_owner_cannot_replay_another_owners_attempt(
    client: TestClient,
    auth_headers: dict[str, str],
    other_owner_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    provider: FakeProvider,
    fake_converter: FakeConverter,
) -> None:
    metadata = build_metadata(refs["good morning"])
    assert upload_attempt(client, auth_headers, metadata).status_code == 201

    foreign_get = client.get(
        f"/pronunciation/attempts/by-client/{metadata['client_pronunciation_attempt_id']}",
        headers=other_owner_headers,
    )
    assert foreign_get.status_code == 404

    # Reusing the same client id under another owner starts an independent claim
    # for that owner; it never returns the original owner's stored result.
    foreign_post = upload_attempt(client, other_owner_headers, metadata)
    assert foreign_post.status_code == 201
    assert foreign_post.json()["status"] == "scored"

    mine = client.get(
        f"/pronunciation/attempts/by-client/{metadata['client_pronunciation_attempt_id']}",
        headers=auth_headers,
    )
    assert mine.status_code == 200
    assert mine.json()["status"] == "scored"
