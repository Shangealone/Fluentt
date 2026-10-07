"""D9 real PostgreSQL accepted-record and privacy invariants."""

import copy
import json
import uuid
from datetime import datetime

import pytest
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.auth.models import User
from app.content.models import ContentRelease, VocabularyRevision
from app.content.service import import_content_data
from app.research_logging.models import ResearchEvent
from app.research_logging.service import ItemAttemptPayload, sanitize_payload
from app.reviews import service
from app.reviews.models import ReviewAttempt, ReviewSchedule, ReviewSession
from app.sync.models import AcceptedClientEvent
from tests.content.test_provenance import DATA, attempt
from tests.research_helpers import allow_historical_fixture_edits
from tests.reviews.test_due_review import make_review_context
from tests.reviews.test_timing import EVIDENCE


@pytest.fixture
def review_context(db_session, client):
    return make_review_context(db_session, client)


def accepted(client, review_context):
    user_id, headers, detail = review_context
    payload = {
        **attempt(detail["vocabulary_items"][0]),
        "timing_evidence": copy.deepcopy(EVIDENCE),
    }
    result = client.post("/reviews/attempts", json=payload, headers=headers)
    assert result.status_code == 200
    return user_id, payload, result.json()


def test_current_events_are_typed_versioned_owned_and_reconstruct_original_facts(
    db_session, client, review_context
):
    user_id, payload, result = accepted(client, review_context)
    events = db_session.query(ResearchEvent).all()
    assert {e.event_type for e in events} == {"REVIEW_ANSWERED", "REVIEW_SCHEDULED"}
    for event in events:
        assert event.schema_version == "review-events-1"
        assert str(event.review_attempt_id) == result["id"]
        assert event.user_id == user_id
        assert event.payload == {"scope": "item_attempt"}
        # Reconstruction follows only authoritative links, never current content.
        row = db_session.get(ReviewAttempt, event.review_attempt_id)
        user = db_session.get(User, row.user_id)
        session = db_session.get(ReviewSession, row.session_id)
        schedule = db_session.query(ReviewSchedule).filter_by(attempt_id=row.id).one()
        ledger = (
            db_session.query(AcceptedClientEvent).filter_by(attempt_id=row.id).one()
        )
        revision = db_session.get(VocabularyRevision, row.content_revision_id)
        release = db_session.get(ContentRelease, row.content_release_id)
        assert user.participant_code == "P_D7"
        assert str(session.client_session_id) == payload["client_session_id"]
        assert session.user_id == row.user_id == event.user_id
        assert str(row.client_event_id) == payload["client_event_id"]
        for field in [
            "correct",
            "submitted_answer",
            "response_time_ms",
            "device_platform",
            "application_version",
        ]:
            assert getattr(row, field) == payload.get(field)
        assert row.timing_evidence == EVIDENCE
        assert row.client_interaction_at == datetime.fromisoformat(
            payload["client_interaction_at"]
        )
        assert str(row.vocabulary_item_id) == payload["vocabulary_item_id"]
        assert (
            revision.id == row.content_revision_id
            and release.id == row.content_release_id
        )
        assert revision.term == "hello"
        assert schedule.scheduler_type == row.scheduler_type == "development"
        assert schedule.algorithm_version == row.algorithm_version == "dev-0.1"
        assert schedule.interval_seconds == result["next_interval_seconds"]
        assert schedule.due_at == datetime.fromisoformat(result["next_due_at"])
        assert schedule.scheduler_state == {
            "is_development_only": True,
            "deterministic_rule": "24h_on_correct_10m_on_incorrect",
            "last_correct": payload["correct"],
        }
        assert row.server_acceptance_at == datetime.fromisoformat(
            result["server_acceptance_at"]
        )
        assert (
            ledger.user_id == row.user_id
            and ledger.client_event_id == row.client_event_id
        )
        assert ledger.accepted_at == row.server_acceptance_at
    assert "email" not in json.dumps([e.payload for e in events])


def test_linked_projection_needs_only_coded_identity_and_keeps_old_published_content(
    db_session, client, review_context
):
    user_id, _, result = accepted(client, review_context)
    changed = copy.deepcopy(DATA)
    changed["lessons"][0]["vocabulary_items"][0]["term"] = "new publication"
    import_content_data(db_session, changed)
    user = db_session.get(User, user_id)
    user.email = "changed-identifier@example.test"
    db_session.commit()
    event = (
        db_session.query(ResearchEvent).filter_by(event_type="REVIEW_ANSWERED").one()
    )
    row = db_session.get(ReviewAttempt, event.review_attempt_id)
    # Internal test projection, not an export route or approved dissemination format.
    coded_projection = {
        "participant_code": user.participant_code,
        "attempt_id": str(row.id),
        "term": row.content_revision.term,
        "timing_evidence": row.timing_evidence,
        "application_version": row.application_version,
    }
    assert coded_projection == {
        "participant_code": "P_D7",
        "attempt_id": result["id"],
        "term": "hello",
        "timing_evidence": EVIDENCE,
        "application_version": row.application_version,
    }
    assert "changed-identifier" not in json.dumps(coded_projection)


