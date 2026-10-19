"""D11E research acceptance integration through real PostgreSQL and API paths."""

import copy
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from decimal import Decimal, Rounded, getcontext, localcontext
from threading import Event

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import event, select, text
from sqlalchemy.orm import sessionmaker

from app.auth.models import User
from app.auth.security import create_access_token
from app.core.config import get_settings
from app.research_logging.models import ResearchEvent
from app.reviews import acceptance, service
from app.reviews.models import (
    CurrentReviewSchedule,
    ReviewAttempt,
    ReviewSchedule,
    ReviewSession,
)
from app.reviews.schemas import ReviewAttemptCreate
from app.scheduling import fsrs6
from app.scheduling.fsrs6 import EnhancedFsrsScheduler, FsrsReconstructionContext
from app.scheduling.research_contracts import (
    ResearchSchedulerInput,
    validate_research_result,
)
from app.scheduling.sm2 import BinarySm2Scheduler
from app.sync.models import AcceptedClientEvent
from app.sync.service import sync_review_events
from tests.content.test_provenance import attempt
from tests.reviews.test_d11b_persistence import graph
from tests.reviews.test_due_review import eligible
from tests.reviews.test_research_contracts import f2_context_snapshot

TESTING_NOW = datetime.now(UTC).replace(microsecond=0)


def f1_evidence_snapshot(db):
    """Compare complete durable rows, including an existing current pointer."""
    db.expire_all()
    return [
        [
            dict(row)
            for row in db.execute(
                select(model.__table__).order_by(*model.__table__.primary_key.columns)
            ).mappings()
        ]
        for model in (
            ReviewAttempt,
            ReviewSchedule,
            AcceptedClientEvent,
            CurrentReviewSchedule,
            ResearchEvent,
        )
    ]


def setup_authority(
    db_session,
    client,
    *,
    mapping_group=1,
    mode="test",
    complete=True,
    memberships=True,
    participant_code="P_D7",
    email="due@example.test",
):
    frozen_at = TESTING_NOW - timedelta(days=30)
    owner, detail, protocol, sets, allocation, conditions = graph(
        db_session,
        client,
        mapping_group=mapping_group,
        mode=mode,
        clock_policy_version="test-no-future-v1",
        frozen_at=frozen_at,
        with_conditions=complete,
        memberships=memberships,
        participant_code=participant_code,
        email=email,
    )
    headers = {"Authorization": f"Bearer {create_access_token(str(owner))}"}
    return owner, detail, protocol, sets, allocation, conditions, headers


def request_for(word, interaction_at, *, correct=True, client_event_id=None):
    return {
        **attempt(word),
        "client_event_id": str(client_event_id or uuid.uuid4()),
        "client_interaction_at": interaction_at.isoformat(),
        "correct": correct,
    }


def evidence_counts(db):
    db.expire_all()
    return tuple(
        db.query(model).count()
        for model in (
            ReviewAttempt,
            ReviewSchedule,
            AcceptedClientEvent,
            CurrentReviewSchedule,
            ResearchEvent,
        )
    )


def test_test_authority_conventional_acceptance_uses_assigned_sm2_and_persists_chain(
    db_session, client
):
    owner, detail, _, sets, _, conditions, headers = setup_authority(
        db_session, client, mapping_group=2
    )
    condition = next(row for row in conditions if row.research_set_id == sets[0].id)
    item = detail["vocabulary_items"][0]

    response = client.post(
        "/reviews/attempts",
        headers=headers,
        json=request_for(item, TESTING_NOW - timedelta(days=3), correct=True),
    )

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["scheduler_type"] == "conventional_srs"
    assert result["algorithm_version"] == "sm2-binary-v1"
    assert result["next_interval_seconds"] == 86400
    assert result["scheduler_state"] == {
        "schema_version": 1,
        "scheduler_type": "conventional_srs",
        "algorithm_version": "sm2-binary-v1",
        "config_version": "sm2-binary-config-v1",
        "memory": {
            "repetition_count": 1,
            "ease_factor": 2.5,
            "interval_days": 1,
            "lapse_count": 0,
        },
    }
    accepted = db_session.query(ReviewAttempt).one()
    schedule = db_session.query(ReviewSchedule).one()
    assert accepted.user_id == owner
    assert accepted.research_assignment_id == condition.id
    assert schedule.attempt_id == accepted.id
    pointer = db_session.get(
        CurrentReviewSchedule,
        (owner, uuid.UUID(item["id"])),
    )
    assert pointer.schedule_id == schedule.id
    research_events = (
        db_session.query(ResearchEvent)
        .filter_by(review_attempt_id=accepted.id)
        .order_by(ResearchEvent.event_type)
        .all()
    )
    assert [row.event_type for row in research_events] == [
        "REVIEW_ANSWERED",
        "REVIEW_SCHEDULED",
    ]
    assert all(
        row.payload == {"scope": "item_attempt"}
        and row.schema_version == "review-events-1"
        for row in research_events
    )
    ledger = db_session.query(AcceptedClientEvent).one()
    assert ledger.attempt_id == accepted.id
    assert evidence_counts(db_session) == (1, 1, 1, 1, 2)


def test_test_authority_enhanced_acceptance_uses_assigned_fsrs(
    db_session, client
):
    _, detail, _, sets, _, conditions, headers = setup_authority(db_session, client)
    condition = next(row for row in conditions if row.research_set_id == sets[0].id)
    item = detail["vocabulary_items"][0]

    response = client.post(
        "/reviews/attempts",
        headers=headers,
        json=request_for(item, TESTING_NOW - timedelta(days=3), correct=True),
    )

    assert response.status_code == 200, response.text
    result = response.json()
    assert (result["scheduler_type"], result["algorithm_version"]) == (
        "enhanced_srs",
        "fluentt-esr-fsrs6-binary-v1",
    )
    assert result["next_interval_seconds"] == 2 * 86400
    assert result["scheduler_state"]["memory"]["state"] == "Review"
    assert result["scheduler_state"]["memory"] == {
        "state": "Review",
        "step": None,
        "stability": 2.3065,
        "difficulty": 2.118103970459016,
    }
    accepted = db_session.query(ReviewAttempt).one()
    assert accepted.research_assignment_id == condition.id
    assert evidence_counts(db_session) == (1, 1, 1, 1, 2)


