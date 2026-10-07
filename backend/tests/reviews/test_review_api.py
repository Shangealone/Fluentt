import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.security import create_access_token
from app.content.models import Language, Lesson, VocabularyItem
from tests.content_helpers import provenance_refs, publish_fixture_item


@pytest.fixture
def auth_headers(db_session: Session) -> dict[str, str]:
    """Create a verified normal learner and return auth headers."""
    user = User(
        email="review_learner@example.com",
        password_hash="mock_hash_for_token_auth",
        participant_code="P_REV_01",
        must_change_password=False,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(str(user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_vocab_item(db_session: Session) -> VocabularyItem:
    """Create sample language, lesson, and active vocabulary item."""
    lang = Language(
        code="fil",
        name="Tagalog",
        is_active=True,
    )
    db_session.add(lang)
    db_session.commit()

    lesson = Lesson(
        language_code="fil",
        title="Greetings",
        content_version="v0.1",
        sort_order=1,
        is_active=True,
    )
    db_session.add(lesson)
    db_session.commit()

    item = VocabularyItem(
        lesson_id=lesson.id,
        term="Salamat",
        definition="Thank you",
        example_sentence="Maraming salamat sa tulong mo.",
        difficulty="easy",
        content_version="v0.1",
        sort_order=1,
        is_active=True,
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    publish_fixture_item(db_session, item)
    return item


@pytest.fixture
def inactive_vocab_item(
    db_session: Session, sample_vocab_item: VocabularyItem
) -> VocabularyItem:
    """Create an inactive vocabulary item."""
    item = VocabularyItem(
        lesson_id=sample_vocab_item.lesson_id,
        term="Hindi Aktibo",
        definition="Inactive word",
        example_sentence="Halimbawang pangungusap.",
        difficulty="hard",
        content_version="v0.1",
        sort_order=2,
        is_active=False,
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    publish_fixture_item(db_session, item)
    return item


def test_create_review_session_success(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    client_session_id = str(uuid.uuid4())
    response = client.post(
        "/reviews/sessions",
        json={"client_session_id": client_session_id},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["client_session_id"] == client_session_id


def test_create_review_session_requires_client_session_id(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.post(
        "/reviews/sessions",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_create_review_session_idempotent_for_same_client_session_id(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    client_session_id = str(uuid.uuid4())
    res1 = client.post(
        "/reviews/sessions",
        json={"client_session_id": client_session_id},
        headers=auth_headers,
    )
    res2 = client.post(
        "/reviews/sessions",
        json={"client_session_id": client_session_id},
        headers=auth_headers,
    )
    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json()["id"] == res2.json()["id"]


def test_response_time_ms_validation_rejects_invalid_values(
    client: TestClient,
    auth_headers: dict[str, str],
    sample_vocab_item: VocabularyItem,
) -> None:
    # 1. Negative response time
    payload_neg = {
        "client_event_id": str(uuid.uuid4()),
        "client_session_id": str(uuid.uuid4()),
        "vocabulary_item_id": str(sample_vocab_item.id),
        **provenance_refs(sample_vocab_item),
        "correct": True,
        "response_time_ms": -100,
        "client_interaction_at": datetime.now(UTC).isoformat(),
        "device_platform": "android",
        "application_version": "1.0.0",
    }
    res_neg = client.post("/reviews/attempts", json=payload_neg, headers=auth_headers)
    assert res_neg.status_code == 422

    # 2. Exceeds software sanity limit (3,600,000 ms)
    payload_huge = dict(payload_neg)
    payload_huge["client_event_id"] = str(uuid.uuid4())
    payload_huge["response_time_ms"] = 3600001
    res_huge = client.post("/reviews/attempts", json=payload_huge, headers=auth_headers)
    assert res_huge.status_code == 422

    # 3. Non-integer response time
    payload_float = dict(payload_neg)
    payload_float["client_event_id"] = str(uuid.uuid4())
    payload_float["response_time_ms"] = 1250.5
    res_float = client.post(
        "/reviews/attempts", json=payload_float, headers=auth_headers
    )
    assert res_float.status_code == 422


def test_submit_review_attempt_persists_attempt_schedule_and_research_events(
    client: TestClient,
    auth_headers: dict[str, str],
    sample_vocab_item: VocabularyItem,
    db_session: Session,
) -> None:
    client_event_id = str(uuid.uuid4())
    client_session_id = str(uuid.uuid4())
    interaction_at = datetime.now(UTC).isoformat()

    payload = {
        "client_event_id": client_event_id,
        "client_session_id": client_session_id,
        "vocabulary_item_id": str(sample_vocab_item.id),
        **provenance_refs(sample_vocab_item),
        "correct": True,
        "response_time_ms": 1420,
        "client_interaction_at": interaction_at,
        "device_platform": "android",
        "application_version": "1.0.0",
        "submitted_answer": "Thank you",
    }

    response = client.post("/reviews/attempts", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["client_event_id"] == client_event_id
    assert data["scheduler_type"] == "development"
    assert data["algorithm_version"] == "dev-0.1"
    assert data["next_interval_seconds"] == 86400
    assert "next_due_at" in data

    # Verify database persistence
    from app.research_logging.models import ResearchEvent
    from app.reviews.models import ReviewAttempt, ReviewSchedule

    attempt = (
        db_session.query(ReviewAttempt)
        .filter_by(client_event_id=uuid.UUID(client_event_id))
        .first()
    )
    assert attempt is not None
    assert attempt.response_time_ms == 1420
    assert attempt.correct is True
    assert attempt.scheduler_type == "development"
    assert attempt.algorithm_version == "dev-0.1"
    assert attempt.device_platform == "android"

    schedule = db_session.query(ReviewSchedule).filter_by(attempt_id=attempt.id).first()
    assert schedule is not None
    assert schedule.interval_seconds == 86400
    assert schedule.scheduler_type == "development"

    # Research events
    research_events = (
        db_session.query(ResearchEvent)
        .filter_by(user_id=attempt.user_id)
        .order_by(ResearchEvent.created_at.asc())
        .all()
    )
    event_types = [e.event_type for e in research_events]
    assert "REVIEW_ANSWERED" in event_types
    assert "REVIEW_SCHEDULED" in event_types

    # Verify no leaked secrets in research payload
    for event in research_events:
        payload_str = str(event.payload).lower()
        assert "password" not in payload_str
        assert "token" not in payload_str
        assert "jwt" not in payload_str
        assert "secret" not in payload_str


def test_submit_review_attempt_for_inactive_item_fails(
    client: TestClient,
    auth_headers: dict[str, str],
    inactive_vocab_item: VocabularyItem,
) -> None:
    payload = {
        "client_event_id": str(uuid.uuid4()),
        "client_session_id": str(uuid.uuid4()),
        "vocabulary_item_id": str(inactive_vocab_item.id),
        **provenance_refs(inactive_vocab_item),
        "correct": True,
        "response_time_ms": 1200,
        "client_interaction_at": datetime.now(UTC).isoformat(),
        "device_platform": "android",
        "application_version": "1.0.0",
    }
    response = client.post("/reviews/attempts", json=payload, headers=auth_headers)
    assert response.status_code in (400, 404, 422)


def test_submit_review_attempt_idempotent_replay_same_client_event_id(
    client: TestClient,
    auth_headers: dict[str, str],
    sample_vocab_item: VocabularyItem,
    db_session: Session,
) -> None:
    client_event_id = str(uuid.uuid4())
    client_session_id = str(uuid.uuid4())

    payload = {
        "client_event_id": client_event_id,
        "client_session_id": client_session_id,
        "vocabulary_item_id": str(sample_vocab_item.id),
        **provenance_refs(sample_vocab_item),
        "correct": True,
        "response_time_ms": 1500,
        "client_interaction_at": datetime.now(UTC).isoformat(),
        "device_platform": "android",
        "application_version": "1.0.0",
    }

    res1 = client.post("/reviews/attempts", json=payload, headers=auth_headers)
    res2 = client.post("/reviews/attempts", json=payload, headers=auth_headers)

    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json()["id"] == res2.json()["id"]

    from app.research_logging.models import ResearchEvent
    from app.reviews.models import ReviewAttempt
    from app.sync.models import AcceptedClientEvent

    # Exactly 1 ReviewAttempt
    attempts = (
        db_session.query(ReviewAttempt)
        .filter_by(client_event_id=uuid.UUID(client_event_id))
        .all()
    )
    assert len(attempts) == 1

    # Exactly 1 AcceptedClientEvent
    accepted_events = (
        db_session.query(AcceptedClientEvent)
        .filter_by(client_event_id=uuid.UUID(client_event_id))
        .all()
    )
    assert len(accepted_events) == 1

    # Exactly 1 REVIEW_ANSWERED research event
    research_answered = (
        db_session.query(ResearchEvent).filter_by(event_type="REVIEW_ANSWERED").all()
    )
    matching_research = [
        e for e in research_answered if e.review_attempt_id == attempts[0].id
    ]
    assert len(matching_research) == 1


def test_submit_review_attempt_rejects_incomplete_legacy_payload(
    client: TestClient,
    auth_headers: dict[str, str],
    sample_vocab_item: VocabularyItem,
) -> None:
    payload = {
        "client_event_id": str(uuid.uuid4()),
        "session_id": str(uuid.uuid4()),
        "vocabulary_item_id": str(sample_vocab_item.id),
        **provenance_refs(sample_vocab_item),
        "response_time_ms": 1200,
        "performance_rating": "good",
        "created_at": datetime.now(UTC).isoformat(),
    }
    res = client.post("/reviews/attempts", json=payload, headers=auth_headers)
    assert res.status_code == 422