def test_nested_list_dictionary_and_separator_variants_cannot_hide_secrets():
    dirty = {
        "term": "hello",
        "Email": "private",
        "full-name": "private",
        "nested": [
            {
                "Authorization": "Bearer secret",
                "Cookie": "secret",
                "response_time_ms": 1234,
                "list": [
                    [
                        {
                            "ACCESS-TOKEN": "secret",
                            "refreshToken": "secret",
                            "PASSWORD_HASH": "secret",
                            "participant_code": "P_1",
                        }
                    ]
                ],
            },
            {
                "deviceIdentifier": "private",
                "IMEI": "private",
                "first_name": "private",
                "lastName": "private",
            },
        ],
    }
    assert sanitize_payload(dirty) == {
        "term": "hello",
        "nested": [
            {"response_time_ms": 1234, "list": [[{"participant_code": "P_1"}]]},
            {},
        ],
    }
    assert dirty["Email"] == "private"  # No mutation/replacement of the input.


def test_replay_preserves_version_payload_links_and_distinct_interactions_add_evidence(
    db_session, client, review_context
):
    _, payload, _ = accepted(client, review_context)
    _, headers, _ = review_context
    original = [
        dict(row)
        for row in db_session.execute(
            text("SELECT * FROM research_events ORDER BY id")
        ).mappings()
    ]
    result = client.post(
        "/sync/review-events",
        json={"events": [{**payload, "timing_evidence": None}]},
        headers=headers,
    )
    assert result.status_code == 200
    assert [
        dict(row)
        for row in db_session.execute(
            text("SELECT * FROM research_events ORDER BY id")
        ).mappings()
    ] == original
    distinct = client.post(
        "/reviews/attempts",
        json={**payload, "client_event_id": str(uuid.uuid4())},
        headers=headers,
    )
    assert distinct.status_code == 200
    assert db_session.query(ResearchEvent).count() == 4
    assert len({e.review_attempt_id for e in db_session.query(ResearchEvent)}) == 2


def test_rejected_and_unauthenticated_submissions_create_no_outcome(
    db_session, client, review_context
):
    _, headers, detail = review_context
    payload = attempt(detail["vocabulary_items"][0])
    assert client.post("/reviews/attempts", json=payload).status_code == 401
    invalid = {**payload, "content_revision_id": str(uuid.uuid4())}
    assert (
        client.post(
            "/sync/review-events", json={"events": [invalid]}, headers=headers
        ).status_code
        == 400
    )
    assert db_session.query(ResearchEvent).count() == 0
    assert db_session.query(ReviewAttempt).count() == 0


def test_failure_after_first_event_rolls_back_entire_acceptance(
    db_session, client, review_context, monkeypatch
):
    _, headers, detail = review_context
    record = service.record_research_event
    count = 0

    def fail_second(*args, **kwargs):
        nonlocal count
        count += 1
        if count == 2:
            raise RuntimeError("Injected operational failure")
        return record(*args, **kwargs)

    monkeypatch.setattr(service, "record_research_event", fail_second)
    with pytest.raises(RuntimeError, match="Injected"):
        client.post(
            "/reviews/attempts",
            json=attempt(detail["vocabulary_items"][0]),
            headers=headers,
        )
    for model in [ResearchEvent, ReviewAttempt, ReviewSchedule, AcceptedClientEvent]:
        assert db_session.query(model).count() == 0


@pytest.mark.parametrize(
    "table,assignment",
    [
        ("review_attempts", "response_time_ms=99"),
        ("review_schedules", "interval_seconds=99"),
        ("accepted_client_events", "response_payload='{}'"),
        ("research_events", "payload='{}'"),
        ("review_sessions", "client_session_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"),
        ("users", "participant_code='RECODED'"),
    ],
)
def test_ordinary_updates_cannot_rewrite_research_evidence(
    db_session, client, review_context, table, assignment
):
    accepted(client, review_context)
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.execute(text(f"UPDATE {table} SET {assignment}"))


@pytest.mark.parametrize(
    "table",
    [
        "users",
        "review_sessions",
        "review_attempts",
        "review_schedules",
        "accepted_client_events",
        "research_events",
        "vocabulary_items",
        "lessons",
        "languages",
    ],
)
def test_delete_and_cascades_preserve_history(
    db_session, client, review_context, table
):
    accepted(client, review_context)
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.execute(text(f"DELETE FROM {table}"))
    assert db_session.query(ReviewAttempt).count() == 1
    assert db_session.query(ResearchEvent).count() == 2


