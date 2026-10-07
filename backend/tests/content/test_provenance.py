import copy
import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.auth.models import User
from app.auth.security import create_access_token
from app.content import models
from app.content.service import import_content_data
from app.reviews.models import ReviewAttempt

DATA = {
    "language": {"code": "en", "name": "English", "is_active": True},
    "content_version": "development-content-1",
    "lessons": [
        {
            "id": "11111111-1111-4111-8111-111111111111",
            "title": "Greetings",
            "description": "Current lesson",
            "sort_order": 1,
            "vocabulary_items": [
                {
                    "id": "22222222-2222-4222-8222-222222222222",
                    "term": "hello",
                    "definition": "greeting",
                    "example_sentence": "Hello there.",
                    "difficulty": "hard",
                    "translation": "kumusta",
                    "category": "greetings",
                },
                {
                    "id": "33333333-3333-4333-8333-333333333333",
                    "term": "welcome",
                    "definition": "a greeting",
                    "example_sentence": "Welcome home.",
                },
            ],
        }
    ],
}


@pytest.fixture
def headers(db_session):
    user = User(
        email="provenance@example.test",
        password_hash="mock",
        participant_code="P_D5",
        must_change_password=False,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def served(client, headers):
    result = client.get(f"/content/lessons/{DATA['lessons'][0]['id']}", headers=headers)
    assert result.status_code == 200
    detail = result.json()
    assert detail.get("content_release_id") is not None
    assert detail["vocabulary_items"][0].get("content_revision_id") is not None
    return detail


def attempt(item):
    return {
        "client_event_id": str(uuid.uuid4()),
        "client_session_id": str(uuid.uuid4()),
        "vocabulary_item_id": item["id"],
        "content_revision_id": item["content_revision_id"],
        "content_release_id": item["content_release_id"],
        "correct": False,
        "submitted_answer": "incorrect",
        "response_time_ms": 1234,
        "client_interaction_at": "2025-01-01T11:22:33.456Z",
        "device_platform": "ios",
        "application_version": "1.0.0",
    }


@pytest.fixture
def version_overrides():
    source = copy.deepcopy(DATA)
    source["content_version"] = "release-v1"
    source["lessons"][0]["content_version"] = "lesson-v2"
    source["lessons"][0]["vocabulary_items"][0]["content_version"] = "word-v3"
    return source


def test_published_nested_version_overrides_remain_visible_with_exact_manifest_ids(
    db_session, client, headers, version_overrides
):
    import_content_data(db_session, version_overrides)
    release = db_session.query(models.ContentRelease).one()
    context = release.manifest["lessons"][0]
    assert (
        release.content_version == release.manifest["content_version"] == "release-v1"
    )
    assert context["content_version"] == "lesson-v2"
    member = context["vocabulary_items"][0]
    revision = db_session.get(
        models.VocabularyRevision, uuid.UUID(member["content_revision_id"])
    )
    assert revision.content_version == "word-v3"
    assert (
        db_session.get(models.Lesson, revision.lesson_id).content_version == "lesson-v2"
    )
    assert (
        db_session.get(
            models.VocabularyItem, revision.vocabulary_item_id
        ).content_version
        == "word-v3"
    )

    for query in ["language=en", "language=en&content_version=release-v1"]:
        response = client.get(f"/content/lessons?{query}", headers=headers)
        assert response.status_code == 200
        assert len(response.json()) == 1
        summary = response.json()[0]
        assert summary["id"] == context["id"]
        assert summary["content_version"] == "lesson-v2"
        assert summary["content_release_id"] == str(release.id)
        assert summary["item_count"] == 2

    response = client.get(
        f"/content/lessons/{context['id']}?content_release_id={release.id}",
        headers=headers,
    )
    assert response.status_code == 200
    detail = response.json()
    assert detail["content_version"] == "lesson-v2"
    assert detail["content_release_id"] == str(release.id)
    assert len(detail["vocabulary_items"]) == 2
    item = detail["vocabulary_items"][0]
    assert item["id"] == member["id"]
    assert item["content_revision_id"] == member["content_revision_id"]
    assert item["content_release_id"] == str(release.id)
    assert item["content_version"] == "word-v3"
    assert detail["vocabulary_items"][1]["content_version"] == "lesson-v2"


@pytest.mark.parametrize("endpoint", ["/reviews/attempts", "/sync/review-events"])
def test_review_accepts_exact_published_membership_with_nested_version_overrides(
    db_session, client, headers, version_overrides, endpoint
):
    import_content_data(db_session, version_overrides)
    release = db_session.query(models.ContentRelease).one()
    member = release.manifest["lessons"][0]["vocabulary_items"][0]
    payload = attempt({**member, "content_release_id": str(release.id)})
    body = {"events": [payload]} if endpoint.startswith("/sync") else payload
    response = client.post(endpoint, json=body, headers=headers)
    assert response.status_code == 200
    result = response.json()
    if endpoint.startswith("/sync"):
        result = result["accepted_events"][0]
    row = db_session.get(ReviewAttempt, uuid.UUID(result["id"]))
    assert str(row.content_revision_id) == member["content_revision_id"]
    assert row.content_release_id == release.id
    assert row.content_revision.content_version == "word-v3"
    assert row.content_release.manifest["lessons"][0]["content_version"] == "lesson-v2"


def test_historical_override_membership_survives_new_publication_and_rejects_wrong_release(
    db_session, client, headers, version_overrides
):
    import_content_data(db_session, version_overrides)
    original = served(client, headers)
    assert len(original["vocabulary_items"]) == 2
    old_item = original["vocabulary_items"][0]
    newer = copy.deepcopy(version_overrides)
    newer["content_version"] = "release-v4"
    newer["lessons"][0]["content_version"] = "lesson-v5"
    newer["lessons"][0]["vocabulary_items"][0]["content_version"] = "word-v6"
    newer["lessons"][0]["vocabulary_items"][0]["definition"] = "new meaning"
    import_content_data(db_session, newer)
    current = served(client, headers)
    assert current["content_release_id"] != original["content_release_id"]
    assert current["vocabulary_items"][0]["content_version"] == "word-v6"
    historical = client.get(
        f"/content/lessons/{original['id']}?content_release_id={original['content_release_id']}",
        headers=headers,
    )
    assert historical.status_code == 200
    assert historical.json() == original
    listed = client.get(
        "/content/lessons?language=en&content_version=release-v1", headers=headers
    )
    assert listed.status_code == 200
    assert listed.json()[0]["content_release_id"] == original["content_release_id"]
    invalid = {**attempt(old_item), "content_release_id": current["content_release_id"]}
    assert (
        client.post("/reviews/attempts", json=invalid, headers=headers).status_code
        == 400
    )
    assert db_session.query(ReviewAttempt).count() == 0
    accepted = client.post("/reviews/attempts", json=attempt(old_item), headers=headers)
    assert accepted.status_code == 200
    assert accepted.json()["content_revision_id"] == old_item["content_revision_id"]
    assert accepted.json()["content_release_id"] == original["content_release_id"]


@pytest.mark.parametrize("inactive", ["language", "lesson", "item"])
def test_nested_version_overrides_do_not_bypass_released_activation(
    db_session, client, headers, version_overrides, inactive
):
    if inactive == "language":
        version_overrides["language"]["is_active"] = False
    elif inactive == "lesson":
        version_overrides["lessons"][0]["is_active"] = False
    else:
        version_overrides["lessons"][0]["vocabulary_items"][0]["is_active"] = False
    import_content_data(db_session, version_overrides)
    release = db_session.query(models.ContentRelease).one()
    context = release.manifest["lessons"][0]
    member = context["vocabulary_items"][0]
    listing = client.get("/content/lessons?language=en", headers=headers)
    assert listing.status_code == 200
    detail = client.get(
        f"/content/lessons/{context['id']}?content_release_id={release.id}",
        headers=headers,
    )
    if inactive == "item":
        assert listing.json()[0]["item_count"] == 1
        assert detail.status_code == 200
        assert [item["id"] for item in detail.json()["vocabulary_items"]] == [
            DATA["lessons"][0]["vocabulary_items"][1]["id"]
        ]
    else:
        assert listing.json() == []
        assert detail.status_code == 404
    payload = attempt({**member, "content_release_id": str(release.id)})
    assert (
        client.post("/reviews/attempts", json=payload, headers=headers).status_code
        == 400
    )
    assert db_session.query(ReviewAttempt).count() == 0


def test_import_publishes_stable_revision_and_release_independent_of_array_order(
    db_session, client, headers
):
    source = copy.deepcopy(DATA)
    source["lessons"].append(
        {
            "id": "44444444-4444-4444-8444-444444444444",
            "title": "Another lesson",
            "vocabulary_items": [],
        }
    )
    import_content_data(db_session, source)
    first = served(client, headers)
    reordered = copy.deepcopy(source)
    reordered["lessons"][0]["vocabulary_items"].reverse()
    reordered["lessons"].reverse()
    import_content_data(db_session, reordered)
    second = served(client, headers)
    assert second == first
    assert db_session.query(models.VocabularyRevision).count() == 2
    assert db_session.query(models.ContentRelease).count() == 1


def test_content_wire_exposes_actual_released_activation(db_session, client, headers):
    import_content_data(db_session, DATA)
    listing = client.get("/content/lessons?language=en", headers=headers)
    assert listing.status_code == 200
    assert listing.json()[0]["is_active"] is True
    detail = served(client, headers)
    assert detail["is_active"] is True
    assert all(item["is_active"] is True for item in detail["vocabulary_items"])


def test_invalid_import_rolls_back_mutable_rows_and_unpublished_evidence(
    db_session, client, headers
):
    import_content_data(db_session, DATA)
    original = served(client, headers)
    invalid = copy.deepcopy(DATA)
    first = invalid["lessons"][0]["vocabulary_items"][0]
    first["definition"] = "Partial edit that must not persist"
    invalid["lessons"][0]["vocabulary_items"].append(copy.deepcopy(first))
    with pytest.raises(ValueError, match="duplicate vocabulary"):
        import_content_data(db_session, invalid)
    db_session.commit()  # A caller catching the error must not commit a partial import.
    db_session.expire_all()
    logical = db_session.get(models.VocabularyItem, uuid.UUID(first["id"]))
    assert logical.definition == "greeting"
    assert db_session.query(models.VocabularyRevision).count() == 2
    assert db_session.query(models.ContentRelease).count() == 1
    assert served(client, headers) == original


@pytest.mark.parametrize(
    "field,value",
    [
        ("term", "hi"),
        ("definition", "updated meaning"),
        ("example_sentence", "Hi there."),
        ("translation", "new translation"),
        ("difficulty", "medium"),
        ("category", "new category"),
        ("is_active", False),
    ],
)
def test_content_changes_append_revisions_without_rewriting_prior_facts(
    db_session, client, headers, field, value
):
    import_content_data(db_session, DATA)
    old = served(client, headers)
    old_item = old["vocabulary_items"][0]
    changed = copy.deepcopy(DATA)
    changed["lessons"][0]["vocabulary_items"][0][field] = value
    import_content_data(db_session, changed)
    db_session.expire_all()
    revision = db_session.get(
        models.VocabularyRevision, uuid.UUID(old_item["content_revision_id"])
    )
    assert revision.term == "hello"
    assert revision.definition == "greeting"
    assert revision.example_sentence == "Hello there."
    assert revision.is_active is True
    assert db_session.query(models.VocabularyRevision).count() == 3
    assert db_session.query(models.ContentRelease).count() == 2
    assert (
        db_session.get(models.ContentRelease, uuid.UUID(old["content_release_id"]))
        is not None
    )
    current = served(client, headers)
    assert current["content_release_id"] != old["content_release_id"]
    if field != "is_active":
        assert (
            current["vocabulary_items"][0]["content_revision_id"]
            != old_item["content_revision_id"]
        )


def test_old_online_and_offline_reviews_bind_to_served_revision_after_edit_and_deactivation(
    db_session, client, headers
):
    import_content_data(db_session, DATA)
    original = served(client, headers)
    old_payload = attempt(original["vocabulary_items"][0])
    accepted = client.post("/reviews/attempts", json=old_payload, headers=headers)
    assert accepted.status_code == 200
    changed = copy.deepcopy(DATA)
    changed["lessons"][0]["title"] = "Corrected lesson title"
    changed["lessons"][0]["vocabulary_items"][0]["term"] = "hi"
    changed["lessons"][0]["vocabulary_items"][0]["difficulty"] = "medium"
    import_content_data(db_session, changed)
    current = served(client, headers)
    new_payload = attempt(current["vocabulary_items"][0])
    assert (
        client.post("/reviews/attempts", json=new_payload, headers=headers).status_code
        == 200
    )
    changed["lessons"][0]["is_active"] = False
    changed["lessons"][0]["vocabulary_items"][0]["is_active"] = False
    import_content_data(db_session, changed)
    offline = {**old_payload, "client_event_id": str(uuid.uuid4())}
    synced = client.post(
        "/sync/review-events", json={"events": [offline]}, headers=headers
    )
    assert synced.status_code == 200
    altered = {
        **old_payload,
        "content_revision_id": new_payload["content_revision_id"],
        "content_release_id": new_payload["content_release_id"],
    }
    replay = client.post(
        "/sync/review-events", json={"events": [altered]}, headers=headers
    )
    assert replay.status_code == 200
    assert replay.json()["accepted_events"][0]["id"] == accepted.json()["id"]
    db_session.expire_all()
    rows = (
        db_session.query(ReviewAttempt)
        .order_by(ReviewAttempt.server_acceptance_at)
        .all()
    )
    assert len(rows) == 3
    for row in [rows[0], rows[2]]:
        assert str(row.content_revision_id) == old_payload["content_revision_id"]
        assert str(row.content_release_id) == old_payload["content_release_id"]
        assert row.content_revision.term == "hello"
        assert row.content_release.manifest["lessons"][0]["title"] == "Greetings"
    assert rows[1].content_revision.term == "hi"
    assert (
        rows[1].content_release.manifest["lessons"][0]["title"]
        == "Corrected lesson title"
    )


def test_lesson_context_changes_reuse_word_revision_and_old_release_is_queryable(
    db_session, client, headers
):
    import_content_data(db_session, DATA)
    old = served(client, headers)
    changed = copy.deepcopy(DATA)
    changed["lessons"][0]["title"] = "Updated context"
    changed["language"]["name"] = "English language"
    import_content_data(db_session, changed)
    current = served(client, headers)
    assert current["content_release_id"] != old["content_release_id"]
    assert (
        current["vocabulary_items"][0]["content_revision_id"]
        == old["vocabulary_items"][0]["content_revision_id"]
    )
    assert db_session.query(models.VocabularyRevision).count() == 2
    historical = client.get(
        f"/content/lessons/{DATA['lessons'][0]['id']}?content_release_id={old['content_release_id']}",
        headers=headers,
    )
    assert historical.status_code == 200
    assert historical.json()["title"] == "Greetings"
    assert historical.json()["content_release_id"] == old["content_release_id"]


def test_mutable_edit_cannot_change_released_api_facts_and_forged_client_text_is_not_authoritative(
    db_session, client, headers
):
    import_content_data(db_session, DATA)
    old = served(client, headers)
    logical = db_session.get(
        models.VocabularyItem, uuid.UUID(old["vocabulary_items"][0]["id"])
    )
    logical.term = "Unpublished correction"
    logical.definition = "Unpublished meaning"
    db_session.commit()
    assert served(client, headers) == old
    payload = {
        **attempt(old["vocabulary_items"][0]),
        "term": "CLIENT FORGERY",
        "definition": "Not server evidence",
    }
    response = client.post("/reviews/attempts", json=payload, headers=headers)
    assert response.status_code == 200
    row = db_session.query(ReviewAttempt).one()
    assert row.content_revision.term == "hello"
    assert row.content_revision.definition == "greeting"


@pytest.mark.parametrize(
    "kind",
    [
        "unknown_revision",
        "unknown_release",
        "other_item",
        "wrong_release",
        "missing",
        "half_missing",
    ],
)
def test_inconsistent_provenance_is_rejected_without_substitution(
    db_session, client, headers, kind
):
    import_content_data(db_session, DATA)
    old = served(client, headers)
    payload = attempt(old["vocabulary_items"][0])
    changed = copy.deepcopy(DATA)
    changed["lessons"][0]["vocabulary_items"][0]["definition"] = "corrected"
    import_content_data(db_session, changed)
    current = served(client, headers)
    if kind == "unknown_revision":
        payload["content_revision_id"] = str(uuid.uuid4())
    elif kind == "unknown_release":
        payload["content_release_id"] = str(uuid.uuid4())
    elif kind == "other_item":
        payload["content_revision_id"] = old["vocabulary_items"][1][
            "content_revision_id"
        ]
    elif kind == "wrong_release":
        payload["content_release_id"] = current["content_release_id"]
    elif kind == "half_missing":
        del payload["content_release_id"]
    else:
        del payload["content_revision_id"]
        del payload["content_release_id"]
    result = client.post(
        "/sync/review-events", json={"events": [payload]}, headers=headers
    )
    assert result.status_code in [400, 422]
    assert db_session.query(ReviewAttempt).count() == 0


@pytest.mark.parametrize(
    "table,statement",
    [
        (
            "vocabulary_revisions",
            "UPDATE vocabulary_revisions SET definition = 'tampered'",
        ),
        ("vocabulary_revisions", "DELETE FROM vocabulary_revisions"),
        ("content_releases", "UPDATE content_releases SET manifest = '{}'"),
        ("content_releases", "DELETE FROM content_releases"),
        ("vocabulary_items", "DELETE FROM vocabulary_items"),
        ("lessons", "DELETE FROM lessons"),
        ("languages", "DELETE FROM languages"),
    ],
)
def test_postgresql_protects_immutable_history_and_content_references(
    db_session, client, headers, table, statement
):
    import_content_data(db_session, DATA)
    served(client, headers)
    with pytest.raises(DBAPIError):
        db_session.execute(text(statement))
        db_session.commit()
    db_session.rollback()
    assert db_session.query(models.VocabularyRevision).count() == 2
    assert db_session.query(models.ContentRelease).count() == 1


def test_new_release_does_not_backfill_legacy_attempt(db_session, client, headers):
    from app.reviews.models import ReviewSchedule, ReviewSession
    from app.sync.models import AcceptedClientEvent

    import_content_data(db_session, DATA)
    user = db_session.query(User).one()
    session = ReviewSession(user_id=user.id, client_session_id=uuid.uuid4())
    db_session.add(session)
    db_session.flush()
    legacy = ReviewAttempt(
        user_id=user.id,
        session_id=session.id,
        vocabulary_item_id=uuid.UUID(DATA["lessons"][0]["vocabulary_items"][0]["id"]),
        client_event_id=uuid.uuid4(),
        correct=True,
        response_time_ms=1200,
        scheduler_type="development",
        algorithm_version="dev-0.1",
        client_interaction_at=datetime.now(UTC),
        device_platform="ios",
        application_version="1.0.0",
    )
    db_session.add(legacy)
    db_session.flush()
    db_session.add(
        ReviewSchedule(
            user_id=user.id,
            vocabulary_item_id=legacy.vocabulary_item_id,
            attempt_id=legacy.id,
            scheduler_type="development",
            algorithm_version="dev-0.1",
            interval_seconds=86400,
            due_at=datetime.now(UTC),
        )
    )
    db_session.add(
        AcceptedClientEvent(
            user_id=user.id,
            client_event_id=legacy.client_event_id,
            attempt_id=legacy.id,
        )
    )
    db_session.commit()
    changed = copy.deepcopy(DATA)
    changed["lessons"][0]["vocabulary_items"][0]["definition"] = "later meaning"
    import_content_data(db_session, changed)
    db_session.refresh(legacy)
    assert legacy.content_revision_id is None
    assert legacy.content_release_id is None
    historical = {
        "client_event_id": str(legacy.client_event_id),
        "client_session_id": str(session.client_session_id),
        "vocabulary_item_id": str(legacy.vocabulary_item_id),
        "correct": True,
        "response_time_ms": 1200,
        "client_interaction_at": legacy.client_interaction_at.isoformat(),
        "device_platform": "ios",
        "application_version": "1.0.0",
    }
    replay = client.post(
        "/sync/review-events", json={"events": [historical]}, headers=headers
    )
    assert replay.status_code == 200
    assert replay.json()["accepted_events"][0]["content_revision_id"] is None
    item = served(client, headers)["vocabulary_items"][0]
    historical.update(
        {key: item[key] for key in ["content_revision_id", "content_release_id"]}
    )
    altered = client.post("/reviews/attempts", json=historical, headers=headers)
    assert altered.status_code == 200
    assert altered.json()["id"] == str(legacy.id)
    assert altered.json()["content_release_id"] is None
    db_session.refresh(legacy)
    assert legacy.content_revision_id is None
    assert db_session.query(ReviewAttempt).count() == 1
