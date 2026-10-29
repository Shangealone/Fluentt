"""Synthetic fixtures only, using the generated disposable PostgreSQL database."""

from datetime import datetime, timezone
from uuid import UUID, uuid4
import pytest
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.research import ResearchAssessment, ResearchAssessmentResult
from app.models.research_classrooms import ResearchClassroomProtocol as Protocol
from tests.integration.test_research_classrooms_postgresql import (
    research as research_fixture,
    create,
    designate,
    admin,
)
from tests.integration.test_enrollment_postgresql import account

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/admin/research-classrooms/studies"


@pytest.fixture
def research(pg_engine):
    yield from research_fixture.__wrapped__(pg_engine)


def references(engine, study_id):
    values = []
    with Session(engine) as db, db.begin():
        for kind in ("pre_test", "post_test", "delayed_retention"):
            item = ResearchAssessment(
                study_id=UUID(study_id),
                kind=kind,
                instrument_version="synthetic-not-approved-v1",
                instrument_snapshot={"synthetic": True, "private_key": "must-not-leak"},
                locked_at=datetime.now(timezone.utc),
            )
            db.add(item)
            db.flush()
            values.append({"assessment_id": str(item.id), "instrument_version": item.instrument_version})
    return values


def save(client, row, payload, headers=None):
    return client.post(
        f"{BASE}/{row['id']}/protocols",
        json=payload,
        headers=headers or {"If-Match": row["revision"], "Idempotency-Key": str(uuid4())},
    )


def test_draft_revision_recovery_freshness_and_frozen_history(research):
    client, engine, *_ = research
    row, _, _ = create(client)
    payload = {
        "assessment_delivery_draft": {"version": "synthetic-v1", "stages": {"pre_test": {"maximum_attempts": 2}}}
    }
    headers = {"If-Match": row["revision"], "Idempotency-Key": str(uuid4())}
    first = save(client, row, payload, headers)
    assert first.status_code == 200, first.text
    updated = first.json()
    assert updated["assessment_publication"]["status"] == "BLOCKED"
    assert save(client, row, payload, headers).json() == updated  # exact retry after unknown network outcome
    assert save(client, row, payload).status_code == 412  # stale writer
    assert save(client, row, {"assessment_delivery_draft": {"version": "different"}}, headers).status_code == 409
    with Session(engine) as db:
        assert db.get(Protocol, UUID(row["protocol_id"])).configuration.get("assessment_delivery_draft") is None
        assert (
            db.get(Protocol, UUID(updated["protocol_id"])).configuration["assessment_delivery_draft"]["version"]
            == "synthetic-v1"
        )


def test_frozen_same_study_version_and_assessment_type_required(research):
    client, engine, *_ = research
    row, _, _ = create(client)
    other, _, _ = create(client)
    refs = references(engine, row["study_id"])
    foreign = references(engine, other["study_id"])
    plan = {"version": "synthetic-v1", "stages": {"pre_test": {"assessment_id": refs[1]["assessment_id"]}}}
    bad = save(client, row, {"assessments": refs, "assessment_delivery_draft": plan})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "assessment_stage_mismatch"
    plan["stages"]["pre_test"]["assessment_id"] = foreign[0]["assessment_id"]
    assert save(client, row, {"assessments": foreign, "assessment_delivery_draft": plan}).status_code == 404
    plan["stages"]["pre_test"]["assessment_id"] = refs[0]["assessment_id"]
    wrong = [refs[0] | {"instrument_version": "not-this-version"}]
    assert save(client, row, {"assessments": wrong, "assessment_delivery_draft": plan}).status_code == 422
    okay = save(client, row, {"assessments": refs, "assessment_delivery_draft": plan})
    assert okay.status_code == 200, okay.text
    assert "must-not-leak" not in okay.text and "instrument_snapshot" not in okay.text