@pytest.mark.parametrize(
    "table",
    [
        "review_attempts",
        "review_schedules",
        "accepted_client_events",
        "research_events",
    ],
)
def test_application_truncate_cannot_bypass_row_guards(
    db_session, client, review_context, table
):
    accepted(client, review_context)
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.execute(text(f"TRUNCATE {table} CASCADE"))
    assert db_session.query(ReviewAttempt).count() == 1


def test_current_schema_duplicate_wrong_owner_and_untyped_payload_are_rejected(
    db_session, client, review_context
):
    user_id, _, result = accepted(client, review_context)
    other = User(
        email="other@example.test", participant_code="P_OTHER", password_hash="mock"
    )
    db_session.add(other)
    db_session.commit()
    for owner, kind, payload, constraint in [
        (
            user_id,
            "REVIEW_ANSWERED",
            {"scope": "item_attempt"},
            "uq_current_review_event",
        ),
        (
            user_id,
            "REVIEW_SCHEDULED",
            {"scope": "item_attempt", "email": "private"},
            "ck_current_review_event",
        ),
    ]:
        with pytest.raises(DBAPIError) as error, db_session.begin_nested():
            db_session.add(
                ResearchEvent(
                    user_id=owner,
                    event_type=kind,
                    payload=payload,
                    review_attempt_id=uuid.UUID(result["id"]),
                    schema_version="review-events-1",
                )
            )
            db_session.flush()
        assert error.value.orig.diag.constraint_name == constraint
    connection = db_session.connection()
    savepoint = connection.begin_nested()
    try:
        allow_historical_fixture_edits(connection, "research_events")
        connection.execute(
            text("DELETE FROM research_events WHERE event_type='REVIEW_ANSWERED'")
        )
        connection.execute(
            text("ALTER TABLE research_events ENABLE TRIGGER d9_immutable_row")
        )
        with pytest.raises(DBAPIError) as error, db_session.begin_nested():
            db_session.add(
                ResearchEvent(
                    user_id=other.id,
                    event_type="REVIEW_ANSWERED",
                    payload={"scope": "item_attempt"},
                    review_attempt_id=uuid.UUID(result["id"]),
                    schema_version="review-events-1",
                )
            )
            db_session.flush()
        assert error.value.orig.diag.constraint_name == "fk_research_attempt_owner"
    finally:
        savepoint.rollback()
        db_session.rollback()


def test_typed_payload_rejects_identifier_and_credential_fields():
    for key in [
        "email",
        "password_hash",
        "access_token",
        "refresh_token",
        "authorization",
        "cookie",
        "name",
        "device_id",
    ]:
        with pytest.raises(ValidationError):
            ItemAttemptPayload.model_validate({"scope": "item_attempt", key: "private"})


def test_provisioned_code_is_immutable_before_reviews_but_auth_fields_remain_editable(
    db_session, review_context
):
    user_id, _, _ = review_context
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.execute(
            text("UPDATE users SET participant_code='CHANGED' WHERE id=:id"),
            {"id": user_id},
        )
    user = db_session.get(User, user_id)
    user.email = "updated@example.test"
    user.password_hash = "updated hash"
    user.must_change_password = True
    db_session.commit()
    db_session.expire_all()
    assert user.participant_code == "P_D7"
    assert user.email == "updated@example.test"
    assert user.must_change_password is True


def test_legacy_events_keep_null_links_and_ambiguous_semantics_and_cannot_be_rewritten(
    db_session, review_context
):
    user_id, _, _ = review_context
    event = ResearchEvent(
        user_id=user_id,
        event_type="REVIEW_COMPLETED",
        payload={"participant_code": "OLD_CODE"},
    )
    db_session.add(event)
    db_session.commit()
    assert event.schema_version is None and event.review_attempt_id is None
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.execute(
            text("UPDATE research_events SET event_type='REVIEW_SCHEDULED'")
        )
    db_session.expire_all()
    assert event.event_type == "REVIEW_COMPLETED"
    assert event.payload == {"participant_code": "OLD_CODE"}


def test_conflicting_original_and_server_session_identity_is_rejected(
    db_session, client, review_context
):
    _, headers, detail = review_context
    original = str(uuid.uuid4())
    session = client.post(
        "/reviews/sessions", json={"client_session_id": original}, headers=headers
    ).json()
    payload = {**attempt(detail["vocabulary_items"][0]), "session_id": session["id"]}
    assert payload["client_session_id"] != original
    assert (
        client.post("/reviews/attempts", json=payload, headers=headers).status_code
        == 400
    )
    assert db_session.query(ResearchEvent).count() == 0