def test_formal_authority_stays_closed_without_writes(db_session, client):
    _, detail, _, _, _, _, headers = setup_authority(
        db_session, client, mode="formal", complete=False
    )
    before = evidence_counts(db_session)

    response = client.post(
        "/reviews/attempts",
        headers=headers,
        json=request_for(
            detail["vocabulary_items"][0], TESTING_NOW - timedelta(days=3)
        ),
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "D11_ROUTING_DISABLED"
    assert evidence_counts(db_session) == before == (0, 0, 0, 0, 0)


def test_conventional_subsequent_correct_uses_authoritative_predecessor(
    db_session, client
):
    _, detail, _, sets, _, conditions, headers = setup_authority(
        db_session, client, mapping_group=2
    )
    item = detail["vocabulary_items"][0]
    condition = next(row for row in conditions if row.research_set_id == sets[0].id)
    first_at = TESTING_NOW - timedelta(days=10)
    first = client.post(
        "/reviews/attempts",
        headers=headers,
        json=request_for(item, first_at, correct=True),
    )
    assert first.status_code == 200, first.text
    assert first.json()["next_interval_seconds"] == 86400

    second = client.post(
        "/reviews/attempts",
        headers=headers,
        json=request_for(item, first_at + timedelta(days=2), correct=True),
    )

    assert second.status_code == 200, second.text
    assert second.json()["scheduler_type"] == "conventional_srs"
    assert second.json()["next_interval_seconds"] == 6 * 86400
    attempts = db_session.query(ReviewAttempt).order_by(ReviewAttempt.client_interaction_at).all()
    assert len(attempts) == 2
    assert all(row.research_assignment_id == condition.id for row in attempts)
    assert db_session.query(ReviewSchedule).count() == 2
    assert evidence_counts(db_session) == (2, 2, 2, 1, 4)


@pytest.mark.parametrize(
    ("mapping_group", "expected_type", "expected_algorithm", "expected_memory"),
    [
        (
            2,
            "conventional_srs",
            "sm2-binary-v1",
            {"repetition_count": 0, "ease_factor": 2.18, "interval_days": 1, "lapse_count": 1},
        ),
        (
            1,
            "enhanced_srs",
            "fluentt-esr-fsrs6-binary-v1",
            {"state": "Review", "step": None, "stability": 0.212, "difficulty": 6.4133},
        ),
    ],
)
def test_first_incorrect_uses_assigned_engine_and_literal_state(
    db_session, client, mapping_group, expected_type, expected_algorithm, expected_memory
):
    _, detail, _, sets, _, conditions, headers = setup_authority(
        db_session, client, mapping_group=mapping_group
    )
    item = detail["vocabulary_items"][0]
    condition = next(row for row in conditions if row.research_set_id == sets[0].id)
    response = client.post(
        "/reviews/attempts",
        headers=headers,
        json=request_for(item, TESTING_NOW - timedelta(days=3), correct=False),
    )

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["scheduler_type"] == expected_type
    assert result["algorithm_version"] == expected_algorithm
    assert result["next_interval_seconds"] == 86400
    assert result["scheduler_state"]["memory"] == expected_memory
    persisted = db_session.query(ReviewAttempt).one()
    assert persisted.research_assignment_id == condition.id
    assert persisted.response_time_ms == 1234
    assert evidence_counts(db_session) == (1, 1, 1, 1, 2)


def test_enhanced_subsequent_uses_database_state_due_and_interaction_not_client(
    db_session, client, monkeypatch
):
    _, detail, _, _, _, _, headers = setup_authority(db_session, client)
    item = detail["vocabulary_items"][0]
    first_at = TESTING_NOW - timedelta(days=10)
    first = client.post(
        "/reviews/attempts",
        headers=headers,
        json=request_for(item, first_at, correct=True),
    )
    assert first.status_code == 200, first.text
    prior_schedule = db_session.query(ReviewSchedule).one()
    observed = []
    original_resolve = acceptance.resolve_research_engine

    def observe(condition):
        engine = original_resolve(condition)
        class Observer:
            def schedule(self, *args):
                observed.append(args)
                return engine.schedule(*args)

        return Observer()

    monkeypatch.setattr(acceptance, "resolve_research_engine", observe)
    malicious = request_for(item, first_at + timedelta(days=3), correct=True)
    malicious.update(
        scheduler_type="conventional_srs",
        algorithm_version="sm2-binary-v1",
        prior_due_at_utc="1900-01-01T00:00:00Z",
        prior_scheduler_state={"scheduler_type": "conventional_srs"},
    )

    second = client.post("/reviews/attempts", headers=headers, json=malicious)

    assert second.status_code == 200, second.text
    assert len(observed) == 1
    inputs, reconstruction = observed[0]
    assert set(type(inputs).model_fields) == {
        "correct",
        "interaction_at_utc",
        "prior_state",
        "prior_interaction_at_utc",
    }
    assert inputs.prior_state.scheduler_type == "enhanced_srs"
    assert inputs.prior_interaction_at_utc == first_at
    assert reconstruction.prior_due_at_utc == prior_schedule.due_at
    assert (second.json()["scheduler_type"], second.json()["algorithm_version"]) == (
        "enhanced_srs",
        "fluentt-esr-fsrs6-binary-v1",
    )


def test_assigned_condition_alone_dispatches_engine_and_ignores_client_selectors(
    db_session, client, monkeypatch
):
    owner, detail, _, _, _, _, headers = setup_authority(
        db_session, client, mapping_group=2
    )
    original_sm2 = acceptance.BinarySm2Scheduler

    class CountSm2(original_sm2):
        calls = 0

        def schedule(self, inputs):
            type(self).calls += 1
            return super().schedule(inputs)

    class ForbiddenFsrs:
        def __init__(self):
            pytest.fail("Conventional assignment dispatched FSRS")

    monkeypatch.setattr(acceptance, "BinarySm2Scheduler", CountSm2)
    monkeypatch.setattr(acceptance, "EnhancedFsrsScheduler", ForbiddenFsrs)
    payload = request_for(
        detail["vocabulary_items"][0], TESTING_NOW - timedelta(days=3)
    )
    payload.update(
        scheduler_type="enhanced_srs",
        algorithm_version="fluentt-esr-fsrs6-binary-v1",
        condition="enhanced_srs",
    )

    response = client.post("/reviews/attempts", headers=headers, json=payload)

    assert response.status_code == 200, response.text
    assert response.json()["scheduler_type"] == "conventional_srs"
    assert CountSm2.calls == 1

    class ForbiddenDevelopment:
        def schedule(self, _context):
            pytest.fail("Test assignment entered an injected development engine")

    next_attempt = ReviewAttemptCreate(
        **request_for(
            detail["vocabulary_items"][0],
            TESTING_NOW - timedelta(days=1),
        )
    )
    accepted, schedule = service.record_review_attempt(
        db_session,
        db_session.get(User, owner),
        next_attempt,
        ForbiddenDevelopment(),
    )
    assert accepted.scheduler_type == "conventional_srs"
    assert schedule.interval_seconds == 6 * 86400
    assert CountSm2.calls == 2


def test_incomplete_test_assignment_fails_closed_without_chain(db_session, client):
    _, detail, _, _, _, _, headers = setup_authority(
        db_session, client, complete=False
    )

    response = client.post(
        "/reviews/attempts",
        headers=headers,
        json=request_for(
            detail["vocabulary_items"][0], TESTING_NOW - timedelta(days=3)
        ),
    )

    assert response.status_code == 500
    assert response.json()["detail"] == "D11_ASSIGNMENT_CONTRADICTION"
    assert evidence_counts(db_session) == (0, 0, 0, 0, 0)


def test_test_assignment_without_explicit_test_environment_stays_closed(
    db_session, client, monkeypatch
):
    _, detail, _, _, _, _, headers = setup_authority(db_session, client)
    monkeypatch.setattr(get_settings(), "app_env", "development")

    response = client.post(
        "/reviews/attempts",
        headers=headers,
        json=request_for(
            detail["vocabulary_items"][0], TESTING_NOW - timedelta(days=3)
        ),
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "D11_ROUTING_DISABLED"
    assert evidence_counts(db_session) == (0, 0, 0, 0, 0)


def test_valid_content_outside_assigned_set_is_rejected(db_session, client):
    _, detail, _, _, _, _, headers = setup_authority(
        db_session, client, memberships=False
    )

    response = client.post(
        "/reviews/attempts",
        headers=headers,
        json=request_for(
            detail["vocabulary_items"][0], TESTING_NOW - timedelta(days=3)
        ),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "D11_ITEM_NOT_ASSIGNED"
    assert evidence_counts(db_session) == (0, 0, 0, 0, 0)


def test_mutated_scheduler_result_is_revalidated_before_persistence(
    db_session, client, monkeypatch
):
    owner, detail, _, _, _, _, _ = setup_authority(
        db_session,
        client,
        mapping_group=2,
        participant_code=f"D11E_{uuid.uuid4().hex[:12]}",
        email=f"d11e-{uuid.uuid4().hex}@example.test",
    )
    resolve = acceptance.resolve_research_engine

    class InvalidResultEngine:
        def __init__(self, engine):
            self.engine = engine

        def schedule(self, *args):
            valid = self.engine.schedule(*args)
            invalid_memory = valid.scheduler_state.memory.model_copy(
                update={"interval_days": 6}
            )
            invalid_state = valid.scheduler_state.model_copy(
                update={"memory": invalid_memory}
            )
            return valid.model_copy(update={"scheduler_state": invalid_state})

    monkeypatch.setattr(
        acceptance,
        "resolve_research_engine",
        lambda condition: InvalidResultEngine(resolve(condition)),
    )
    payload = ReviewAttemptCreate(
        **request_for(
            detail["vocabulary_items"][0], TESTING_NOW - timedelta(days=3)
        )
    )

    with pytest.raises(ValidationError):
        service.record_review_attempt(db_session, db_session.get(User, owner), payload)

    assert evidence_counts(db_session) == (0, 0, 0, 0, 0)


def test_unassigned_item_and_assignment_before_freeze_fail_without_chain(
    db_session, client
):
    _, detail, _, _, _, _, headers = setup_authority(db_session, client)
    payload = request_for(
        detail["vocabulary_items"][0], TESTING_NOW - timedelta(days=31)
    )
    response = client.post("/reviews/attempts", headers=headers, json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "D11_ASSIGNMENT_NOT_ACTIVE_AT_INTERACTION"
    assert evidence_counts(db_session) == (0, 0, 0, 0, 0)


def test_stale_research_interaction_is_rejected_before_scheduler(db_session, client):
    _, detail, _, _, _, _, headers = setup_authority(db_session, client)
    item = detail["vocabulary_items"][0]
    interaction = TESTING_NOW - timedelta(days=3)
    first = client.post(
        "/reviews/attempts",
        headers=headers,
        json=request_for(item, interaction),
    )
    assert first.status_code == 200, first.text
    before = evidence_counts(db_session)

    stale = client.post(
        "/reviews/attempts",
        headers=headers,
        json=request_for(item, interaction),
    )

    assert stale.status_code == 409
    assert stale.json()["detail"] == "D11_STALE_INTERACTION"
    assert evidence_counts(db_session) == before


def test_replay_returns_original_before_assignment_and_scheduler_checks(
    db_session, client, monkeypatch
):
    _, detail, _, _, _, _, headers = setup_authority(db_session, client)
    payload = request_for(
        detail["vocabulary_items"][0], TESTING_NOW - timedelta(days=3)
    )
    first = client.post("/reviews/attempts", headers=headers, json=payload)
    assert first.status_code == 200, first.text
    before = evidence_counts(db_session)

    def forbidden(*args, **kwargs):
        pytest.fail("Accepted replay entered assignment/scheduler validation")

    monkeypatch.setattr(acceptance, "resolve_research_assignment", forbidden)
    monkeypatch.setattr(acceptance, "resolve_research_engine", forbidden)
    replay_payload = {
        **payload,
        "client_interaction_at": "1900-01-01T00:00:00",
        "content_revision_id": None,
        "content_release_id": None,
        "scheduler_type": "unknown",
    }

    replay = client.post(
        "/reviews/attempts", headers=headers, json=replay_payload
    )

    assert replay.status_code == 200
    assert replay.json() == first.json()
    assert evidence_counts(db_session) == before


def test_online_and_sync_acceptance_are_equivalent_and_sync_replay_is_idempotent(
    db_session, client
):
    _, online_detail, _, _, _, _, online_headers = setup_authority(
        db_session, client
    )
    sync_owner, sync_detail, _, _, _, _, _ = setup_authority(
        db_session,
        client,
        participant_code=f"D11E_{uuid.uuid4().hex[:12]}",
        email=f"d11e-{uuid.uuid4().hex}@example.test",
    )
    interaction = TESTING_NOW - timedelta(days=3)
    online_payload = request_for(online_detail["vocabulary_items"][0], interaction)
    sync_payload = request_for(sync_detail["vocabulary_items"][0], interaction)
    sync_payload["response_time_ms"] = 901
    sync_payload["pronunciation_score"] = 100
    online = client.post(
        "/reviews/attempts", headers=online_headers, json=online_payload
    )
    assert online.status_code == 200, online.text

    sync_responses = sync_review_events(
        db_session,
        db_session.get(User, sync_owner),
        [ReviewAttemptCreate(**sync_payload)],
    )
    synced = sync_responses[0].model_dump(mode="json")
    assert synced["scheduler_type"] == online.json()["scheduler_type"]
    assert synced["algorithm_version"] == online.json()["algorithm_version"]
    assert synced["next_interval_seconds"] == online.json()["next_interval_seconds"]
    assert synced["scheduler_state"] == online.json()["scheduler_state"]
    assert synced["response_time_ms"] == 901
    assert db_session.query(ReviewAttempt).filter_by(user_id=sync_owner).one().response_time_ms == 901

    before = evidence_counts(db_session)
    replayed = sync_review_events(
        db_session,
        db_session.get(User, sync_owner),
        [ReviewAttemptCreate(**sync_payload)],
    )
    assert replayed[0].id == sync_responses[0].id
    assert evidence_counts(db_session) == before


def test_current_due_eligibility_still_hides_a_future_research_schedule(
    db_session, client
):
    _, detail, _, _, _, _, headers = setup_authority(db_session, client)
    payload = request_for(
        detail["vocabulary_items"][0], TESTING_NOW - timedelta(days=1)
    )
    accepted = client.post("/reviews/attempts", headers=headers, json=payload)
    assert accepted.status_code == 200, accepted.text

    listing = eligible(
        client,
        headers,
        detail,
        lesson_id=detail["id"],
        content_release_id=detail["content_release_id"],
    )

    assert listing.status_code == 200
    listed_ids = {row["vocabulary_item"]["id"] for row in listing.json()["items"]}
    assert detail["vocabulary_items"][0]["id"] not in listed_ids


@pytest.mark.parametrize(
    "failure_stage",
    ["scheduler", "attempt", "schedule", "accepted_event", "research_event", "pointer"],
)
def test_failure_at_each_acceptance_stage_rolls_back_entire_chain(
    db_session, client, monkeypatch, failure_stage
):
    owner, detail, _, _, _, _, _ = setup_authority(
        db_session,
        client,
        mapping_group=2,
        participant_code=f"D11E_{uuid.uuid4().hex[:12]}",
        email=f"d11e-{uuid.uuid4().hex}@example.test",
    )
    payload = ReviewAttemptCreate(
        **request_for(
            detail["vocabulary_items"][0], TESTING_NOW - timedelta(days=3)
        )
    )
    before = evidence_counts(db_session)

    if failure_stage == "scheduler":
        resolve = acceptance.resolve_research_engine

        class FailsAfterCalculation:
            def __init__(self, engine):
                self.engine = engine

            def schedule(self, *args):
                self.engine.schedule(*args)
                raise RuntimeError("injected after scheduler calculation")

        monkeypatch.setattr(
            acceptance,
            "resolve_research_engine",
            lambda condition: FailsAfterCalculation(resolve(condition)),
        )
    elif failure_stage == "pointer":
        advance = service._advance_current_pointer

        def fail_after_pointer(*args):
            advance(*args)
            raise RuntimeError("injected after pointer staging")

        monkeypatch.setattr(service, "_advance_current_pointer", fail_after_pointer)
    elif failure_stage == "research_event":
        record = service.record_research_event
        count = 0

        def fail_after_event_is_staged(*args, **kwargs):
            nonlocal count
            staged = record(*args, **kwargs)
            count += 1
            if count == 1:
                raise RuntimeError("injected after research event staging")
            return staged

        monkeypatch.setattr(service, "record_research_event", fail_after_event_is_staged)
    else:
        model = {
            "attempt": ReviewAttempt,
            "schedule": ReviewSchedule,
            "accepted_event": AcceptedClientEvent,
        }[failure_stage]

        def fail_after_target_flush(session, _flush_context):
            if any(isinstance(row, model) for row in session.new):
                raise RuntimeError(f"injected after {failure_stage} staging")

        event.listen(db_session, "after_flush", fail_after_target_flush)

    try:
        with pytest.raises(RuntimeError, match="injected"):
            service.record_review_attempt(
                db_session, db_session.get(User, owner), payload
            )
    finally:
        if failure_stage in {"attempt", "schedule", "accepted_event"}:
            event.remove(db_session, "after_flush", fail_after_target_flush)

    assert evidence_counts(db_session) == before == (0, 0, 0, 0, 0)


def test_cross_condition_predecessor_state_fails_closed(db_session, client):
    owner, detail, _, sets, _, conditions, _ = setup_authority(
        db_session,
        client,
        mapping_group=2,
        participant_code=f"D11E_{uuid.uuid4().hex[:12]}",
        email=f"d11e-{uuid.uuid4().hex}@example.test",
    )
    condition = next(row for row in conditions if row.research_set_id == sets[0].id)
    item = detail["vocabulary_items"][0]
    interaction = TESTING_NOW - timedelta(days=10)
    session = ReviewSession(user_id=owner, client_session_id=uuid.uuid4())
    db_session.add(session)
    db_session.flush()
    prior = ReviewAttempt(
        user_id=owner,
        vocabulary_item_id=uuid.UUID(item["id"]),
        content_revision_id=uuid.UUID(item["content_revision_id"]),
        content_release_id=uuid.UUID(item["content_release_id"]),
        session_id=session.id,
        client_event_id=uuid.uuid4(),
        correct=True,
        response_time_ms=321,
        scheduler_type="conventional_srs",
        algorithm_version="sm2-binary-v1",
        research_assignment_id=condition.id,
        client_interaction_at=interaction,
        server_acceptance_at=TESTING_NOW,
        device_platform="test",
        application_version="test",
    )
    db_session.add(prior)
    db_session.flush()
    schedule = ReviewSchedule(
        user_id=owner,
        vocabulary_item_id=uuid.UUID(item["id"]),
        attempt_id=prior.id,
        scheduler_type="conventional_srs",
        algorithm_version="sm2-binary-v1",
        interval_seconds=2 * 86400,
        due_at=interaction + timedelta(days=2),
        scheduler_state={
            "schema_version": 1,
            "scheduler_type": "enhanced_srs",
            "algorithm_version": "fluentt-esr-fsrs6-binary-v1",
            "config_version": "fsrs6-binary-r90-config-v1",
            "memory": {
                "state": "Review",
                "step": None,
                "stability": 2.3065,
                "difficulty": 2.118103970459016,
            },
        },
    )
    db_session.add(schedule)
    db_session.flush()
    db_session.add(
        AcceptedClientEvent(
            user_id=owner,
            client_event_id=prior.client_event_id,
            attempt_id=prior.id,
            accepted_at=TESTING_NOW,
            response_payload={},
        )
    )
    db_session.add(
        CurrentReviewSchedule(
            user_id=owner,
            vocabulary_item_id=prior.vocabulary_item_id,
            schedule_id=schedule.id,
        )
    )
    from app.research_logging.service import ItemAttemptPayload, record_research_event

    for event_type in ("REVIEW_ANSWERED", "REVIEW_SCHEDULED"):
        record_research_event(
            db_session,
            owner,
            event_type,
            ItemAttemptPayload(),
            prior.id,
        )
    db_session.commit()
    before = evidence_counts(db_session)

    with pytest.raises(HTTPException) as error:
        service.record_review_attempt(
            db_session,
            db_session.get(User, owner),
            ReviewAttemptCreate(
                **request_for(item, interaction + timedelta(days=3))
            ),
        )

    assert error.value.detail == "D11_STATE_IDENTITY_UNSUPPORTED"
    assert evidence_counts(db_session) == before == (1, 1, 1, 1, 2)


def test_two_distinct_conventional_events_serialize_on_postgresql_learner_lock(
    db_session, client, monkeypatch
):
    owner, detail, _, _, _, _, _ = setup_authority(
        db_session,
        client,
        mapping_group=2,
        participant_code=f"D11E_{uuid.uuid4().hex[:12]}",
        email=f"d11e-{uuid.uuid4().hex}@example.test",
    )
    monkeypatch.setattr(acceptance, "backend_now", lambda: TESTING_NOW)
    session_factory = sessionmaker(bind=db_session.get_bind(), expire_on_commit=False)
    first_has_lock = Event()
    second_is_waiting = Event()
    release_first = Event()
    pids = {}
    predecessor_reads = []
    acquire = acceptance.acquire_learner_lock
    load = acceptance.load_current_predecessor

    def coordinate_after_real_lock(db, learner):
        label = db.info["d11e_worker"]
        pids[label] = db.scalar(text("SELECT pg_backend_pid()"))
        if label == "second":
            second_is_waiting.set()
        acquire(db, learner)
        if label == "first":
            first_has_lock.set()
            if not release_first.wait(timeout=10):
                raise TimeoutError("concurrency test did not release first worker")

    def track_predecessor_read(db, learner, item):
        prior = load(db, learner, item)
        predecessor_reads.append(
            (db.info["d11e_worker"], prior.schedule.id if prior else None)
        )
        return prior

    monkeypatch.setattr(acceptance, "acquire_learner_lock", coordinate_after_real_lock)
    monkeypatch.setattr(acceptance, "load_current_predecessor", track_predecessor_read)
    item = detail["vocabulary_items"][0]
    first_at = TESTING_NOW - timedelta(days=10)
    sessions = [
        ReviewSession(user_id=owner, client_session_id=uuid.uuid4()),
        ReviewSession(user_id=owner, client_session_id=uuid.uuid4()),
    ]
    db_session.add_all(sessions)
    db_session.commit()

    def accept(label, interaction, review_session):
        with session_factory() as db:
            db.info["d11e_worker"] = label
            learner = db.get(User, owner)
            body = request_for(item, interaction)
            body["session_id"] = str(review_session.id)
            body["client_session_id"] = str(review_session.client_session_id)
            payload = ReviewAttemptCreate(**body)
            return service.record_review_attempt(db, learner, payload)

    with ThreadPoolExecutor(max_workers=2, thread_name_prefix="d11e") as pool:
        first_future = pool.submit(accept, "first", first_at, sessions[0])
        try:
            assert first_has_lock.wait(timeout=10)
            second_future = pool.submit(
                accept, "second", first_at + timedelta(days=3), sessions[1]
            )
            assert second_is_waiting.wait(timeout=10)
            deadline = time.monotonic() + 5
            blocked = []
            with db_session.bind.connect() as observer:
                while time.monotonic() < deadline:
                    blocked = observer.scalar(
                        text("SELECT pg_blocking_pids(:pid)"),
                        {"pid": pids["second"]},
                    )
                    if pids["first"] in blocked:
                        break
                    time.sleep(0.02)
            assert pids["first"] in blocked
        finally:
            release_first.set()
        first_attempt, first_schedule = first_future.result(timeout=15)
        second_attempt, second_schedule = second_future.result(timeout=15)

    assert first_schedule.interval_seconds == 86400
    assert second_schedule.interval_seconds == 6 * 86400
    assert second_attempt.client_interaction_at > first_attempt.client_interaction_at
    assert predecessor_reads == [
        ("first", None),
        ("second", first_schedule.id),
    ]
    assert evidence_counts(db_session) == (2, 2, 2, 1, 4)
    db_session.expire_all()
    pointer = db_session.get(
        CurrentReviewSchedule,
        (owner, uuid.UUID(detail["vocabulary_items"][0]["id"])),
    )
    assert pointer.schedule_id == second_schedule.id


@pytest.mark.parametrize(
    "subsequent", [False, True], ids=["first-copy", "subsequent-construct"]
)
@pytest.mark.parametrize("transport", ["online", "sync"])
@pytest.mark.parametrize(
    "mapping_group,bad_memory",
    [
        pytest.param(1, {"stability": -1.0}, id="fsrs-negative-stability"),
        pytest.param(1, {"stability": 0}, id="fsrs-zero-stability"),
        pytest.param(1, {"stability": float("nan")}, id="fsrs-nan-stability"),
        pytest.param(1, {"stability": float("inf")}, id="fsrs-inf-stability"),
        pytest.param(1, {"difficulty": 0}, id="fsrs-low-difficulty"),
        pytest.param(1, {"difficulty": 11}, id="fsrs-high-difficulty"),
        pytest.param(1, {"difficulty": float("nan")}, id="fsrs-nan-difficulty"),
        pytest.param(1, {"difficulty": float("inf")}, id="fsrs-inf-difficulty"),
        pytest.param(1, {"state": "Learning"}, id="fsrs-learning-state"),
        pytest.param(1, {"step": 0}, id="fsrs-nonnull-step"),
        pytest.param(1, {"stability": True}, id="fsrs-bool-stability"),
        pytest.param(1, {"difficulty": "5"}, id="fsrs-string-difficulty"),
        pytest.param(2, {"ease_factor": Decimal(9)}, id="sm2-ef9"),
        pytest.param(2, {"ease_factor": Decimal("1.29")}, id="sm2-low-ef"),
        pytest.param(2, {"ease_factor": Decimal("NaN")}, id="sm2-nan-ef"),
        pytest.param(2, {"ease_factor": Decimal("Infinity")}, id="sm2-inf-ef"),
        pytest.param(2, {"repetition_count": -1}, id="sm2-negative-repetitions"),
        pytest.param(2, {"lapse_count": -1}, id="sm2-negative-lapses"),
        pytest.param(2, {"interval_days": 0}, id="sm2-zero-interval"),
        pytest.param(2, {"interval_days": 36501}, id="sm2-over-cap-interval"),
        pytest.param(2, {"ease_factor": Decimal("2.18")}, id="sm2-unreachable-ef"),
        pytest.param(2, {"repetition_count": 1.0}, id="sm2-float-counter"),
        pytest.param(2, {"lapse_count": True}, id="sm2-bool-counter"),
        pytest.param(2, {"interval_days": "1"}, id="sm2-string-interval"),
    ],
)
def test_f1_invalid_nested_instances_rejected_before_staging(
    db_session, client, monkeypatch, mapping_group, bad_memory, transport, subsequent
):
    owner, detail, _, _, _, _, headers = setup_authority(
        db_session, client, mapping_group=mapping_group
    )
    item = detail["vocabulary_items"][0]
    if subsequent:
        service.record_review_attempt(
            db_session,
            db_session.get(User, owner),
            ReviewAttemptCreate(**request_for(item, TESTING_NOW - timedelta(days=10))),
        )
    before = f1_evidence_snapshot(db_session)
    resolve = acceptance.resolve_research_engine
    schedule_calls, library_calls = [], []
    review_card = fsrs6.Scheduler.review_card

    def observe_card(*args, **kwargs):
        library_calls.append(1)
        return review_card(*args, **kwargs)

    monkeypatch.setattr(fsrs6.Scheduler, "review_card", observe_card)

    class InvalidMemoryEngine:
        def __init__(self, engine):
            self.engine = engine

        def schedule(self, *args):
            schedule_calls.append(1)
            valid = self.engine.schedule(*args)
            if subsequent:
                memory = type(valid.scheduler_state.memory).model_construct(
                    **{**valid.scheduler_state.memory.model_dump(), **bad_memory}
                )
            else:
                memory = valid.scheduler_state.memory.model_copy(update=bad_memory)
            state = valid.scheduler_state.model_copy(update={"memory": memory})
            return valid.model_copy(update={"scheduler_state": state})

    monkeypatch.setattr(
        acceptance, "resolve_research_engine", lambda c: InvalidMemoryEngine(resolve(c))
    )

    def forbidden_persistence(*args, **kwargs):
        pytest.fail("Malformed result reached accepted-evidence staging")

    monkeypatch.setattr(service, "_persist_research_acceptance", forbidden_persistence)
    value = request_for(item, TESTING_NOW - timedelta(days=3))
    with pytest.raises(ValidationError) as caught:
        if transport == "online":
            client.post("/reviews/attempts", headers=headers, json=value)
        else:
            sync_review_events(
                db_session, db_session.get(User, owner), [ReviewAttemptCreate(**value)]
            )
    assert any("memory" in error["loc"] for error in caught.value.errors())
    assert schedule_calls == [1]
    assert len(library_calls) == (1 if mapping_group == 1 else 0)
    assert f1_evidence_snapshot(db_session) == before


@pytest.mark.parametrize("mapping_group", [1, 2])
@pytest.mark.parametrize("representation", ["instance", "dict", "hybrid"])
@pytest.mark.parametrize(
    "location,update",
    [
        pytest.param("result", {"unexpected": 1}, id="extra-result"),
        pytest.param("state", {"unexpected": 1}, id="extra-state"),
        pytest.param("memory", {"unexpected": 1}, id="extra-memory"),
        pytest.param("result", {"interval_days": True}, id="bool-result-days"),
        pytest.param("result", {"interval_seconds": 86400.0}, id="float-seconds"),
        pytest.param("state", {"schema_version": True}, id="bool-schema"),
        pytest.param("state", {"algorithm_version": "unknown"}, id="unknown-algorithm"),
        pytest.param("state", {"config_version": "unknown"}, id="unknown-config"),
    ],
)
def test_f1_malformed_result_shapes_rejected_before_staging(
    db_session, client, monkeypatch, mapping_group, representation, location, update
):
    owner, detail, _, _, _, _, _ = setup_authority(
        db_session, client, mapping_group=mapping_group
    )
    before = f1_evidence_snapshot(db_session)
    resolve = acceptance.resolve_research_engine

    class MalformedEngine:
        def __init__(self, engine):
            self.engine = engine

        def schedule(self, *args):
            valid = self.engine.schedule(*args)
            if representation == "dict":
                raw = valid.model_dump(mode="python", round_trip=True)
                target = raw
                if location in ("state", "memory"):
                    target = raw["scheduler_state"]
                if location == "memory":
                    target = target["memory"]
                target.update(update)
                return raw
            if location == "memory":
                memory = valid.scheduler_state.memory.model_copy(update=update)
                state = valid.scheduler_state.model_copy(update={"memory": memory})
                malformed = valid.model_copy(update={"scheduler_state": state})
            elif location == "state":
                state = valid.scheduler_state.model_copy(update=update)
                malformed = valid.model_copy(update={"scheduler_state": state})
            else:
                malformed = valid.model_copy(update=update)
            # A dict may itself carry nested model instances; neither is trusted.
            return dict(malformed) if representation == "hybrid" else malformed

    monkeypatch.setattr(
        acceptance, "resolve_research_engine", lambda c: MalformedEngine(resolve(c))
    )

    def forbidden_persistence(*args, **kwargs):
        pytest.fail("Malformed result reached accepted-evidence staging")

    monkeypatch.setattr(service, "_persist_research_acceptance", forbidden_persistence)
    with pytest.raises(ValidationError):
        service.record_review_attempt(
            db_session,
            db_session.get(User, owner),
            ReviewAttemptCreate(
                **request_for(
                    detail["vocabulary_items"][0], TESTING_NOW - timedelta(days=3)
                )
            ),
        )
    assert f1_evidence_snapshot(db_session) == before


@pytest.mark.parametrize("mapping_group", [1, 2])
@pytest.mark.parametrize("first_correct", [True, False])
def test_f1_valid_result_revalidation_preserves_memory_and_next_transition(
    mapping_group, first_correct
):
    engine = EnhancedFsrsScheduler() if mapping_group == 1 else BinarySm2Scheduler()
    owner, item = uuid.uuid4(), uuid.uuid4()
    prior = prior_interaction = prior_due = None
    observed_ease = set()
    for index, correct in enumerate([first_correct, False, False, False, False, True]):
        at = TESTING_NOW - timedelta(days=20 - index * 3)
        inputs = ResearchSchedulerInput(
            correct=correct,
            interaction_at_utc=at,
            prior_state=prior,
            prior_interaction_at_utc=prior_interaction,
        )
        context = FsrsReconstructionContext(
            user_id=owner, vocabulary_item_id=item, prior_due_at_utc=prior_due
        )
        args = (inputs, context) if mapping_group == 1 else (inputs,)
        original = engine.schedule(*args)
        before = original.model_dump(mode="python", round_trip=True)
        validated = validate_research_result(original, inputs)
        from_dict = validate_research_result(copy.deepcopy(before), inputs)
        assert validated == from_dict == original
        assert validated is not original
        assert validated.scheduler_state is not original.scheduler_state
        assert validated.scheduler_state.memory is not original.scheduler_state.memory
        assert original.model_dump(mode="python", round_trip=True) == before
        if mapping_group == 2:
            ease = validated.scheduler_state.memory.ease_factor
            assert type(ease) is Decimal
            assert (
                ease.as_tuple()
                == original.scheduler_state.memory.ease_factor.as_tuple()
            )
            observed_ease.add(ease)
        else:
            for name in ("stability", "difficulty"):
                assert (
                    getattr(validated.scheduler_state.memory, name).hex()
                    == getattr(original.scheduler_state.memory, name).hex()
                )
        next_at = at + timedelta(days=3)
        outputs = []
        for candidate in (original, validated, from_dict):
            next_inputs = ResearchSchedulerInput(
                correct=True,
                interaction_at_utc=next_at,
                prior_state=candidate.scheduler_state,
                prior_interaction_at_utc=at,
            )
            outputs.append(
                engine.schedule(
                    next_inputs,
                    FsrsReconstructionContext(
                        user_id=owner,
                        vocabulary_item_id=item,
                        prior_due_at_utc=candidate.due_at,
                    ),
                )
                if mapping_group == 1
                else engine.schedule(next_inputs)
            )
        assert outputs[0] == outputs[1] == outputs[2]
        prior, prior_interaction, prior_due = (
            validated.scheduler_state,
            at,
            validated.due_at,
        )
    if mapping_group == 2 and first_correct:
        assert observed_ease == {
            Decimal(v) for v in ("2.5", "2.18", "1.86", "1.54", "1.3")
        }


@pytest.mark.parametrize("mapping_group", [1, 2])
def test_f1_valid_acceptance_calls_engine_once_and_replay_skips_result_validation(
    db_session, client, monkeypatch, mapping_group
):
    owner, detail, _, _, _, _, headers = setup_authority(
        db_session, client, mapping_group=mapping_group
    )
    resolve = acceptance.resolve_research_engine
    calls, library_calls = [], []
    review_card = fsrs6.Scheduler.review_card

    def observe_card(*args, **kwargs):
        library_calls.append(1)
        return review_card(*args, **kwargs)

    monkeypatch.setattr(fsrs6.Scheduler, "review_card", observe_card)

    class CountEngine:
        def __init__(self, engine):
            self.engine = engine

        def schedule(self, *args):
            calls.append(1)
            return self.engine.schedule(*args)

    monkeypatch.setattr(
        acceptance, "resolve_research_engine", lambda c: CountEngine(resolve(c))
    )
    value = request_for(detail["vocabulary_items"][0], TESTING_NOW - timedelta(days=3))
    first = client.post("/reviews/attempts", headers=headers, json=value)
    assert first.status_code == 200, first.text
    before = f1_evidence_snapshot(db_session)

    def forbidden(*args, **kwargs):
        pytest.fail("Accepted replay entered result validation")

    monkeypatch.setattr(service, "validate_research_result", forbidden)
    monkeypatch.setattr(acceptance, "resolve_research_engine", forbidden)
    replay = client.post("/reviews/attempts", headers=headers, json=value)
    synced = sync_review_events(
        db_session, db_session.get(User, owner), [ReviewAttemptCreate(**value)]
    )[0]
    assert replay.json() == first.json()
    assert synced.model_dump(mode="json") == first.json()
    assert calls == [1]
    assert len(library_calls) == (1 if mapping_group == 1 else 0)
    assert f1_evidence_snapshot(db_session) == before


@pytest.mark.parametrize("mapping_group", [1, 2])
def test_f1_complete_formal_authority_remains_closed(db_session, client, mapping_group):
    owner, detail, _, _, _, conditions, headers = setup_authority(
        db_session, client, mapping_group=mapping_group, mode="formal", complete=True
    )
    assert len(conditions) == 2
    before = f1_evidence_snapshot(db_session)
    value = request_for(detail["vocabulary_items"][0], TESTING_NOW - timedelta(days=3))
    online = client.post("/reviews/attempts", headers=headers, json=value)
    assert online.status_code == 503
    assert online.json()["detail"] == "D11_ROUTING_DISABLED"
    with pytest.raises(HTTPException) as caught:
        sync_review_events(
            db_session, db_session.get(User, owner), [ReviewAttemptCreate(**value)]
        )
    assert (caught.value.status_code, caught.value.detail) == (
        503,
        "D11_ROUTING_DISABLED",
    )
    assert f1_evidence_snapshot(db_session) == before


@pytest.mark.parametrize("precision", [28, 2], ids=["ordinary", "precision2"])
@pytest.mark.parametrize("forged", [False, True], ids=["genuine238", "forged240"])
@pytest.mark.parametrize("transport", ["shared", "sync"])
def test_f2_sixth_correct_reachability_before_persistence(
    db_session, client, monkeypatch, precision, forged, transport
):
    owner, detail, _, _, _, _, _ = setup_authority(db_session, client, mapping_group=2)
    item = detail["vocabulary_items"][0]
    for index, days in enumerate([1, 6, 15, 38, 95]):
        _, schedule = service.record_review_attempt(
            db_session,
            db_session.get(User, owner),
            ReviewAttemptCreate(
                **request_for(item, TESTING_NOW - timedelta(days=12 - index))
            ),
        )
        assert schedule.interval_seconds == days * 86400
    before = f1_evidence_snapshot(db_session)
    resolve = acceptance.resolve_research_engine
    calls = []

    class SixthCorrect:
        def __init__(self, engine):
            self.engine = engine

        def schedule(self, inputs):
            calls.append(1)
            good = self.engine.schedule(inputs)
            assert good.interval_days == 238
            assert good.scheduler_state.memory.repetition_count == 6
            assert good.scheduler_state.memory.ease_factor == Decimal("2.5")
            if not forged:
                return good
            memory = good.scheduler_state.memory.model_copy(
                update={"interval_days": 240}
            )
            state = good.scheduler_state.model_copy(update={"memory": memory})
            return good.model_copy(
                update={
                    "scheduler_state": state,
                    "interval_days": 240,
                    "interval_seconds": 240 * 86400,
                    "due_at": inputs.interaction_at_utc + timedelta(days=240),
                }
            )

    monkeypatch.setattr(
        acceptance, "resolve_research_engine", lambda c: SixthCorrect(resolve(c))
    )
    if forged:

        def forbidden_staging(*args, **kwargs):
            pytest.fail("Unreachable 240-day memory reached persistence staging")

        monkeypatch.setattr(service, "_persist_research_acceptance", forbidden_staging)
    value = ReviewAttemptCreate(**request_for(item, TESTING_NOW - timedelta(days=7)))
    outer_context, outer_before = getcontext(), f2_context_snapshot()
    with localcontext() as caller:
        caller.prec = precision
        caller.flags[Rounded] = True
        caller_before = f2_context_snapshot()

        def accept():
            if transport == "sync":
                return sync_review_events(
                    db_session, db_session.get(User, owner), [value]
                )[0]
            attempt, schedule = service.record_review_attempt(
                db_session, db_session.get(User, owner), value
            )
            assert schedule.attempt_id == attempt.id
            return schedule

        if forged:
            with pytest.raises(ValidationError) as caught:
                accept()
            assert any("memory" in error["loc"] for error in caught.value.errors())
        else:
            accept()
        assert getcontext() is caller
        assert f2_context_snapshot() == caller_before
    assert getcontext() is outer_context
    assert f2_context_snapshot() == outer_before
    assert calls == [1]
    if forged:
        assert f1_evidence_snapshot(db_session) == before
    else:
        assert evidence_counts(db_session) == (6, 6, 6, 1, 12)
        newest = (
            db_session.query(ReviewAttempt)
            .filter_by(client_event_id=value.client_event_id)
            .one()
        )
        stored = db_session.query(ReviewSchedule).filter_by(attempt_id=newest.id).one()
        pointer = db_session.get(
            CurrentReviewSchedule,
            (owner, newest.vocabulary_item_id),
            populate_existing=True,
        )
        assert pointer.schedule_id == stored.id
        assert stored.interval_seconds == 238 * 86400
        assert stored.due_at == newest.client_interaction_at + timedelta(days=238)
        assert stored.scheduler_state["memory"] == {
            "repetition_count": 6,
            "ease_factor": 2.5,
            "interval_days": 238,
            "lapse_count": 0,
        }
