import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.security import create_access_token
from app.content.models import Language, Lesson, VocabularyItem
from app.reviews.models import ReviewAttempt, ReviewSession


@pytest.fixture
def learner_one(db_session: Session) -> tuple[User, dict[str, str]]:
    user = User(
        email="learner_one@example.com",
        password_hash="mock_hash_1",
        participant_code="P_PROG_1",
        must_change_password=False,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(str(user.id))
    return user, {"Authorization": f"Bearer {token}"}


@pytest.fixture
def learner_two(db_session: Session) -> tuple[User, dict[str, str]]:
    user = User(
        email="learner_two@example.com",
        password_hash="mock_hash_2",
        participant_code="P_PROG_2",
        must_change_password=False,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(str(user.id))
    return user, {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_items(db_session: Session) -> tuple[VocabularyItem, VocabularyItem]:
    lang = Language(code="en", name="English", is_active=True)
    db_session.add(lang)
    db_session.commit()

    lesson = Lesson(
        language_code="en",
        title="Analytics Lesson",
        content_version="v0.1",
        sort_order=1,
        is_active=True,
    )
    db_session.add(lesson)
    db_session.commit()

    item1 = VocabularyItem(
        lesson_id=lesson.id,
        term="serendipity",
        definition="pleasant surprise",
        example_sentence="It was pure serendipity.",
        content_version="v0.1",
        sort_order=1,
        is_active=True,
    )
    item2 = VocabularyItem(
        lesson_id=lesson.id,
        term="solitude",
        definition="peaceful state of being alone",
        example_sentence="She enjoyed the quiet solitude.",
        content_version="v0.1",
        sort_order=2,
        is_active=True,
    )
    db_session.add_all([item1, item2])
    db_session.commit()
    db_session.refresh(item1)
    db_session.refresh(item2)
    return item1, item2


def test_progress_empty_for_new_user(
    client: TestClient,
    learner_one: tuple[User, dict[str, str]],
):
    _, headers = learner_one
    resp = client.get("/analytics/progress", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_reviews"] == 0
    assert data["unique_vocabulary_reviewed"] == 0
    assert data["streak_days"] == 0
    assert data["performance_breakdown"] == {"again": 0, "hard": 0, "good": 0, "easy": 0}
    assert data["recent_activity"] == []


def test_progress_aggregates_attempts_and_isolates_users(
    client: TestClient,
    db_session: Session,
    learner_one: tuple[User, dict[str, str]],
    learner_two: tuple[User, dict[str, str]],
    sample_items: tuple[VocabularyItem, VocabularyItem],
):
    user_a, headers_a = learner_one
    _, headers_b = learner_two
    item1, item2 = sample_items

    # Create session for user A
    sess_a = ReviewSession(
        user_id=user_a.id,
        client_session_id=str(uuid.uuid4()),
    )
    db_session.add(sess_a)
    db_session.commit()
    db_session.refresh(sess_a)

    now = datetime.now(UTC)

    # 3 attempts for user A
    attempt1 = ReviewAttempt(
        session_id=sess_a.id,
        user_id=user_a.id,
        client_event_id=uuid.uuid4(),
        vocabulary_item_id=item1.id,
        correct=True,
        response_time_ms=1200,
        scheduler_type="development",
        algorithm_version="dev-0.1",
        client_interaction_at=now - timedelta(hours=2),
        server_acceptance_at=now - timedelta(hours=2),
        device_platform="android",
        application_version="v0.1",
        submitted_answer="good",
    )
    attempt2 = ReviewAttempt(
        session_id=sess_a.id,
        user_id=user_a.id,
        client_event_id=uuid.uuid4(),
        vocabulary_item_id=item1.id,
        correct=True,
        response_time_ms=900,
        scheduler_type="development",
        algorithm_version="dev-0.1",
        client_interaction_at=now - timedelta(hours=1),
        server_acceptance_at=now - timedelta(hours=1),
        device_platform="android",
        application_version="v0.1",
        submitted_answer="easy",
    )
    attempt3 = ReviewAttempt(
        session_id=sess_a.id,
        user_id=user_a.id,
        client_event_id=uuid.uuid4(),
        vocabulary_item_id=item2.id,
        correct=False,
        response_time_ms=2500,
        scheduler_type="development",
        algorithm_version="dev-0.1",
        client_interaction_at=now,
        server_acceptance_at=now,
        device_platform="android",
        application_version="v0.1",
        submitted_answer="again",
    )
    db_session.add_all([attempt1, attempt2, attempt3])
    db_session.commit()

    # User A progress check
    resp_a = client.get("/analytics/progress", headers=headers_a)
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert data_a["total_reviews"] == 3
    assert data_a["unique_vocabulary_reviewed"] == 2
    assert data_a["streak_days"] >= 1
    assert data_a["performance_breakdown"] == {"again": 1, "hard": 0, "good": 1, "easy": 1}
    assert len(data_a["recent_activity"]) == 3
    # Check descending order
    assert data_a["recent_activity"][0]["term"] == "solitude"
    assert data_a["recent_activity"][0]["performance_rating"] == "again"

    # User B progress must be strictly isolated (0 reviews)
    resp_b = client.get("/analytics/progress", headers=headers_b)
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["total_reviews"] == 0
    assert data_b["unique_vocabulary_reviewed"] == 0
    assert data_b["recent_activity"] == []


def test_progress_requires_authentication(client: TestClient):
    resp = client.get("/analytics/progress")
    assert resp.status_code == 401
