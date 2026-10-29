"""Only UUID disposable PostgreSQL: planted QA records are unapproved, never real data."""

from datetime import datetime, timezone
from uuid import UUID
import pytest
from sqlalchemy import event, text
from sqlalchemy.orm import Session

from app.models.research import ResearchParticipant, ResearchIdentityLink, ResearchAssessment, ResearchAssessmentResult
from tests.integration.test_research_classrooms_postgresql import research as research_fixture, create, grant, admin

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/admin/research-classrooms/studies"


@pytest.fixture
def research(pg_engine):
    yield from research_fixture.__wrapped__(pg_engine)


def plant_unapproved_qa(engine, study_id, student_id):
    with Session(engine) as db, db.begin():
        participant = ResearchParticipant(
            study_id=UUID(study_id),
            participant_code="=SYNTHETIC_PRIVATE_ONLY",
            enrollment_status="pending",
            eligibility_status="pending",
        )
        instrument = ResearchAssessment(
            study_id=UUID(study_id),
            kind="pre_test",
            instrument_version="unapproved-qa-v1",
            instrument_snapshot={"qa_only": True},
        )
        db.add_all([participant, instrument])
        db.flush()
        db.add(ResearchIdentityLink(study_id=UUID(study_id), participant_id=participant.id, user_id=student_id))
        db.add(
            ResearchAssessmentResult(
                study_id=UUID(study_id),
                participant_id=participant.id,
                assessment_id=instrument.id,
                attempt_number=1,
                started_at=datetime.now(timezone.utc),
                status="in_progress",
                responses={},
            )
        )
        return participant.id


def test_readiness_never_reads_personal_classroom_or_unapproved_participant_observations(research):
    client, engine, _, _, _, _, student_id = research
    row, _, _ = create(client)
    plant_unapproved_qa(engine, row["study_id"], student_id)

    def deny_observations(conn, cursor, statement, parameters, context, executemany):
        forbidden = (
            "research_participants",
            "research_assessment_results",
            "research_identity_links",
            "research_consent_records",
            "vocabulary_review_events",
            "vocabulary_review_states",
            "learner_progress",
            "student_responses",
        )
        if statement.lstrip().lower().startswith("select") and any(name in statement.lower() for name in forbidden):
            raise AssertionError("Readiness must not query unapproved observations")

    event.listen(engine, "before_cursor_execute", deny_observations)
    try:
        response = client.get(f"{BASE}/{row['id']}")
    finally:
        event.remove(engine, "before_cursor_execute", deny_observations)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    reporting = response.json()["reporting"]
    assert reporting["questionnaire"]["publication_status"] == "UNPUBLISHED"
    assert reporting["questionnaire"]["response_count"] is None
    assert all(
        metric["value"] is None and metric["sample_size"] is None and metric["denominator"] is None
        for metric in reporting["metrics"]
    )
    assert "SYNTHETIC_PRIVATE_ONLY" not in response.text and "responses" not in reporting["questionnaire"]


def test_exports_require_live_explicit_permission_scope_ownership_and_remain_blocked(research):
    client, engine, actor, _, _, student, _ = research
    row, _, _ = create(client)
    url = f"{BASE}/{row['id']}/exports?dataset=questionnaires"
    assert client.get(url).status_code == 403
    grant(engine, actor, "research.export")
    for dataset in ("participants", "assessments", "reviews", "questionnaires"):
        response = client.get(f"{BASE}/{row['id']}/exports?dataset={dataset}")
        assert response.status_code == 409 and response.json()["error"]["code"] == "research_export_blocked"
        assert response.headers["cache-control"] == "no-store" and "content-disposition" not in response.headers
        assert "text/csv" not in response.headers["content-type"]
    assert client.get(url.replace("questionnaires", "raw-voice")).status_code == 422
    other, csrf = admin(engine, client)
    client.headers.update(csrf)
    grant(engine, other, "research.export")
    assert client.get(url).status_code == 404
    client.cookies.clear()
    assert client.get(url, headers=student).status_code == 401


def test_legacy_reporting_csv_codebook_and_identity_paths_cannot_bypass_managed_gates(research):
    client, engine, actor, _, _, _, student_id = research
    row, _, _ = create(client)
    participant_id = plant_unapproved_qa(engine, row["study_id"], student_id)
    grant(engine, actor, "research.export")
    base = f"/api/v1/admin/research/studies/{row['study_id']}"
    for suffix in (
        "analytics",
        "groups",
        "results",
        "participants",
        "exports/participants.csv",
        "exports/assessments.csv",
        "exports/reviews.csv",
        "exports/data-dictionary",
    ):
        response = client.get(f"{base}/{suffix}")
        assert response.status_code == 409, response.text
        assert "SYNTHETIC_PRIVATE_ONLY" not in response.text and "content-disposition" not in response.headers
        assert response.headers["cache-control"] == "no-store"
    identity = client.get(f"/api/v1/admin/research/participants/{participant_id}/identity")
    assert identity.status_code == 409 and "username" not in identity.text
    assert row["study_id"] not in client.get("/api/v1/admin/research/studies").text


def test_questionnaire_publication_submission_and_denominator_overrides_have_no_route(research):
    client, _, _, _, _, student, _ = research
    row, _, _ = create(client)
    for suffix in ("questionnaires/publish", "questionnaires/submit"):
        result = client.post(f"{BASE}/{row['id']}/{suffix}", json={"approved": True, "denominator": 30})
        assert result.status_code == 404
    result = client.post(
        f"/api/v1/me/research-classrooms/studies/{row['study_id']}/questionnaires",
        headers=student,
        json={"responses": {"invented_item": 5}},
    )
    assert result.status_code == 404


def test_reporting_does_not_mutate_existing_learning_records(research):
    client, engine, actor, *_ = research
    tables = (
        "learner_profiles",
        "learning_contexts",
        "learner_progress",
        "vocabulary_review_states",
        "vocabulary_review_events",
    )

    def snapshot():
        with engine.connect() as db:
            return {
                name: db.execute(text(f"SELECT to_jsonb(t)::text FROM {name} t ORDER BY id")).scalars().all()
                for name in tables
            }

    before = snapshot()
    row, _, _ = create(client)
    grant(engine, actor, "research.export")
    assert client.get(f"{BASE}/{row['id']}").status_code == 200
    assert client.get(f"{BASE}/{row['id']}/exports?dataset=reviews").status_code == 409
    assert snapshot() == before
