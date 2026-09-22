import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.auth.service import change_user_password, provision_participant
from app.content.models import Language, Lesson, VocabularyItem
from app.content.service import import_content_data
from app.database.session import SessionLocal, engine
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_database():
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE vocabulary_items, lessons, languages, learner_profiles, refresh_sessions, users CASCADE;"
            )
        )
    yield
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE vocabulary_items, lessons, languages, learner_profiles, refresh_sessions, users CASCADE;"
            )
        )


@pytest.fixture
def auth_headers() -> dict[str, str]:
    db = SessionLocal()
    try:
        user = provision_participant(
            db,
            email="content_tester@example.test",
            participant_code="P_CONTENT_01",
            temporary_password="InitialPass!1",
        )
        access_tok, _ = change_user_password(
            db,
            user=user,
            current_password="InitialPass!1",
            new_password="NewPermanentPass!123",
        )
        return {"Authorization": f"Bearer {access_tok}"}
    finally:
        db.close()


SAMPLE_DATA = {
    "language": {
        "code": "en",
        "name": "English",
        "is_active": True,
    },
    "content_version": "sample-en-v0.1",
    "lessons": [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "title": "Lesson 1: Active Lesson",
            "description": "Active lesson description",
            "is_active": True,
            "sort_order": 1,
            "vocabulary_items": [
                {
                    "id": "22222222-2222-2222-2222-222222222221",
                    "term": "active word",
                    "definition": "an active term definition",
                    "example_sentence": "This is an active sentence.",
                    "difficulty": "beginner",
                    "category": "basics",
                    "translation": "aktibo",
                    "is_active": True,
                    "sort_order": 1,
                },
                {
                    "id": "22222222-2222-2222-2222-222222222222",
                    "term": "hidden word",
                    "definition": "an inactive term definition",
                    "example_sentence": "This is inactive.",
                    "difficulty": "beginner",
                    "category": "basics",
                    "translation": "nakatago",
                    "is_active": False,
                    "sort_order": 2,
                },
            ],
        },
        {
            "id": "11111111-1111-1111-1111-111111111112",
            "title": "Lesson 2: Inactive Lesson",
            "description": "Inactive lesson description",
            "is_active": False,
            "sort_order": 2,
            "vocabulary_items": [
                {
                    "id": "22222222-2222-2222-2222-222222222223",
                    "term": "hidden lesson word",
                    "definition": "should not appear",
                    "example_sentence": "hidden",
                    "difficulty": "beginner",
                    "is_active": True,
                    "sort_order": 1,
                }
            ],
        },
    ],
}


def test_import_deterministic_and_no_duplicates() -> None:
    db = SessionLocal()
    try:
        # Import once
        import_content_data(db, SAMPLE_DATA)
        assert db.scalar(select(Language).where(Language.code == "en")) is not None
        assert len(db.scalars(select(Lesson)).all()) == 2
        assert len(db.scalars(select(VocabularyItem)).all()) == 3

        # Import again with same data
        import_content_data(db, SAMPLE_DATA)
        assert len(db.scalars(select(Lesson)).all()) == 2
        assert len(db.scalars(select(VocabularyItem)).all()) == 3
    finally:
        db.close()


def test_get_languages_returns_active_only(auth_headers: dict[str, str]) -> None:
    db = SessionLocal()
    try:
        import_content_data(db, SAMPLE_DATA)
        # Add an inactive language
        db.add(Language(code="xx", name="Inactive Lang", is_active=False))
        db.commit()
    finally:
        db.close()

    resp = client.get("/content/languages", headers=auth_headers)
    assert resp.status_code == 200
    languages = resp.json()
    codes = [lang["code"] for lang in languages]
    assert "en" in codes
    assert "xx" not in codes


def test_get_lessons_filters_inactive(auth_headers: dict[str, str]) -> None:
    db = SessionLocal()
    try:
        import_content_data(db, SAMPLE_DATA)
    finally:
        db.close()

    resp = client.get("/content/lessons?language=en", headers=auth_headers)
    assert resp.status_code == 200
    lessons = resp.json()
    assert len(lessons) == 1
    assert lessons[0]["id"] == "11111111-1111-1111-1111-111111111111"
    assert lessons[0]["content_version"] == "sample-en-v0.1"


def test_get_lesson_detail_filters_inactive_items(
    auth_headers: dict[str, str],
) -> None:
    db = SessionLocal()
    try:
        import_content_data(db, SAMPLE_DATA)
    finally:
        db.close()

    # Active lesson
    resp = client.get(
        "/content/lessons/11111111-1111-1111-1111-111111111111",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    lesson = resp.json()
    assert len(lesson["vocabulary_items"]) == 1
    assert lesson["vocabulary_items"][0]["term"] == "active word"

    # Inactive lesson returns 404
    resp_inactive = client.get(
        "/content/lessons/11111111-1111-1111-1111-111111111112",
        headers=auth_headers,
    )
    assert resp_inactive.status_code == 404
