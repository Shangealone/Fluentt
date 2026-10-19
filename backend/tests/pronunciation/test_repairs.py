import json
import threading
from concurrent.futures import ThreadPoolExecutor
from decimal import ROUND_DOWN, Decimal, localcontext

import httpx
import pytest
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.auth.models import User
from app.pronunciation import azure_adapter, service
from app.pronunciation.models import PronunciationResult
from app.pronunciation.schemas import PronunciationAttemptMetadata
from tests.pronunciation_helpers import build_metadata, scorable_payload, upload_attempt


def test_presentation_does_not_inherit_or_mutate_caller_decimal_context():
    with localcontext() as context:
        context.prec = 2
        context.rounding = ROUND_DOWN
        flags = context.flags.copy()
        assert service.scoring.display_score(Decimal("89.995")) == "90.00"
        assert context.flags == flags


def test_rejected_provider_score_does_not_pollute_caller_context():
    with localcontext() as context:
        context.clear_flags()
        before = context.flags.copy()
        with pytest.raises(service.scoring.PrimaryInvalid):
            service.scoring.parse_primary("not-a-score")
        with pytest.raises(service.scoring.ProviderResponseInvalid):
            service.scoring.parse_word_observations(
                [{"Word": "water", "AccuracyScore": "invalid"}]
            )
        assert context.flags == before


def test_provider_json_keeps_raw_decimal_below_boundary():
    body = b'{"RecognitionStatus":"Success","NBest":[{"AccuracyScore":89.999999999999999,"Words":[]}]}'
    with httpx.Client(
        transport=httpx.MockTransport(lambda r: httpx.Response(200, content=body))
    ) as client:
        outcome = azure_adapter.assess_utterance(
            b"wav",
            reference_text="water",
            endpoint="https://example.test",
            key="fixture",
            region="test",
            client=client,
        )
    assert outcome.accuracy_score == Decimal("89.999999999999999")


def test_decimal_survives_database_http_and_replay(
    client, auth_headers, refs, provider, fake_converter, db_session
):
    def precise(reference_text):
        body = scorable_payload(reference_text)
        body["NBest"][0]["AccuracyScore"] = "89.999999999999999"
        return body

    provider.body = precise
    metadata = build_metadata(refs["water"])
    first = upload_attempt(client, auth_headers, metadata)
    assert first.status_code == 201
    body = json.loads(first.content, parse_float=Decimal)
    assert body["assessment"]["accuracy_score"] == Decimal("89.999999999999999")
    assert body["assessment"]["category"] == "B"
    row = db_session.scalar(select(PronunciationResult))
    assert row.accuracy_score == Decimal("89.999999999999999")
    replay = upload_attempt(client, auth_headers, metadata)
    assert json.loads(replay.content, parse_float=Decimal) == body


def test_missing_kind_and_invalid_target_have_safe_envelopes(
    client, auth_headers, refs
):
    metadata = build_metadata(refs["water"])
    del metadata["target_kind"]
    response = upload_attempt(client, auth_headers, metadata)
    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_METADATA"
    metadata["target_kind"] = "term"
    metadata["content_revision_id"] = "00000000-0000-0000-0000-000000000000"
    response = upload_attempt(client, auth_headers, metadata)
    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_TARGET"
    assert response.json()["result"] is None


def test_optional_invalid_score_is_provider_fault():
    payload = scorable_payload("water")
    payload["NBest"][0]["FluencyScore"] = True
    with pytest.raises(service.scoring.ProviderResponseInvalid):
        azure_adapter.parse_provider_payload(payload)


def test_migration_load_upgrade_and_precision_repair(db_session):
    scripts = ScriptDirectory.from_config(Config("alembic.ini"))
    initial = scripts.get_revision("p04c0de000001").module
    repair = scripts.get_revision("p05c0de000001").module
    connection = db_session.connection()
    savepoint = connection.begin_nested()
    try:
        with Operations.context(MigrationContext.configure(connection)):
            initial.downgrade()
            initial.upgrade()
            repair.upgrade()
        columns = {
            c["name"]: c
            for c in inspect(connection).get_columns("pronunciation_results")
        }
        assert columns["accuracy_score"]["type"].scale is None
    finally:
        savepoint.rollback()
        db_session.rollback()


def test_concurrent_claims_allow_one_owner_in_flight(db_session, learner, refs):
    bind = db_session.get_bind()
    owner = learner.id
    barrier = threading.Barrier(2)

    def claim():
        with Session(bind) as db:
            user = db.get(User, owner)
            metadata = PronunciationAttemptMetadata.model_validate(
                build_metadata(refs["water"])
            )
            barrier.wait(timeout=5)
            return service.claim_attempt(db, user, metadata).kind

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: claim(), range(2)))
    assert sorted(results) == ["capacity", "new"]


def test_overlapping_replay_never_dispatches_twice(
    client, auth_headers, refs, provider, fake_converter, monkeypatch
):
    entered, release = threading.Event(), threading.Event()
    calls = []

    def blocked_provider(*args, **kwargs):
        calls.append(1)
        entered.set()
        assert release.wait(timeout=10)
        return provider(*args, **kwargs)

    monkeypatch.setattr(azure_adapter, "assess_utterance", blocked_provider)
    metadata = build_metadata(refs["water"])
    with ThreadPoolExecutor(max_workers=1) as pool:
        pending = pool.submit(upload_attempt, client, auth_headers, metadata)
        try:
            assert entered.wait(timeout=5)
            overlapping = upload_attempt(client, auth_headers, metadata)
            assert overlapping.status_code == 202
        finally:
            release.set()
        assert pending.result(timeout=10).status_code == 201
    assert len(calls) == 1
