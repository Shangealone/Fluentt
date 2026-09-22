import copy
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth.service import change_user_password, provision_participant
from app.content.models import Language, Lesson, VocabularyItem
from app.content.service import import_content_data
from app.database.session import SessionLocal
from app.main import app

client = TestClient(app)


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


def test_import_deterministic_and_no_duplicates_and_preserves_version() -> None:
    db = SessionLocal()
    try:
        # Initial import
        import_content_data(db, SAMPLE_DATA)
        assert db.scalar(select(Language).where(Language.code == "en")) is not None

        lessons = list(db.scalars(select(Lesson)).all())
        items = list(db.scalars(select(VocabularyItem)).all())
        assert len(lessons) == 2
        assert len(items) == 3

        lesson1 = db.scalar(
            select(Lesson).where(
                Lesson.id == uuid.UUID("11111111-1111-1111-1111-111111111111")
            )
        )
        assert lesson1 is not None
        assert lesson1.title == "Lesson 1: Active Lesson"
        assert lesson1.content_version == "sample-en-v0.1"

        item1 = db.scalar(
            select(VocabularyItem).where(
                VocabularyItem.id == uuid.UUID("22222222-2222-2222-2222-222222222221")
            )
        )
        assert item1 is not None
        assert item1.definition == "an active term definition"
        assert item1.content_version == "sample-en-v0.1"

        # Re-import with updated mutable fields (title and definition) using identical UUIDs
        updated_data = copy.deepcopy(SAMPLE_DATA)
        updated_data["lessons"][0]["title"] = "Lesson 1: Updated Active Lesson"
        updated_data["lessons"][0]["vocabulary_items"][0]["definition"] = (
            "an updated active definition"
        )

        import_content_data(db, updated_data)

        # Assert no duplicates were created
        assert len(db.scalars(select(Lesson)).all()) == 2
        assert len(db.scalars(select(VocabularyItem)).all()) == 3

        # Assert mutable fields were updated and content_version is preserved
        db.refresh(lesson1)
        db.refresh(item1)
        assert lesson1.title == "Lesson 1: Updated Active Lesson"
        assert lesson1.content_version == "sample-en-v0.1"
        assert item1.definition == "an updated active definition"
        assert item1.content_version == "sample-en-v0.1"
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


def test_get_lessons_excludes_stale_content_version_from_default_feed(
    auth_headers: dict[str, str],
) -> None:
    db = SessionLocal()
    try:
        import_content_data(db, SAMPLE_DATA)

        # Import a newer content version for the same language
        newer_data = {
            "language": {
                "code": "en",
                "name": "English",
                "is_active": True,
            },
            "content_version": "sample-en-v0.2",
            "lessons": [
                {
                    "id": "33333333-3333-3333-3333-333333333331",
                    "title": "Lesson 1: Newer Version",
                    "description": "v0.2 lesson description",
                    "is_active": True,
                    "sort_order": 1,
                    "vocabulary_items": [
                        {
                            "id": "44444444-4444-4444-4444-444444444441",
                            "term": "newer word",
                            "definition": "a v0.2 definition",
                            "example_sentence": "This is newer.",
                            "difficulty": "beginner",
                            "is_active": True,
                            "sort_order": 1,
                        }
                    ],
                }
            ],
        }
        import_content_data(db, newer_data)
    finally:
        db.close()

    # 1. Default learner feed: should ONLY return the latest active content version
    resp = client.get("/content/lessons?language=en", headers=auth_headers)
    assert resp.status_code == 200
    lessons = resp.json()
    assert len(lessons) == 1
    assert lessons[0]["id"] == "33333333-3333-3333-3333-333333333331"
    assert lessons[0]["content_version"] == "sample-en-v0.2"

    # 2. Specific query for the older version returns the older version
    resp_older = client.get(
        "/content/lessons?language=en&content_version=sample-en-v0.1",
        headers=auth_headers,
    )
    assert resp_older.status_code == 200
    older_lessons = resp_older.json()
    assert len(older_lessons) == 1
    assert older_lessons[0]["id"] == "11111111-1111-1111-1111-111111111111"
    assert older_lessons[0]["content_version"] == "sample-en-v0.1"


def test_get_lesson_detail_filters_inactive_items_and_stale_version_items(
    auth_headers: dict[str, str],
) -> None:
    lesson_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    db = SessionLocal()
    try:
        import_content_data(db, SAMPLE_DATA)

        # Manually add an active vocabulary item with a stale/mismatched content_version
        stale_item = VocabularyItem(
            id=uuid.UUID("22222222-2222-2222-2222-222222222229"),
            lesson_id=lesson_id,
            term="stale word",
            definition="a stale version word definition",
            example_sentence="This item has an old content version.",
            difficulty="beginner",
            content_version="sample-en-v0.0",
            is_active=True,
            sort_order=3,
        )
        db.add(stale_item)
        db.commit()
    finally:
        db.close()

    # Active lesson detail: inactive item and stale-version item must be excluded
    resp = client.get(
        f"/content/lessons/{lesson_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    lesson = resp.json()
    assert len(lesson["vocabulary_items"]) == 1
    assert lesson["vocabulary_items"][0]["term"] == "active word"
    assert lesson["vocabulary_items"][0]["content_version"] == "sample-en-v0.1"

    # Inactive lesson returns 404
    resp_inactive = client.get(
        "/content/lessons/11111111-1111-1111-1111-111111111112",
        headers=auth_headers,
    )
    assert resp_inactive.status_code == 404
