import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.security import create_access_token
from app.content.models import Language, Lesson, VocabularyItem
from app.research_logging.models import ResearchEvent
from app.reviews.models import ReviewAttempt, ReviewSchedule
from app.sync.models import AcceptedClientEvent


@pytest.fixture
def learner_a(db_session: Session) -> tuple[User, dict[str, str]]:
    user = User(
        email="learner_a@example.com",
        password_hash="mock_hash_a",
        participant_code="P_SYNC_A",
        must_change_password=False,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(str(user.id))
    return user, {"Authorization": f"Bearer {token}"}


@pytest.fixture
def learner_b(db_session: Session) -> tuple[User, dict[str, str]]:
    user = User(
        email="learner_b@example.com",
        password_hash="mock_hash_b",
        participant_code="P_SYNC_B",
        must_change_password=False,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(str(user.id))
    return user, {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_vocab(db_session: Session) -> VocabularyItem:
    lang = Language(code="fil", name="Tagalog", is_active=True)
    db_session.add(lang)
    db_session.commit()

    lesson = Lesson(
        language_code="fil",
        title="Sync Lesson",
        content_version="v0.1",
        sort_order=1,
        is_active=True,
    )
    db_session.add(lesson)
    db_session.commit()

    item = VocabularyItem(
        lesson_id=lesson.id,
        term="Kumusta",
        definition="Hello / How are you",
        example_sentence="Kumusta ka?",
        difficulty="easy",
        content_version="v0.1",
        sort_order=1,
        is_active=True,
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture
def inactive_vocab(db_session: Session, sample_vocab: VocabularyItem) -> VocabularyItem:
    item = VocabularyItem(
        lesson_id=sample_vocab.lesson_id,
        term="Luma",
        definition="Old",
        example_sentence="Lumang salita.",
        difficulty="hard",
        content_version="v0.1",
        sort_order=2,
        is_active=False,
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


def test_sync_review_events_success(
    client: TestClient,
    learner_a: tuple[User, dict[str, str]],
    sample_vocab: VocabularyItem,
) -> None:
    _, headers = learner_a
    client_event_id = str(uuid.uuid4())
    client_session_id = str(uuid.uuid4())

    payload = {
        "events": [
            {
                "client_event_id": client_event_id,
                "client_session_id": client_session_id,
                "vocabulary_item_id": str(sample_vocab.id),
                "correct": True,
                "response_time_ms": 1100,
                "client_interaction_at": datetime.now(UTC).isoformat(),
                "device_platform": "android",
                "application_version": "1.0.0",
            }
        ]
    }

    response = client.post("/sync/review-events", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "accepted_events" in data
    assert len(data["accepted_events"]) == 1
    assert data["accepted_events"][0]["client_event_id"] == client_event_id


def test_sync_idempotent_replay_same_client_event_id(
    client: TestClient,
    learner_a: tuple[User, dict[str, str]],
    sample_vocab: VocabularyItem,
    db_session: Session,
) -> None:
    _, headers = learner_a
    client_event_id = str(uuid.uuid4())
    client_session_id = str(uuid.uuid4())

    payload = {
        "events": [
            {
                "client_event_id": client_event_id,
                "client_session_id": client_session_id,
                "vocabulary_item_id": str(sample_vocab.id),
                "correct": True,
                "response_time_ms": 2000,
                "client_interaction_at": datetime.now(UTC).isoformat(),
                "device_platform": "android",
                "application_version": "1.0.0",
            }
        ]
    }

    res1 = client.post("/sync/review-events", json=payload, headers=headers)
    res2 = client.post("/sync/review-events", json=payload, headers=headers)

    assert res1.status_code == 200
    assert res2.status_code == 200
    attempt_id_1 = res1.json()["accepted_events"][0]["id"]
    attempt_id_2 = res2.json()["accepted_events"][0]["id"]
    assert attempt_id_1 == attempt_id_2

    # Database checks: exactly 1 attempt, 1 accepted client event, 1 REVIEW_ANSWERED
    attempts = (
        db_session.query(ReviewAttempt)
        .filter_by(client_event_id=uuid.UUID(client_event_id))
        .all()
    )
    assert len(attempts) == 1

    accepted_records = (
        db_session.query(AcceptedClientEvent)
        .filter_by(client_event_id=uuid.UUID(client_event_id))
        .all()
    )
    assert len(accepted_records) == 1

    research_events = (
        db_session.query(ResearchEvent).filter_by(event_type="REVIEW_ANSWERED").all()
    )
    matching_events = [
        e
        for e in research_events
        if e.payload.get("client_event_id") == client_event_id
    ]
    assert len(matching_events) == 1


def test_lost_acknowledgement_online_then_sync_retry(
    client: TestClient,
    learner_a: tuple[User, dict[str, str]],
    sample_vocab: VocabularyItem,
    db_session: Session,
) -> None:
    """Clarification 3: Online submission accepted, acknowledgement lost, retry via sync.

    Client submits online -> server accepts E -> client lost response -> sync retries E.
    Assert: exactly 1 ReviewAttempt, 1 accepted client event, 1 REVIEW_ANSWERED research event,
    and identical attempt ID returned.
    """
    _, headers = learner_a
    client_event_id = str(uuid.uuid4())
    client_session_id = str(uuid.uuid4())

    single_attempt_payload = {
        "client_event_id": client_event_id,
        "client_session_id": client_session_id,
        "vocabulary_item_id": str(sample_vocab.id),
        "correct": True,
        "response_time_ms": 1350,
        "client_interaction_at": datetime.now(UTC).isoformat(),
        "device_platform": "android",
        "application_version": "1.0.0",
    }

    # Step 1: Online submission succeeds on server
    online_res = client.post(
        "/reviews/attempts", json=single_attempt_payload, headers=headers
    )
    assert online_res.status_code == 200
    online_attempt_id = online_res.json()["id"]

    # Step 2: Client simulates lost response -> falls back to offline queue -> sync worker retries
    sync_payload = {"events": [single_attempt_payload]}
    sync_res = client.post("/sync/review-events", json=sync_payload, headers=headers)
    assert sync_res.status_code == 200
    sync_attempt_id = sync_res.json()["accepted_events"][0]["id"]
    assert sync_attempt_id == online_attempt_id

    # Step 3: Verify single ReviewAttempt and single REVIEW_ANSWERED in database
    attempts = (
        db_session.query(ReviewAttempt)
        .filter_by(client_event_id=uuid.UUID(client_event_id))
        .all()
    )
    assert len(attempts) == 1

    accepted_records = (
        db_session.query(AcceptedClientEvent)
        .filter_by(client_event_id=uuid.UUID(client_event_id))
        .all()
    )
    assert len(accepted_records) == 1

    research_events = (
        db_session.query(ResearchEvent).filter_by(event_type="REVIEW_ANSWERED").all()
    )
    matching_events = [
        e
        for e in research_events
        if e.payload.get("client_event_id") == client_event_id
    ]
    assert len(matching_events) == 1


def test_partial_batch_commits_early_event_and_single_event_replay_is_idempotent(
    client: TestClient,
    learner_a: tuple[User, dict[str, str]],
    sample_vocab: VocabularyItem,
    inactive_vocab: VocabularyItem,
    db_session: Session,
) -> None:
    user, headers = learner_a
    session_id = str(uuid.uuid4())

    def event(vocabulary_id: uuid.UUID) -> dict:
        return {
            "client_event_id": str(uuid.uuid4()),
            "client_session_id": session_id,
            "vocabulary_item_id": str(vocabulary_id),
            "correct": True,
            "response_time_ms": 1234,
            "client_interaction_at": datetime.now(UTC).isoformat(),
            "device_platform": "android",
            "application_version": "1.0.0",
        }

    first, invalid, later = (
        event(sample_vocab.id),
        event(inactive_vocab.id),
        event(sample_vocab.id),
    )
    batch = client.post(
        "/sync/review-events", json={"events": [first, invalid, later]}, headers=headers
    )
    assert batch.status_code == 400
    early_attempt = db_session.query(ReviewAttempt).filter_by(user_id=user.id).one()
    early_id = str(early_attempt.id)
    assert str(early_attempt.client_event_id) == first["client_event_id"]

    # An interrupted client's unknown acknowledgement is reconciled with the
    # same UUID. The permanent event is isolated; later valid work gets a turn.
    for payload, expected_status in [(first, 200), (invalid, 400), (later, 200)]:
        result = client.post(
            "/sync/review-events", json={"events": [payload]}, headers=headers
        )
        assert result.status_code == expected_status
        if payload is first:
            assert result.json()["accepted_events"][0]["id"] == early_id

    assert db_session.query(ReviewAttempt).filter_by(user_id=user.id).count() == 2
    assert db_session.query(ReviewSchedule).filter_by(user_id=user.id).count() == 2
    assert db_session.query(AcceptedClientEvent).filter_by(user_id=user.id).count() == 2
    for event_type in ["REVIEW_ANSWERED", "REVIEW_COMPLETED"]:
        assert (
            db_session.query(ResearchEvent)
            .filter_by(user_id=user.id, event_type=event_type)
            .count()
            == 2
        )


def test_cross_user_client_event_id_isolation(
    client: TestClient,
    learner_a: tuple[User, dict[str, str]],
    learner_b: tuple[User, dict[str, str]],
    sample_vocab: VocabularyItem,
    db_session: Session,
) -> None:
    """Clarification 2: UNIQUE (user_id, client_event_id) scopes idempotency to user.

    User B presenting the same UUID value must never retrieve User A's data,
    and User B must receive their own distinct ReviewAttempt.
    """
    user_a, headers_a = learner_a
    user_b, headers_b = learner_b

    shared_uuid_str = str(uuid.uuid4())
    session_a = str(uuid.uuid4())
    session_b = str(uuid.uuid4())

    payload_a = {
        "events": [
            {
                "client_event_id": shared_uuid_str,
                "client_session_id": session_a,
                "vocabulary_item_id": str(sample_vocab.id),
                "correct": True,
                "response_time_ms": 1000,
                "client_interaction_at": datetime.now(UTC).isoformat(),
                "device_platform": "android",
                "application_version": "1.0.0",
            }
        ]
    }

    payload_b = {
        "events": [
            {
                "client_event_id": shared_uuid_str,
                "client_session_id": session_b,
                "vocabulary_item_id": str(sample_vocab.id),
                "correct": False,
                "response_time_ms": 2500,
                "client_interaction_at": datetime.now(UTC).isoformat(),
                "device_platform": "android",
                "application_version": "1.0.0",
            }
        ]
    }

    res_a = client.post("/sync/review-events", json=payload_a, headers=headers_a)
    assert res_a.status_code == 200
    attempt_a_id = res_a.json()["accepted_events"][0]["id"]

    res_b = client.post("/sync/review-events", json=payload_b, headers=headers_b)
    assert res_b.status_code == 200
    attempt_b_id = res_b.json()["accepted_events"][0]["id"]

    # Must be two distinct attempts for distinct users
    assert attempt_a_id != attempt_b_id

    # User B's response must reflect User B's correctness (False), NOT User A's (True)
    assert res_b.json()["accepted_events"][0]["correct"] is False
    assert res_a.json()["accepted_events"][0]["correct"] is True

    # Check database: 2 accepted client events, one for each user
    accepted = (
        db_session.query(AcceptedClientEvent)
        .filter_by(client_event_id=uuid.UUID(shared_uuid_str))
        .all()
    )
    assert len(accepted) == 2
    user_ids = {rec.user_id for rec in accepted}
    assert user_a.id in user_ids
    assert user_b.id in user_ids


def test_sync_inactive_or_unknown_vocabulary_fails_without_accepted_event(
    client: TestClient,
    learner_a: tuple[User, dict[str, str]],
    inactive_vocab: VocabularyItem,
    db_session: Session,
) -> None:
    _, headers = learner_a
    client_event_id = str(uuid.uuid4())

    payload = {
        "events": [
            {
                "client_event_id": client_event_id,
                "client_session_id": str(uuid.uuid4()),
                "vocabulary_item_id": str(inactive_vocab.id),
                "correct": True,
                "response_time_ms": 1200,
                "client_interaction_at": datetime.now(UTC).isoformat(),
                "device_platform": "android",
                "application_version": "1.0.0",
            }
        ]
    }

    response = client.post("/sync/review-events", json=payload, headers=headers)
    assert response.status_code in (400, 404, 422)

    # No AcceptedClientEvent should exist
    accepted = (
        db_session.query(AcceptedClientEvent)
        .filter_by(client_event_id=uuid.UUID(client_event_id))
        .all()
    )
    assert len(accepted) == 0


def test_sync_review_events_accepts_mobile_payload(
    client: TestClient,
    learner_a: tuple[User, dict[str, str]],
    sample_vocab: VocabularyItem,
) -> None:
    _, headers = learner_a
    client_event_id = str(uuid.uuid4())
    payload = {
        "events": [
            {
                "client_event_id": client_event_id,
                "session_id": str(uuid.uuid4()),
                "vocabulary_item_id": str(sample_vocab.id),
                "response_time_ms": 1200,
                "performance_rating": "good",
                "created_at": datetime.now(UTC).isoformat(),
            }
        ]
    }
    response = client.post("/sync/review-events", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["accepted_events"]) == 1
    assert data["accepted_events"][0]["client_event_id"] == client_event_id
