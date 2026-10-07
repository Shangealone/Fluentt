"""D7 eligibility and current-state tests against real PostgreSQL."""

import copy
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier

import pytest
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.security import create_access_token
from app.content.service import import_content_data
from app.reviews import eligibility
from app.reviews.models import (
    CurrentReviewSchedule,
    ReviewAttempt,
    ReviewSchedule,
    ReviewSession,
)
from app.reviews.schemas import ReviewAttemptCreate
from app.reviews.service import record_review_attempt
from app.scheduling.development import DevelopmentScheduler
from tests.content.test_provenance import DATA, attempt


def make_review_context(db_session, client):
    user = User(
        email="due@example.test",
        password_hash="mock",
        participant_code="P_D7",
        must_change_password=False,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    import_content_data(db_session, copy.deepcopy(DATA))
    headers = {"Authorization": f"Bearer {create_access_token(str(user.id))}"}
    lesson_id = DATA["lessons"][0]["id"]
    detail = client.get(f"/content/lessons/{lesson_id}", headers=headers).json()
    return user.id, headers, detail


@pytest.fixture
def review_context(db_session, client):
    return make_review_context(db_session, client)


def test_first_acceptance_establishes_current_state(db_session, client, review_context):
    user_id, headers, detail = review_context
    result = client.post(
        "/reviews/attempts",
        json=attempt(detail["vocabulary_items"][0]),
        headers=headers,
    )
    assert result.status_code == 200
    assert inspect(db_session.bind).has_table("current_review_schedules")
    current = db_session.get(
        CurrentReviewSchedule, (user_id, uuid.UUID(detail["vocabulary_items"][0]["id"]))
    )
    schedule = db_session.get(ReviewSchedule, current.schedule_id)
    assert str(schedule.attempt_id) == result.json()["id"]
    assert db_session.query(ReviewSchedule).count() == 1


def test_never_reviewed_items_have_explicit_server_eligibility(client, review_context):
    _, headers, detail = review_context
    result = client.get(
        "/reviews/eligible-items",
        params={
            "lesson_id": detail["id"],
            "content_release_id": detail["content_release_id"],
        },
        headers=headers,
    )
    assert result.status_code == 200
    assert result.json()["content_release_id"] == detail["content_release_id"]
    assert [row["eligibility"] for row in result.json()["items"]] == ["new", "new"]
    assert all(row["current_schedule"] is None for row in result.json()["items"])


def eligible(client, headers, detail, **extra):
    return client.get(
        "/reviews/eligible-items",
        params={
            "lesson_id": detail["id"],
            "content_release_id": detail["content_release_id"],
            **extra,
        },
        headers=headers,
    )


def accept(client, headers, word, **overrides):
    payload = {**attempt(word), **overrides}
    response = client.post("/reviews/attempts", json=payload, headers=headers)
    assert response.status_code == 200
    return payload, response.json()


def history(db):
    return [
        dict(row)
        for row in db.execute(
            text("SELECT * FROM review_schedules ORDER BY id")
        ).mappings()
    ]


def test_later_acceptance_supersedes_only_pointer_and_replay_returns_original(
    db_session, client, review_context
):
    user_id, headers, detail = review_context
    word = detail["vocabulary_items"][0]
    first_payload, first = accept(client, headers, word)
    original = history(db_session)
    _, second = accept(
        client,
        headers,
        word,
        correct=True,
        client_interaction_at="2024-01-01T00:00:00Z",
    )
    db_session.expire_all()
    current = db_session.get(CurrentReviewSchedule, (user_id, uuid.UUID(word["id"])))
    assert (
        str(db_session.get(ReviewSchedule, current.schedule_id).attempt_id)
        == second["id"]
    )
    assert db_session.query(ReviewSchedule).count() == 2
    assert all(row in history(db_session) for row in original)
    current_id = current.schedule_id
    for path, body in [
        ("/reviews/attempts", first_payload),
        ("/sync/review-events", {"events": [first_payload]}),
    ]:
        response = client.post(path, json=body, headers=headers)
        assert response.status_code == 200
        result = (
            response.json()
            if path.endswith("attempts")
            else response.json()["accepted_events"][0]
        )
        assert result == first
        db_session.expire_all()
        assert (
            db_session.get(
                CurrentReviewSchedule, (user_id, uuid.UUID(word["id"]))
            ).schedule_id
            == current_id
        )
    assert db_session.query(ReviewSchedule).count() == 2


@pytest.mark.parametrize("offset", [-1, 0, 1])
def test_due_boundary_uses_backend_time(
    db_session, client, review_context, monkeypatch, offset
):
    _, headers, detail = review_context
    now = datetime(2030, 1, 1, tzinfo=UTC)
    monkeypatch.setattr(eligibility, "backend_now", lambda: now)
    interaction = (
        now
        - timedelta(seconds=DevelopmentScheduler.INCORRECT_INTERVAL_SECONDS)
        + timedelta(seconds=offset)
    )
    _, accepted = accept(
        client,
        headers,
        detail["vocabulary_items"][0],
        client_interaction_at=interaction.isoformat(),
    )
    response = eligible(client, headers, detail, device_now="2099-01-01T00:00:00Z")
    assert response.status_code == 200
    rows = response.json()["items"]
    assert datetime.fromisoformat(response.json()["evaluated_at"]) == now
    scheduled = [
        row
        for row in rows
        if row["vocabulary_item"]["id"] == detail["vocabulary_items"][0]["id"]
    ]
    assert bool(scheduled) == (offset <= 0)
    if scheduled:
        assert scheduled[0]["eligibility"] == "due"
        assert (
            scheduled[0]["current_schedule"]["next_interval_seconds"]
            == accepted["next_interval_seconds"]
        )
        assert (
            scheduled[0]["current_schedule"]["next_due_at"] == accepted["next_due_at"]
        )
    assert rows[-1]["eligibility"] == "new"


def test_other_learner_and_other_item_have_independent_state(
    db_session, client, review_context, monkeypatch
):
    user_id, headers, detail = review_context
    monkeypatch.setattr(
        eligibility, "backend_now", lambda: datetime(2025, 1, 1, tzinfo=UTC)
    )
    other = User(
        email="other-due@example.test",
        password_hash="mock",
        participant_code="P_D7_B",
        must_change_password=False,
        is_active=True,
    )
    db_session.add(other)
    db_session.commit()
    other_headers = {"Authorization": f"Bearer {create_access_token(str(other.id))}"}
    accept(
        client,
        headers,
        detail["vocabulary_items"][0],
        client_interaction_at="2099-01-01T00:00:00Z",
    )
    assert [
        row["vocabulary_item"]["id"]
        for row in eligible(client, headers, detail).json()["items"]
    ] == [detail["vocabulary_items"][1]["id"]]
    assert [
        row["eligibility"]
        for row in eligible(client, other_headers, detail).json()["items"]
    ] == ["new", "new"]
    accept(client, other_headers, detail["vocabulary_items"][0])
    accept(client, headers, detail["vocabulary_items"][1])
    assert db_session.query(CurrentReviewSchedule).count() == 3
    assert (
        db_session.query(CurrentReviewSchedule).filter_by(user_id=user_id).count() == 2
    )


def test_constraints_reject_duplicate_current_and_wrong_owner_item(
    db_session, client, review_context
):
    user_id, headers, detail = review_context
    accept(client, headers, detail["vocabulary_items"][0])
    current = db_session.scalars(select(CurrentReviewSchedule)).one()
    for owner, item in [
        (user_id, current.vocabulary_item_id),
        (uuid.uuid4(), current.vocabulary_item_id),
        (user_id, uuid.UUID(detail["vocabulary_items"][1]["id"])),
    ]:
        with pytest.raises(IntegrityError), db_session.begin_nested():
            db_session.execute(
                text(
                    "INSERT INTO current_review_schedules (user_id, vocabulary_item_id, schedule_id) VALUES (:u,:v,:s)"
                ),
                {"u": owner, "v": item, "s": current.schedule_id},
            )
    assert db_session.query(CurrentReviewSchedule).count() == 1


def test_release_change_preserves_logical_schedule_and_history(
    db_session, client, review_context, monkeypatch
):
    _, headers, old = review_context
    monkeypatch.setattr(
        eligibility, "backend_now", lambda: datetime(2025, 1, 1, tzinfo=UTC)
    )
    accept(
        client,
        headers,
        old["vocabulary_items"][0],
        client_interaction_at="2099-01-01T00:00:00Z",
    )
    previous_history = history(db_session)
    previous_attempt = (
        db_session.execute(text("SELECT * FROM review_attempts")).mappings().one()
    )
    changed = copy.deepcopy(DATA)
    changed["content_version"] = "arbitrary-lower-label"
    changed["lessons"][0]["vocabulary_items"][0]["term"] = "hi"
    import_content_data(db_session, changed)
    new = client.get(f"/content/lessons/{old['id']}", headers=headers).json()
    assert new["content_release_id"] != old["content_release_id"]
    for detail in [old, new]:
        response = eligible(client, headers, detail)
        assert response.status_code == 200
        assert response.json()["content_release_id"] == detail["content_release_id"]
        assert [row["vocabulary_item"]["id"] for row in response.json()["items"]] == [
            old["vocabulary_items"][1]["id"]
        ]
    assert history(db_session) == previous_history
    assert dict(
        db_session.execute(text("SELECT * FROM review_attempts")).mappings().one()
    ) == dict(previous_attempt)
    old_item = eligible(client, headers, old).json()["items"][0]["vocabulary_item"]
    _, saved = accept(client, headers, old_item)
    assert saved["content_revision_id"] == old_item["content_revision_id"]
    assert saved["content_release_id"] == old["content_release_id"]
    unknown = {**old, "content_release_id": str(uuid.uuid4())}
    assert eligible(client, headers, unknown).status_code == 404


def test_missing_pointer_with_history_is_unavailable_not_new(
    db_session, client, review_context
):
    _, headers, detail = review_context
    accept(client, headers, detail["vocabulary_items"][0])
    db_session.execute(
        text("DELETE FROM current_review_schedules")
    )  # Explicit test corruption, never a production repair.
    db_session.commit()
    assert eligible(client, headers, detail).status_code == 503


def test_failed_acceptance_rolls_back_history_ledger_and_current(
    db_session, client, review_context, monkeypatch
):
    from app.reviews import service

    user_id, headers, detail = review_context
    accept(client, headers, detail["vocabulary_items"][0])
    original = history(db_session)
    current_id = db_session.scalars(select(CurrentReviewSchedule.schedule_id)).one()

    def fail_logging(**kwargs):
        raise RuntimeError("Injected transaction failure")

    monkeypatch.setattr(service, "record_research_event", fail_logging)
    with pytest.raises(RuntimeError, match="Injected transaction failure"):
        record_review_attempt(
            db_session,
            db_session.get(User, user_id),
            ReviewAttemptCreate(**attempt(detail["vocabulary_items"][0])),
        )
    assert history(db_session) == original
    assert (
        db_session.scalars(select(CurrentReviewSchedule.schedule_id)).one()
        == current_id
    )
    assert (
        db_session.execute(
            text("SELECT count(*) FROM accepted_client_events")
        ).scalar_one()
        == 1
    )


def test_one_historical_schedule_per_attempt_is_database_enforced(
    db_session, client, review_context
):
    _, headers, detail = review_context
    accept(client, headers, detail["vocabulary_items"][0])
    original = db_session.scalars(select(ReviewSchedule)).one()
    duplicate = {
        column.name: getattr(original, column.name)
        for column in ReviewSchedule.__table__.columns
    }
    duplicate["id"] = uuid.uuid4()
    with pytest.raises(IntegrityError), db_session.begin_nested():
        db_session.add(ReviewSchedule(**duplicate))
        db_session.flush()
    assert db_session.query(ReviewSchedule).count() == 1


@pytest.mark.parametrize("duplicate", [False, True])
def test_postgresql_concurrent_acceptance_has_one_current_schedule(
    db_session, review_context, duplicate
):
    user_id, _, detail = review_context
    session = ReviewSession(user_id=user_id, client_session_id=uuid.uuid4())
    db_session.add(session)
    db_session.commit()
    payload = {
        **attempt(detail["vocabulary_items"][0]),
        "session_id": str(session.id),
        "client_session_id": str(session.client_session_id),
    }
    second = payload if duplicate else {**payload, "client_event_id": str(uuid.uuid4())}
    barrier = Barrier(2, timeout=10)

    class ConcurrentScheduler(DevelopmentScheduler):
        def schedule(self, context):
            barrier.wait()
            return super().schedule(context)

    def worker(body):
        with Session(db_session.bind) as db:
            user = db.get(User, user_id)
            accepted, scheduled = record_review_attempt(
                db, user, ReviewAttemptCreate(**body), ConcurrentScheduler()
            )
            return accepted.id, scheduled.id

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(worker, body) for body in [payload, second]]
        results = [future.result(timeout=20) for future in futures]
    db_session.expire_all()
    assert db_session.query(ReviewAttempt).count() == (1 if duplicate else 2)
    assert db_session.query(ReviewSchedule).count() == (1 if duplicate else 2)
    current = db_session.scalars(select(CurrentReviewSchedule)).one()
    assert current.schedule_id in {schedule_id for _, schedule_id in results}
    assert len(set(results)) == (1 if duplicate else 2)
