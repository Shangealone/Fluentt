"""D11B closed routing and real PostgreSQL acceptance serialization."""

import copy
import importlib
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from threading import Event
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from psycopg.errors import DeadlockDetected, LockNotAvailable, SerializationFailure
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.auth.models import User
from app.core.config import get_settings
from app.research_logging.models import ResearchEvent
from app.reviews import service
from app.reviews.models import (
    CurrentReviewSchedule,
    ReviewAttempt,
    ReviewSchedule,
    ReviewSession,
)
from app.reviews.schemas import ReviewAttemptCreate
from app.scheduling.development import DevelopmentScheduler
from app.sync.models import AcceptedClientEvent
from tests.content.test_provenance import attempt
from tests.reviews.test_d11b_persistence import direct_attempt, graph
from tests.reviews.test_due_review import make_review_context


def infrastructure():
    try:
        return importlib.import_module("app.reviews.acceptance")
    except ModuleNotFoundError:
        pytest.fail("D11B acceptance infrastructure is missing")


@pytest.fixture
def context(db_session, client):
    return make_review_context(db_session, client)


def counts(db):
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


def test_unknown_environment_has_no_implicit_development_fallback(
    db_session, client, context, monkeypatch
):
    _, headers, detail = context
    monkeypatch.setattr(get_settings(), "app_env", "production")
    response = client.post(
        "/reviews/attempts",
        headers=headers,
        json=attempt(detail["vocabulary_items"][0]),
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "D11_ROUTING_DISABLED"
    assert counts(db_session) == (0, 0, 0, 0, 0)


def test_research_allocation_never_falls_back_even_with_test_engine(db_session, client):
    owner, detail, *_ = graph(db_session, client)

    class Forbidden(DevelopmentScheduler):
        def schedule(self, context):
            pytest.fail("Research allocation entered a development engine")

    with pytest.raises(HTTPException) as error:
        service.record_review_attempt(
            db_session,
            db_session.get(User, owner),
            ReviewAttemptCreate(**attempt(detail["vocabulary_items"][0])),
            Forbidden(),
        )
    assert (error.value.status_code, error.value.detail) == (
        503,
        "D11_CLOCK_POLICY_UNAVAILABLE",
    )
    assert counts(db_session) == (0, 0, 0, 0, 0)


def test_accepted_replay_precedes_routing_state_time_and_scheduler(
    db_session, client, context, monkeypatch
):
    owner, headers, detail = context
    payload = attempt(detail["vocabulary_items"][0])
    first = client.post("/reviews/attempts", headers=headers, json=payload)
    assert first.status_code == 200
    before = counts(db_session)

    def forbidden(*args, **kwargs):
        pytest.fail("Accepted replay entered new-work validation")

    monkeypatch.setattr(infrastructure(), "resolve_development_authority", forbidden)
    monkeypatch.setattr(infrastructure(), "load_current_predecessor", forbidden)
    monkeypatch.setattr(get_settings(), "app_env", "production")
    legacy = {
        **payload,
        "content_revision_id": None,
        "content_release_id": None,
        "client_interaction_at": "1900-01-01T00:00:00",
    }

    class Forbidden(DevelopmentScheduler):
        schedule = forbidden

    accepted, scheduled = service.record_review_attempt(
        db_session,
        db_session.get(User, owner),
        ReviewAttemptCreate(**legacy),
        Forbidden(),
    )
    assert str(accepted.id) == first.json()["id"]
    assert scheduled.interval_seconds == first.json()["next_interval_seconds"]
    assert counts(db_session) == before


def test_session_preflight_and_fresh_state_only_inside_read_committed_lock(
    db_session, client, context, monkeypatch
):
    owner, _, detail = context
    infra = infrastructure()
    acquire, load, preflight = (
        infra.acquire_learner_lock,
        infra.load_current_predecessor,
        service.get_or_create_review_session,
    )
    seen = []

    def resolve_session(db, *args):
        assert not db.info.get("d11_locked")
        seen.append("preflight")
        return preflight(db, *args)

    def lock(db, user_id):
        assert db.in_transaction()
        assert db.scalar(text("SHOW transaction_isolation")) == "read committed"
        acquire(db, user_id)
        db.info["d11_locked"] = True
        seen.append("lock")

    def predecessor(db, *args):
        assert db.info["d11_locked"]
        seen.append("state")
        return load(db, *args)

    monkeypatch.setattr(service, "get_or_create_review_session", resolve_session)
    monkeypatch.setattr(infra, "acquire_learner_lock", lock)
    monkeypatch.setattr(infra, "load_current_predecessor", predecessor)

    class Observe(DevelopmentScheduler):
        def schedule(self, context):
            assert seen == ["preflight", "lock", "state"]
            return super().schedule(context)

    service.record_review_attempt(
        db_session,
        db_session.get(User, owner),
        ReviewAttemptCreate(**attempt(detail["vocabulary_items"][0])),
        Observe(),
    )
    assert counts(db_session) == (1, 1, 1, 1, 2)


@pytest.mark.parametrize("duplicate", [True, False])
@pytest.mark.parametrize("existing", [True, False])
@pytest.mark.parametrize("second_item", [False, True])
def test_postgresql_wait_recheck_and_fresh_predecessor(
    db_session, client, context, monkeypatch, duplicate, existing, second_item
):
    owner, headers, detail = context
    word = detail["vocabulary_items"][0]
    if existing:
        assert (
            client.post(
                "/reviews/attempts", headers=headers, json=attempt(word)
            ).status_code
            == 200
        )
    prior = db_session.scalar(select(CurrentReviewSchedule.schedule_id))
    session = ReviewSession(user_id=owner, client_session_id=uuid.uuid4())
    db_session.add(session)
    db_session.commit()
    payload = {
        **attempt(word),
        "session_id": str(session.id),
        "client_session_id": str(session.client_session_id),
    }
    other = (
        copy.deepcopy(payload)
        if duplicate
        else {**payload, "client_event_id": str(uuid.uuid4())}
    )
    if second_item:
        other = {
            **other,
            **{
                field: detail["vocabulary_items"][1][key]
                for field, key in (
                    ("vocabulary_item_id", "id"),
                    ("content_revision_id", "content_revision_id"),
                    ("content_release_id", "content_release_id"),
                )
            },
        }
    entered, release, waiting = Event(), Event(), Event()
    infra = infrastructure()
    acquire, load = infra.acquire_learner_lock, infra.load_current_predecessor
    pids, reads, calls = {}, [], []

    def lock(db, user_id):
        label = db.info["worker"]
        pids[label] = db.scalar(text("SELECT pg_backend_pid()"))
        if label == "second":
            waiting.set()
        acquire(db, user_id)
        db.info["locked"] = True

    def predecessor(db, *args):
        assert db.info["locked"]
        value = load(db, *args)
        reads.append((db.info["worker"], value.schedule.id if value else None))
        return value

    monkeypatch.setattr(infra, "acquire_learner_lock", lock)
    monkeypatch.setattr(infra, "load_current_predecessor", predecessor)

    class Hold(DevelopmentScheduler):
        def schedule(self, context):
            calls.append("first")
            entered.set()
            assert release.wait(10)
            return super().schedule(context)

    class Count(DevelopmentScheduler):
        def schedule(self, context):
            calls.append("second")
            return super().schedule(context)

    def worker(label, body, engine):
        with Session(db_session.bind, expire_on_commit=False) as db:
            db.info["worker"] = label
            result = service.record_review_attempt(
                db, db.get(User, owner), ReviewAttemptCreate(**body), engine
            )
            return result[0].id, result[1].id

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(worker, "first", payload, Hold())
        try:
            assert entered.wait(10)
            second = pool.submit(worker, "second", other, Count())
            assert waiting.wait(10)
            deadline = time.monotonic() + 5
            blocked = []
            with db_session.bind.connect() as observer:
                while time.monotonic() < deadline:
                    blocked = observer.scalar(
                        text("SELECT pg_blocking_pids(:pid)"), {"pid": pids["second"]}
                    )
                    if pids["first"] in blocked:
                        break
                    time.sleep(0.02)
            assert pids["first"] in blocked
            assert reads == [("first", prior)]
        finally:
            release.set()
        a, b = first.result(10), second.result(10)
    assert calls == (["first"] if duplicate else ["first", "second"])
    assert reads == (
        [("first", prior)]
        if duplicate
        else [("first", prior), ("second", None if second_item else a[1])]
    )
    assert (a == b) is duplicate
    total = int(existing) + (1 if duplicate else 2)
    assert counts(db_session) == (
        total,
        total,
        total,
        2 if second_item and not duplicate else 1,
        2 * total,
    )


def test_different_learners_do_not_share_a_global_lock(db_session, client, context):
    owner, _, detail = context
    other = User(
        email="parallel-d11b@example.test",
        password_hash="test",
        participant_code="D11B_PARALLEL",
        is_active=True,
    )
    db_session.add(other)
    db_session.commit()
    other_id = other.id
    entered, release = Event(), Event()

    class Hold(DevelopmentScheduler):
        def schedule(self, context):
            entered.set()
            assert release.wait(10)
            return super().schedule(context)

    def worker(user_id, engine):
        with Session(db_session.bind, expire_on_commit=False) as db:
            return service.record_review_attempt(
                db,
                db.get(User, user_id),
                ReviewAttemptCreate(**attempt(detail["vocabulary_items"][0])),
                engine,
            )[0].id

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(worker, owner, Hold())
        try:
            assert entered.wait(10)
            second = pool.submit(worker, other_id, DevelopmentScheduler())
            assert second.result(5)
            assert not first.done()
        finally:
            release.set()
        first.result(10)
    assert counts(db_session) == (2, 2, 2, 2, 4)


def test_failure_after_staging_entire_chain_rolls_back_pointer_and_history(
    db_session, client, context, monkeypatch
):
    owner, headers, detail = context
    word = detail["vocabulary_items"][0]
    assert (
        client.post(
            "/reviews/attempts", headers=headers, json=attempt(word)
        ).status_code
        == 200
    )
    before = counts(db_session)
    pointer = db_session.scalar(select(CurrentReviewSchedule.schedule_id))
    original = service.record_research_event

    def fail_second(**kwargs):
        original(**kwargs)
        if kwargs["event_type"] == "REVIEW_SCHEDULED":
            kwargs["db"].flush()
            raise RuntimeError("injected after final evidence")

    monkeypatch.setattr(service, "record_research_event", fail_second)
    with pytest.raises(RuntimeError, match="after final evidence"):
        service.record_review_attempt(
            db_session,
            db_session.get(User, owner),
            ReviewAttemptCreate(**attempt(word)),
        )
    assert counts(db_session) == before
    assert db_session.scalar(select(CurrentReviewSchedule.schedule_id)) == pointer


def test_missing_pointer_fails_before_engine_without_initializing_again(
    db_session, client, context
):
    owner, headers, detail = context
    word = detail["vocabulary_items"][0]
    assert (
        client.post(
            "/reviews/attempts", headers=headers, json=attempt(word)
        ).status_code
        == 200
    )
    db_session.execute(text("DELETE FROM current_review_schedules"))
    db_session.commit()

    class Forbidden(DevelopmentScheduler):
        def schedule(self, context):
            pytest.fail("Broken history entered scheduler")

    with pytest.raises(HTTPException) as error:
        service.record_review_attempt(
            db_session,
            db_session.get(User, owner),
            ReviewAttemptCreate(**attempt(word)),
            Forbidden(),
        )
    assert (error.value.status_code, error.value.detail) == (
        500,
        "D11_CURRENT_CHAIN_INVALID",
    )
    assert counts(db_session) == (1, 1, 1, 0, 2)


def test_pure_chronology_requires_aware_utc_and_strict_increase():
    validate = infrastructure().validate_research_chronology
    previous = datetime(2026, 1, 1, tzinfo=UTC)
    for incoming in (previous, previous - timedelta(microseconds=1)):
        with pytest.raises(HTTPException) as error:
            validate(incoming, previous)
        assert (error.value.status_code, error.value.detail) == (
            409,
            "D11_STALE_INTERACTION",
        )
    with pytest.raises(HTTPException) as error:
        validate(previous.replace(tzinfo=None), None)
    assert (error.value.status_code, error.value.detail) == (
        422,
        "D11_TIMEZONE_REQUIRED",
    )
    later = previous + timedelta(microseconds=1)
    assert validate(later, previous) == later
    assert validate(previous, None) == previous
    with pytest.raises(HTTPException) as error:
        infrastructure().validate_future_policy(later, datetime.now(UTC), None)
    assert (error.value.status_code, error.value.detail) == (
        503,
        "D11_CLOCK_POLICY_UNAVAILABLE",
    )


@pytest.mark.parametrize(
    "database_error", [DeadlockDetected, LockNotAvailable, SerializationFailure]
)
def test_transaction_errors_are_retryable_without_engine_or_partial_evidence(
    db_session, client, context, monkeypatch, database_error
):
    owner, _, detail = context

    def fail(*args):
        raise OperationalError(
            "test learner lock", {}, database_error("injected transaction condition")
        )

    monkeypatch.setattr(infrastructure(), "acquire_learner_lock", fail)
    with pytest.raises(HTTPException) as error:
        service.record_review_attempt(
            db_session,
            db_session.get(User, owner),
            ReviewAttemptCreate(**attempt(detail["vocabulary_items"][0])),
        )
    assert (error.value.status_code, error.value.detail) == (
        503,
        "D11_TRANSACTION_RETRY",
    )
    assert counts(db_session) == (0, 0, 0, 0, 0)


def test_test_injection_cannot_bypass_environment_or_persist_research_output(
    db_session, client, context, monkeypatch
):
    owner, _, detail = context
    body = ReviewAttemptCreate(**attempt(detail["vocabulary_items"][0]))
    monkeypatch.setattr(get_settings(), "app_env", "development")
    with pytest.raises(HTTPException) as error:
        service.record_review_attempt(
            db_session, db_session.get(User, owner), body, DevelopmentScheduler()
        )
    assert (error.value.status_code, error.value.detail) == (
        503,
        "D11_ROUTING_DISABLED",
    )
    monkeypatch.setattr(get_settings(), "app_env", "testing")

    class Invalid(DevelopmentScheduler):
        def schedule(self, context):
            return replace(super().schedule(context), scheduler_type="enhanced_srs")

    with pytest.raises(HTTPException) as error:
        service.record_review_attempt(
            db_session, db_session.get(User, owner), body, Invalid()
        )
    assert (error.value.status_code, error.value.detail) == (500, "D11_OUTPUT_INVALID")
    assert counts(db_session) == (0, 0, 0, 0, 0)


def test_research_predecessor_validator_checks_bound_identity_memory_and_anchor(
    db_session, client
):
    owner, detail, _, _, _, conditions = graph(db_session, client)
    condition = conditions[
        1
    ]  # Storage-only conventional fixture, no engine is executed.
    record = direct_attempt(db_session, owner, detail["vocabulary_items"][1], condition)
    state = {
        "schema_version": 1,
        "scheduler_type": condition.scheduler_type,
        "algorithm_version": condition.algorithm_version,
        "config_version": condition.config_version,
        "memory": {
            "repetition_count": 1,
            "lapse_count": 0,
            "interval_days": 1,
            "ease_factor": 2.5,
        },
    }
    schedule = ReviewSchedule(
        user_id=owner,
        vocabulary_item_id=record.vocabulary_item_id,
        attempt_id=record.id,
        scheduler_type=condition.scheduler_type,
        algorithm_version=condition.algorithm_version,
        interval_seconds=86400,
        due_at=record.client_interaction_at + timedelta(days=1),
        scheduler_state=state,
    )
    db_session.add(schedule)
    db_session.flush()
    infra = infrastructure()
    prior = infra.Predecessor(record, schedule)
    frozen = infra.validate_research_predecessor(db_session, prior, condition)
    assert frozen.memory.repetition_count == 1
    assert state["memory"]["ease_factor"] == 2.5

    def row(obj):
        return SimpleNamespace(
            **{c.name: getattr(obj, c.name) for c in obj.__table__.columns}
        )

    for changes in (
        {
            "scheduler_state": {
                **state,
                "memory": {**state["memory"], "ease_factor": float("nan")},
            }
        },
        {"scheduler_state": {**state, "config_version": "unknown"}},
        {"due_at": schedule.due_at + timedelta(seconds=1)},
        {"interval_seconds": 600},
        {"user_id": uuid.uuid4()},
    ):
        altered = row(schedule)
        altered.__dict__.update(changes)
        with pytest.raises(HTTPException) as error:
            infra.validate_research_predecessor(
                db_session, infra.Predecessor(record, altered), condition
            )
        assert error.value.status_code == 500
    wrong_answer = row(record)
    wrong_answer.correct = False
    with pytest.raises(HTTPException) as error:
        infra.validate_research_predecessor(
            db_session, infra.Predecessor(wrong_answer, schedule), condition
        )
    assert error.value.detail == "D11_STATE_CORRUPT"


def test_same_learner_different_items_share_the_learner_lock(
    db_session, client, context, monkeypatch
):
    # The lock key is only the owner; this also verifies no item/global key sneaks in.
    infra = infrastructure()
    owner, _, detail = context
    original = infra.acquire_learner_lock
    locked = []

    def observe(db, user_id):
        original(db, user_id)
        locked.append(user_id)

    monkeypatch.setattr(infra, "acquire_learner_lock", observe)
    for word in detail["vocabulary_items"]:
        service.record_review_attempt(
            db_session,
            db_session.get(User, owner),
            ReviewAttemptCreate(**attempt(word)),
        )
    assert locked == [owner, owner]
    assert counts(db_session) == (2, 2, 2, 2, 4)


def test_arbitrary_integrity_error_is_not_reinterpreted_as_duplicate(
    db_session, client, context, monkeypatch
):
    owner, _, detail = context
    infra = infrastructure()
    lookup = infra.accepted_result
    lookups = []

    def spy(*args):
        lookups.append(True)
        return lookup(*args)

    def fail(**kwargs):
        # Real unrelated unique violation after schedule insertion, before commit.
        kwargs["db"].execute(
            text("""INSERT INTO review_schedules
            (id,user_id,vocabulary_item_id,attempt_id,scheduler_type,algorithm_version,
             interval_seconds,due_at,scheduler_state,updated_at)
            SELECT :id,user_id,vocabulary_item_id,attempt_id,scheduler_type,algorithm_version,
             interval_seconds,due_at,scheduler_state,updated_at FROM review_schedules"""),
            {"id": uuid.uuid4()},
        )

    monkeypatch.setattr(infra, "accepted_result", spy)
    monkeypatch.setattr(service, "record_research_event", fail)
    with pytest.raises(IntegrityError) as error:
        service.record_review_attempt(
            db_session,
            db_session.get(User, owner),
            ReviewAttemptCreate(**attempt(detail["vocabulary_items"][0])),
        )
    assert error.value.orig.diag.constraint_name == "uq_review_schedule_attempt"
    assert (
        len(lookups) == 2
    )  # first replay + post-lock replay; no generic recovery lookup
    assert counts(db_session) == (0, 0, 0, 0, 0)
