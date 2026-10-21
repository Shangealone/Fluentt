"""Read-only setup choices and additive JSON proposals in generated disposable DBs."""

from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
import pytest

from app.models.research import ResearchStudy, SchedulerConfiguration
from app.models.research_classrooms import ResearchClassroomProtocol
from app.modules.research.classroom_service import class_permission
from tests.integration.test_research_classrooms_postgresql import research as research_fixture, create, grant, admin


@pytest.fixture
def research(pg_engine):
    yield from research_fixture.__wrapped__(pg_engine)


pytestmark = pytest.mark.postgresql
BASE = "/api/v1/admin/research-classrooms/studies"


def test_choices_require_exact_scope_and_class_grant_without_seeding(research):
    client, engine, actor, classroom, *_ = research
    row, _, _ = create(client)
    url = f"{BASE}/{row['id']}/choices"
    assert client.get(url + "?kind=classrooms").json()["items"] == []
    assert client.get(url + "?kind=instruments").json()["items"] == []
    grant(engine, actor, class_permission(classroom["id"], "manage"))
    page = client.get(url + "?kind=classrooms&limit=1").json()
    assert page["items"][0]["id"] == classroom["id"]
    assert "instructor_id" not in page["items"][0]
    assert client.get(url + "?kind=unapproved").status_code == 422
    assert client.get(url + "?kind=conditions&limit=101").status_code == 422
    _, headers = admin(engine, client)
    client.headers.update(headers)
    assert client.get(url + "?kind=classrooms").status_code == 404


def test_configuration_only_persistence_and_frozen_history(research):
    client, engine, *_ = research
    row, _, _ = create(client)
    configuration = {
        "administrator_setup": {
            "proposed_intervention_weeks": 3,
            "daily_availability": {"opens": "08:00", "closes": "16:30"},
            "assessment_attempt_limit": 2,
            "phase_windows": {
                "questionnaire": {"opens_at": "2027-03-01T00:00:00Z", "closes_at": "2027-03-02T00:00:00Z"}
            },
            "review_policy": {"version": "synthetic-unapproved-v1", "reference": "Synthetic fixture, not approval"},
        }
    }
    response = client.post(
        f"{BASE}/{row['id']}/protocols",
        json=configuration,
        headers={"If-Match": row["revision"], "Idempotency-Key": "43bc58c0-5e2b-4982-8f31-d23881d5f730"},
    )
    assert response.status_code == 200, response.text
    revised = response.json()
    assert revised["configuration"]["administrator_setup"]["proposed_intervention_weeks"] == 3
    assert revised["status"] == "DRAFT" and "verified_authorization_missing:ethics" in revised["activation_blockers"]
    with Session(engine) as db:
        original = db.get(ResearchClassroomProtocol, UUID(row["protocol_id"]))
        assert original.configuration.get("administrator_setup") is None
        assert db.get(ResearchStudy, UUID(row["study_id"])).status == "draft"


def test_only_supported_sm2_is_selectable_and_esr_is_blocked(research):
    from uuid import uuid4

    client, engine, *_ = research
    row, _, _ = create(client)
    with Session(engine) as db, db.begin():
        for algorithm, version in (
            ("sm2", "sm2-classic-v1"),
            ("fifakt", "fifakt-esr-v1"),
            ("sm2", "unsupported-version"),
        ):
            db.add(
                SchedulerConfiguration(
                    algorithm=algorithm,
                    implementation_version=version,
                    configuration_version=int(uuid4().hex[:6], 16),
                    parameters={},
                )
            )
    response = client.get(f"{BASE}/{row['id']}/choices?kind=conditions")
    assert response.status_code == 200
    for item in response.json()["items"]:
        assert item["selectable"] == (item["label"] == "sm2" and item["implementation_version"] == "sm2-classic-v1")
    with Session(engine) as db:
        esr = db.scalar(select(SchedulerConfiguration).where(SchedulerConfiguration.algorithm == "fifakt"))
        config_id = str(esr.id)
    updated = client.post(
        f"{BASE}/{row['id']}/protocols",
        headers={"If-Match": row["revision"], "Idempotency-Key": str(uuid4())},
        json={"conditions": [{"condition": "esr_experimental", "scheduler_configuration_id": config_id}]},
    )
    assert updated.status_code == 200
    assert "condition_implementation_simulated" in updated.json()["activation_blockers"]


def test_model_labels_cannot_certify_the_installed_simulated_adapter(research):
    from uuid import uuid4
    from app.models.research import ModelVersion, ModelConfiguration

    client, engine, *_ = research
    row, _, _ = create(client)
    with Session(engine) as db, db.begin():
        model = ModelVersion(
            task="synthetic-test",
            provider="synthetic",
            model_name="synthetic",
            version=str(uuid4()),
            simulated=False,
            artifact_reference="synthetic-test-only:unvalidated-artifact",
        )
        db.add(model)
        db.flush()
        settings = ModelConfiguration(model_version_id=model.id, version=1, parameters={})
        db.add(settings)
        db.flush()
        scheduler = SchedulerConfiguration(
            algorithm="fifakt",
            implementation_version="fifakt-esr-v1",
            configuration_version=int(uuid4().hex[:6], 16),
            parameters={},
            model_configuration_id=settings.id,
        )
        db.add(scheduler)
        db.flush()
        scheduler_id = str(scheduler.id)
    response = client.post(
        f"{BASE}/{row['id']}/protocols",
        headers={"If-Match": row["revision"], "Idempotency-Key": str(uuid4())},
        json={"conditions": [{"condition": "esr_experimental", "scheduler_configuration_id": scheduler_id}]},
    )
    assert response.status_code == 200
    assert "condition_implementation_simulated" in response.json()["activation_blockers"]