def test_even_complete_declared_plans_cannot_publish_or_collect_results(research):
    client, engine, *_ = research
    row, _, _ = create(client)
    refs = references(engine, row["study_id"])
    policy = {"version": "synthetic-unapproved-v1", "reference": "Synthetic fixture only; NOT approval"}
    stages = ["pre_test", "immediate_post_test", "delayed_retention_test"]
    plan = {
        "version": "synthetic-v1",
        **{name: policy for name in ("blueprint_policy", "difficulty_policy", "scoring_policy")},
        "stages": {
            kind: {
                "assessment_id": item["assessment_id"],
                "maximum_attempts": 1,
                "timeout_policy": policy,
                "feedback_policy": policy,
            }
            for kind, item in zip(stages, refs)
        },
        "delayed_follow_up": {
            "policy": policy,
            "anchor": "immediate_post_test_completion",
            "minimum_delay_seconds": 12345,
        },
    }
    refs = [
        item | {"opens_at": "2027-01-01T00:00:00Z", "closes_at": "2027-02-01T00:00:00Z", "timer_limit_seconds": 317}
        for item in refs
    ]
    updated = save(client, row, {"assessments": refs, "assessment_delivery_draft": plan})
    assert updated.status_code == 200, updated.text
    publication = updated.json()["assessment_publication"]
    assert publication["status"] == "BLOCKED" and not publication["execution_available"]
    assert "approved_timing_and_submission_rules_not_verified" in publication["blockers"]
    assert client.post(f"{BASE}/{row['id']}/publish", json={"approved": True}).status_code == 404
    with Session(engine) as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(ResearchAssessmentResult)
                .where(ResearchAssessmentResult.study_id == UUID(row["study_id"]))
            )
            == 0
        )


def test_mobile_managed_runner_blocks_clock_resume_submit_and_private_instrument_bypasses(research):
    client, engine, actor, classroom, _, student, _ = research
    row, _, _ = create(client)
    refs = references(engine, row["study_id"])
    designate(client, engine, actor, classroom, row)
    normal = client.get(f"/api/v1/me/research-classrooms/classes/{classroom['id']}", headers=student).json()
    assert normal["studies"][0]["assessment_publication_status"] == "BLOCKED"
    personal, _ = account(client, "personal_student")
    # These are denied requests, not simulated successful timed attempts.
    path = f"/api/v1/me/research/studies/{row['study_id']}/assessments"
    for auth in (student, personal):
        for clock in ("Mon, 01 Jan 1990 00:00:00 GMT", "Tue, 01 Jan 2097 00:00:00 GMT"):
            headers = auth | {"Date": clock}
            responses = [
                client.get(path, headers=headers),
                client.get(f"{path}/{refs[0]['assessment_id']}", headers=headers),
            ]
            responses.extend(client.post(f"{path}/{refs[0]['assessment_id']}/start", headers=headers) for _ in range(2))
            responses.append(
                client.post(
                    f"{path}/{refs[0]['assessment_id']}/submit",
                    headers=headers,
                    json={"attempt_id": str(uuid4()), "responses": {}, "response_duration_ms": 0},
                )
            )
            for result in responses:
                assert result.status_code == 409, result.text
                assert result.json()["error"]["code"] == "research_assessment_publication_blocked"
                assert "no-store" in result.headers["cache-control"]
                assert "must-not-leak" not in result.text
    with Session(engine) as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(ResearchAssessmentResult)
                .where(ResearchAssessmentResult.study_id == UUID(row["study_id"]))
            )
            == 0
        )


def test_other_manager_and_mobile_tokens_cannot_edit_assessment_plans(research):
    client, engine, _, _, _, student, _ = research
    row, _, _ = create(client)
    payload = {"assessment_delivery_draft": {"version": "synthetic-v1"}}
    _, csrf = admin(engine, client)
    client.headers.update(csrf)
    assert save(client, row, payload).status_code == 404
    client.cookies.clear()
    assert (
        save(client, row, payload, student | {"If-Match": row["revision"], "Idempotency-Key": str(uuid4())}).status_code
        == 401
    )
