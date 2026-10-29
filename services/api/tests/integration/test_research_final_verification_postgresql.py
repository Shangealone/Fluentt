"""Negative end-to-end gates in UUID disposable DBs; no approved consent or time bypass."""

from datetime import datetime, timezone
from uuid import UUID, uuid4
import pytest
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.learning import LearningContext, VocabularyReviewEvent
from app.models.research import ResearchParticipant, ResearchIdentityLink, ResearchConsentRecord
from tests.integration.test_research_classrooms_postgresql import research as research_fixture, create, designate, grant

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/admin/research-classrooms/studies"


@pytest.fixture
def research(pg_engine):
    yield from research_fixture.__wrapped__(pg_engine)


def test_managed_legacy_consent_document_must_not_supply_unapproved_placeholder(research):
    client, engine, actor, classroom, _, student, _ = research
    row, _, _ = create(client)
    designate(client, engine, actor, classroom, row)
    response = client.get(f"/api/v1/me/research/studies/{row['study_id']}/consent-document", headers=student)
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "research_classroom_execution_blocked"
    assert "permanently retained" not in response.text and "required_affirmation" not in response.text


def test_managed_legacy_link_cannot_start_generic_research_reviews(research):
    client, engine, actor, classroom, _, student, student_id = research
    row, _, _ = create(client)
    designate(client, engine, actor, classroom, row)
    event = {
        "event_key": str(uuid4()),
        "vocabulary_item_id": str(uuid4()),
        "recall_rating": "good",
        "response_duration_ms": 1500,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "context_type": "research",
    }
    # Each explicit managed identifier is denied even before any identity link exists.
    for context in ({"study_id": row["study_id"]}, {"class_id": classroom["id"]}):
        denied = client.post("/api/v1/me/reviews/events", headers=student, json={**event, **context})
        assert denied.status_code == 409 and "no-store" in denied.headers["cache-control"]
    assert (
        client.get(
            f"/api/v1/me/reviews/due?context_type=research&class_id={classroom['id']}", headers=student
        ).status_code
        == 409
    )
    # Deliberately invalid legacy state to test denial, NOT an authorized enrollment or simulated permission.
    with Session(engine) as db, db.begin():
        participant = ResearchParticipant(
            study_id=UUID(row["study_id"]),
            participant_code="SYNTHETIC-INVALID-LEGACY-LINK",
            enrollment_status="enrolled",
            eligibility_status="pending",
        )
        db.add(participant)
        db.flush()
        participant_id = participant.id
        db.add(ResearchIdentityLink(study_id=UUID(row["study_id"]), participant_id=participant_id, user_id=student_id))
    response = client.get("/api/v1/me/reviews/due?context_type=research", headers=student)
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "research_classroom_execution_blocked"
    # With no supplied study/class, the ambiguous legacy link is still denied.
    denied = client.post("/api/v1/me/reviews/events", headers=student, json=event)
    assert denied.status_code == 409 and "no-store" in denied.headers["cache-control"]
    assert client.get("/api/v1/me/reviews/due?context_type=self_study", headers=student).status_code == 200
    with Session(engine) as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(LearningContext)
                .where(LearningContext.participant_id == participant_id)
            )
            == 0
        )
        assert (
            db.scalar(
                select(func.count())
                .select_from(ResearchConsentRecord)
                .where(ResearchConsentRecord.participant_id == participant_id)
            )
            == 0
        )


def test_unapproved_chain_stays_blocked_without_fabricated_consent_time_or_outcomes(research):
    client, engine, actor, classroom, _, student, _ = research
    mode = f"/api/v1/me/research-classrooms/classes/{classroom['id']}"
    assert client.get(mode, headers=student).json()["mode"] == "normal"
    row, _, _ = create(client, target_participants=30)
    designate(client, engine, actor, classroom, row)
    current = client.get(f"{BASE}/{row['id']}").json()
    assert (
        client.post(
            f"{BASE}/{row['id']}/state",
            headers={"If-Match": current["revision"], "Idempotency-Key": str(uuid4())},
            json={"status": "READY"},
        ).status_code
        == 409
    )
    assert client.get(mode, headers=student).json()["execution_available"] is False
    path = f"/api/v1/me/research/studies/{row['study_id']}"
    for suffix in ("", "/eligibility", "/consent-document"):
        assert client.get(path + suffix, headers=student).status_code == 409
    for untrusted_affirmation in (False, True):
        enrollment = client.post(
            path + "/enroll",
            headers=student,
            json={"protocol_version": row["protocol_version"], "affirmation_confirmed": untrusted_affirmation},
        )
        assert enrollment.status_code == 409  # An untrusted boolean is never actual consent.
    assert client.post(path + "/allocate", headers=student).status_code == 409
    for kind in ("pre_test", "post_test", "delayed_retention"):
        denied = client.post(f"{path}/assessments/{uuid4()}/start", headers=student)
        assert denied.status_code == 409, (kind, denied.text)
    assert (
        client.post(
            f"/api/v1/me/research-classrooms/studies/{row['study_id']}/questionnaires",
            headers=student,
            json={"responses": {}},
        ).status_code
        == 404
    )
    grant(engine, actor, "research.export")
    assert client.get(f"{BASE}/{row['id']}/exports?dataset=reviews").status_code == 409
    fresh = client.get(f"{BASE}/{row['id']}").json()
    assert fresh["reporting"]["questionnaire"]["publication_status"] == "UNPUBLISHED"
    assert all(item["value"] is None and item["denominator"] is None for item in fresh["reporting"]["metrics"])
    with Session(engine) as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(ResearchParticipant)
                .where(ResearchParticipant.study_id == UUID(row["study_id"]))
            )
            == 0
        )


def test_personal_and_normal_class_review_requests_keep_existing_contract(research):
    client, engine, _, classroom, _, student, student_id = research
    with Session(engine) as db:
        before_events = db.scalar(select(func.count()).select_from(VocabularyReviewEvent))
    personal = client.get("/api/v1/me/reviews/due?context_type=self_study", headers=student)
    normal = client.get(f"/api/v1/me/reviews/due?context_type=classroom&class_id={classroom['id']}", headers=student)
    assert personal.status_code == normal.status_code == 200
    assert personal.json()["items"] == normal.json()["items"] == []
    assert personal.json()["algorithm"] == normal.json()["algorithm"] == "sm2"
    with Session(engine) as db:
        contexts = db.scalars(select(LearningContext).where(LearningContext.student_id == student_id)).all()
        assert {row.kind for row in contexts} == {"personal", "classroom"}
        assert all(row.participant_id is None for row in contexts)
        assert db.scalar(select(func.count()).select_from(VocabularyReviewEvent)) == before_events
