"""Synthetic HTTP/DB checks exclusively inside the UUID disposable PostgreSQL fixture."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient
from sqlalchemy import select, text, func
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.models.users import User, AdminPermission, AdminRole, AdminRolePermission, AdminUserRole, ClassMembership
from app.models.research import ResearchStudy, ResearchAssessment, ResearchParticipant, ResearchIdentityLink
from app.models.research_classrooms import (
    ResearchClassroomProtocol as Protocol,
    ResearchClassroomBinding as Binding,
    ResearchClassroomEvent as Event,
    ResearchClassroomEnrollment as Enrollment,
)
from app.modules.administration.cli import provision
from app.modules.administration.repository import AdminRepository
from app.modules.administration.service import issue_session, resolve_session
from app.modules.research.classroom_service import class_permission
from app.modules.research.experiment_service import ensure_study_experiment_infrastructure
from tests.integration.test_enrollment_postgresql import account, confirmation
from tests.integration.conftest import ROOT

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/admin/research-classrooms/studies"
MODE = "/api/v1/me/research-classrooms/classes/"


def grant(engine, user_id, *codes):
    # Test-only explicit grants, never production/default researcher provisioning.
    with Session(engine) as db, db.begin():
        role = AdminRole(name="synthetic_" + uuid4().hex)
        db.add(role)
        db.flush()
        db.add(AdminUserRole(user_id=user_id, role_id=role.id))
        for code in codes:
            permission = db.scalar(select(AdminPermission).where(AdminPermission.code == code))
            if permission is None:
                permission = AdminPermission(code=code)
                db.add(permission)
                db.flush()
            db.add(AdminRolePermission(role_id=role.id, permission_id=permission.id))


def admin(engine, client, permissions=True):
    name = "Research_" + uuid4().hex[:12]
    with Session(engine) as db:
        repo = AdminRepository(db)
        user_id = provision(repo, name, "https://id.example", name)
        token = issue_session(repo, "https://id.example", name)
        profile = resolve_session(repo, token)
    if permissions:
        grant(engine, user_id, "research.read", "research.manage")
    client.cookies.set("fluentt_admin", token)
    return user_id, {"X-CSRF-Token": profile.csrf_token}


@pytest.fixture
def research(pg_engine):
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=pg_engine.url.render_as_string(hide_password=False),
        user_creation_limit=1000,
        class_creation_limit=1000,
        mobile_session_request_limit=1000,
        enrollment_peer_limit=1000,
        enrollment_session_limit=1000,
    )
    with TestClient(create_app(settings)) as client:
        client.headers["Origin"] = settings.admin_web_origin
        user_id, headers = admin(pg_engine, client)
        client.headers.update(headers)
        owner, _ = account(client, "instructor")
        result = client.post(
            "/api/v1/classes",
            headers=owner | {"Idempotency-Key": str(uuid4())},
            json={"class_name": "Synthetic research class", "grade_level": 5, "language": "english"},
        )
        assert result.status_code == 201, result.text
        classroom = result.json()
        student, student_id = account(client, "school_student")
        assert (
            client.post(
                "/api/v1/class-memberships", headers=student, json=confirmation(client, student, classroom)
            ).status_code
            == 200
        )
        yield client, pg_engine, user_id, classroom, owner, student, student_id


def create(client, **changes):
    body = {
        "code": "synthetic-" + uuid4().hex,
        "title": "Synthetic draft only",
        "language": "english",
        "protocol_version": "synthetic-unapproved-v1",
        "target_participants": 7,
    } | changes
    retry = {"Idempotency-Key": str(uuid4())}
    response = client.post(BASE, headers=retry, json=body)
    assert response.status_code == 201, response.text
    return response.json(), body, retry


def designate(client, engine, actor, classroom, row):
    grant(engine, actor, class_permission(classroom["id"], "manage"))
    response = client.post(
        f"{BASE}/{row['id']}/classrooms",
        headers={"If-Match": row["revision"], "Idempotency-Key": str(uuid4())},
        json={"class_id": classroom["id"]},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_draft_revision_history_replay_and_no_approval(research):
    client, engine, actor, classroom, *_ = research
    row, body, retry = create(client)
    assert row["status"] == "DRAFT" and row["target_participants"] == 7
    assert "verified_authorization_missing:ethics" in row["activation_blockers"]
    assert client.post(BASE, headers=retry, json=body).json() == row
    assert client.post(BASE, headers=retry, json=body | {"title": "Changed"}).status_code == 409
    path = f"{BASE}/{row['id']}"
    assert client.post(path + "/protocols", headers={"Idempotency-Key": str(uuid4())}, json={}).status_code == 428
    edit = {"Idempotency-Key": str(uuid4()), "If-Match": row["revision"]}
    config = {
        "timezone": "Asia/Manila",
        "active_weekdays": [5, 1],
        "declared_evidence": {"ethics": "synthetic reference is not approval"},
    }
    result = client.post(path + "/protocols", headers=edit, json=config)
    assert result.status_code == 200, result.text
    second = result.json()
    assert second["configuration_version"] == 2 and second["configuration"]["active_weekdays"] == [1, 5]
    assert client.post(path + "/protocols", headers=edit, json=config).json() == second
    assert (
        client.post(
            path + "/protocols", headers={"Idempotency-Key": str(uuid4()), "If-Match": row["revision"]}, json={}
        ).status_code
        == 412
    )
    history = client.get(path + "/protocols?limit=1").json()
    assert history["has_more"] and history["items"][0]["version"] == 2
    assert client.get(path + "/protocols?limit=1&offset=1").json()["items"][0]["configuration"]["timezone"] is None
    assert (
        client.post(
            path + "/state",
            headers={"Idempotency-Key": str(uuid4()), "If-Match": second["revision"]},
            json={"status": "READY"},
        ).status_code
        == 409
    )
    assert (
        client.post(
            path + "/state",
            headers={"Idempotency-Key": str(uuid4()), "If-Match": second["revision"]},
            json={"status": "ACTIVE"},
        ).status_code
        == 409
    )
    assert client.post(path + "/protocols", headers=edit, json={"ethics_approved": True}).status_code == 422
    assert client.get(BASE + "?limit=101").status_code == 422
    assert client.get(path).headers["cache-control"] == "no-store"
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Event).where(Event.scope_id == UUID(row["id"]))) == 2
        study = db.get(ResearchStudy, UUID(row["study_id"]))
        ensure_study_experiment_infrastructure(db, study)
        assert (
            db.scalar(
                select(func.count()).select_from(ResearchAssessment).where(ResearchAssessment.study_id == study.id)
            )
            == 0
        )


def test_class_scoped_grants_membership_personal_denial_and_normal_nonregression(research):
    client, engine, actor, classroom, owner, student, student_id = research
    original = client.get("/api/v1/classes/mine", headers=owner)
    assert original.status_code == 200
    normal = client.get(MODE + classroom["id"], headers=student)
    assert normal.status_code == 200 and normal.json()["mode"] == "normal" and normal.json()["studies"] == []
    row, _, _ = create(client)
    path = f"{BASE}/{row['id']}/classrooms"
    request = {"If-Match": row["revision"], "Idempotency-Key": str(uuid4())}
    assert client.post(path, headers=request, json={"class_id": classroom["id"]}).status_code == 404
    binding = designate(client, engine, actor, classroom, row)
    mode = client.get(MODE + classroom["id"], headers=student).json()
    assert mode["mode"] == "research" and mode["execution_available"] is False
    assert mode["studies"][0]["participation_authorized"] is False
    assert "participant_id" not in str(mode) and "configuration" not in str(mode)
    assert client.get(path).json()["items"][0]["id"] == binding["id"]
    assert client.get("/api/v1/classes/mine", headers=owner).json() == original.json()
    personal, _ = account(client, "personal_student")
    outsider, outsider_id = account(client, "school_student")
    with Session(engine) as db, db.begin():
        db.get(User, outsider_id).profile_status = "active"
    assert client.get(MODE + classroom["id"], headers=personal).status_code == 403
    assert client.get(MODE + classroom["id"], headers=outsider).status_code == 404
    assert client.get(MODE + str(uuid4()), headers=student).status_code == 404
    another_owner, _ = account(client, "instructor")
    other_class = client.post(
        "/api/v1/classes",
        headers=another_owner | {"Idempotency-Key": str(uuid4())},
        json={"class_name": "Other synthetic class", "grade_level": 5, "language": "english"},
    )
    assert other_class.status_code == 201
    assert client.get(MODE + other_class.json()["id"], headers=student).status_code == 404
    assert client.get(MODE + classroom["id"], headers=another_owner).status_code == 404
    with Session(engine) as db, db.begin():
        membership = db.scalar(select(ClassMembership).where(ClassMembership.student_id == student_id))
        membership.status = "left"
        membership.ended_at = datetime.now(timezone.utc)
    response = client.get(MODE + classroom["id"], headers=student)
    assert response.status_code == 404 and response.headers["cache-control"] == "no-store"


def test_admin_rbac_ownership_csrf_origin_and_live_revocation(research):
    client, engine, actor, classroom, *_ = research
    row, body, _ = create(client)
    cookie = client.cookies.get("fluentt_admin")
    original_csrf = client.headers["X-CSRF-Token"]
    assert client.get(BASE, headers={"Authorization": "Bearer not-an-admin-cookie"}).status_code == 401
    _, headers = admin(engine, client, permissions=False)
    assert client.get(BASE).status_code == 403
    _, headers = admin(engine, client)
    client.headers.update(headers)
    assert client.get(f"{BASE}/{row['id']}").status_code == 404
    assert client.get(f"{BASE}/{row['id']}/protocols").status_code == 404
    client.cookies.set("fluentt_admin", cookie)
    client.headers["X-CSRF-Token"] = original_csrf
    assert (
        client.post(BASE, headers={"Idempotency-Key": str(uuid4()), "X-CSRF-Token": "bad"}, json=body).status_code
        == 403
    )
    assert (
        client.post(
            BASE, headers={"Idempotency-Key": str(uuid4()), "Origin": "https://foreign.example"}, json=body
        ).status_code
        == 403
    )
    with Session(engine) as db, db.begin():
        db.get(User, actor).profile_status = "disabled"
    assert client.get(BASE).status_code in (401, 403)


def test_database_immutability_cross_study_guards_and_safe_downgrade(research):
    client, engine, actor, classroom, *_ = research
    row, _, _ = create(client)
    other, _, _ = create(client)
    binding = designate(client, engine, actor, classroom, row)
    statements = [
        ("UPDATE research_private.classroom_protocols SET configuration='{}' WHERE id=:id", row["protocol_id"]),
        ("DELETE FROM research_private.classroom_events WHERE scope_id=:id", row["id"]),
        ("DELETE FROM research_private.classroom_bindings WHERE id=:id", binding["id"]),
        ("UPDATE research_studies SET status='active' WHERE id=:id", row["study_id"]),
        ("UPDATE research_private.classroom_studies SET status='ACTIVE',revision=revision+1 WHERE id=:id", row["id"]),
        ("UPDATE research_private.classroom_studies SET status='READY',revision=revision+1 WHERE id=:id", row["id"]),
    ]
    for sql, key in statements:
        with Session(engine) as db, pytest.raises(DBAPIError), db.begin():
            db.execute(text(sql), {"id": key})
    with Session(engine) as db, pytest.raises(DBAPIError), db.begin():
        db.add(Binding(scope_id=UUID(row["id"]), study_id=UUID(other["study_id"]), class_id=UUID(classroom["id"])))
        db.flush()
    with engine.begin() as connection:
        config = Config(str(ROOT / "alembic.ini"))
        config.attributes["connection"] = connection
        with pytest.raises(DBAPIError), connection.begin_nested():
            command.downgrade(config, "0016_learning_experience")
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == ScriptDirectory.from_config(Config(str(ROOT / "alembic.ini"))).get_current_head()


def test_personal_identity_cannot_enter_research_enrollment(research):
    client, engine, actor, classroom, *_ = research
    row, _, _ = create(client)
    binding = designate(client, engine, actor, classroom, row)
    _, personal_id = account(client, "personal_student")
    with Session(engine) as db, db.begin():
        participant = ResearchParticipant(
            study_id=UUID(row["study_id"]), participant_code="synthetic-only", enrollment_status="pending"
        )
        db.add(participant)
        db.flush()
        participant_id = participant.id
        db.add(ResearchIdentityLink(study_id=participant.study_id, participant_id=participant_id, user_id=personal_id))
    with Session(engine) as db, pytest.raises(DBAPIError), db.begin():
        db.add(
            Enrollment(
                study_id=UUID(row["study_id"]),
                binding_id=UUID(binding["id"]),
                participant_id=participant_id,
                protocol_id=UUID(row["protocol_id"]),
                authorization_state="pending",
            )
        )
        db.flush()


def test_same_request_concurrency_and_stale_writers(research):
    client, engine, actor, *_ = research
    row, _, _ = create(client)
    path = f"{BASE}/{row['id']}/protocols"
    headers = {"Idempotency-Key": str(uuid4()), "If-Match": row["revision"]}
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: client.post(path, headers=headers, json={"timezone": "UTC"}), range(2)))
    assert [r.status_code for r in results] == [200, 200]
    assert results[0].json() == results[1].json()
    stale = client.post(path, headers=headers | {"Idempotency-Key": str(uuid4())}, json={"timezone": "UTC"})
    assert stale.status_code == 412
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Protocol).where(Protocol.scope_id == UUID(row["id"]))) == 2


def test_synthetic_clearance_state_machine_and_revocation(research):
    """Tests only: synthetic ledger entries are NOT actual institutional approval."""
    from app.models.research import SchedulerConfiguration
    from app.models.research_classrooms import ResearchClassroomClearance as Clearance

    client, engine, actor, classroom, *_ = research
    row, _, _ = create(client)
    designate(client, engine, actor, classroom, row)
    path = f"{BASE}/{row['id']}"
    row = client.get(path).json()
    with Session(engine) as db, db.begin():
        scheduler = SchedulerConfiguration(
            algorithm="sm2",
            implementation_version="sm2-classic-v1",
            configuration_version=1,
            parameters={"synthetic": True},
        )
        instrument = ResearchAssessment(
            study_id=UUID(row["study_id"]),
            kind="pre_test",
            instrument_version="synthetic-v1",
            instrument_snapshot={"synthetic": True},
            locked_at=datetime.now(timezone.utc),
        )
        db.add_all([scheduler, instrument])
        db.flush()
        scheduler_id, instrument_id = str(scheduler.id), str(instrument.id)
    configuration = {
        "protocol_reference": "SYNTHETIC-TEST-NOT-APPROVAL",
        "starts_at": "2027-01-01T00:00:00Z",
        "ends_at": "2027-01-09T00:00:00Z",
        "timezone": "Asia/Manila",
        "active_weekdays": [2, 4],
        "due_date_policy": {"version": "synthetic-v1", "reference": "synthetic policy"},
        "consent_document_version": "synthetic-v1",
        "consent_requirements": ["consent"],
        "allocation_unit": "classroom",
        "allocation_policy": {"version": "synthetic-v1", "reference": "test only"},
        "conditions": [{"condition": "sm2_control", "scheduler_configuration_id": scheduler_id}],
        "assessments": [
            {
                "assessment_id": instrument_id,
                "instrument_version": "synthetic-v1",
                "opens_at": "2027-01-01T01:00:00Z",
                "closes_at": "2027-01-01T02:00:00Z",
                "timer_limit_seconds": 123,
            }
        ],
    }
    revised = client.post(
        path + "/protocols", headers={"If-Match": row["revision"], "Idempotency-Key": str(uuid4())}, json=configuration
    )
    assert revised.status_code == 200, revised.text
    row = revised.json()
    assert any(b.startswith("verified_authorization_missing:") for b in row["activation_blockers"])
    with Session(engine) as db, db.begin():
        for kind in ("protocol", "ethics", "site_permission", "instruments", "conditions"):
            db.add(
                Clearance(
                    protocol_id=UUID(row["protocol_id"]),
                    kind=kind,
                    sequence=1,
                    status="verified",
                    evidence_reference="SYNTHETIC fixture only",
                    evidence_sha256="a" * 64,
                    verifier_reference="SYNTHETIC verifier",
                    recorded_at=datetime.now(timezone.utc),
                )
            )
    assert client.get(path).json()["activation_blockers"] == []
    active_retry = None
    for status in ("READY", "ACTIVE", "PAUSED"):
        headers = {"If-Match": row["revision"], "Idempotency-Key": str(uuid4())}
        response = client.post(path + "/state", headers=headers, json={"status": status})
        assert response.status_code == 200, response.text
        row = response.json()
        assert row["status"] == status
        if status == "ACTIVE":
            active_retry = headers, row
    # Late committed ACTIVE replay returns its receipt but cannot undo PAUSED.
    assert client.post(path + "/state", headers=active_retry[0], json={"status": "ACTIVE"}).json() == active_retry[1]
    assert client.get(path).json()["status"] == "PAUSED"
    assert (
        client.post(
            path + "/protocols",
            headers={"If-Match": row["revision"], "Idempotency-Key": str(uuid4())},
            json=configuration,
        ).status_code
        == 409
    )
    with Session(engine) as db, db.begin():
        db.add(
            Clearance(
                protocol_id=UUID(row["protocol_id"]),
                kind="ethics",
                sequence=2,
                status="revoked",
                evidence_reference="SYNTHETIC revocation",
                evidence_sha256="b" * 64,
                verifier_reference="SYNTHETIC verifier",
                recorded_at=datetime.now(timezone.utc),
            )
        )
    assert "verified_authorization_missing:ethics" in client.get(path).json()["activation_blockers"]
    assert (
        client.post(
            path + "/state",
            headers={"If-Match": row["revision"], "Idempotency-Key": str(uuid4())},
            json={"status": "ACTIVE"},
        ).status_code
        == 409
    )
    completed = client.post(
        path + "/state",
        headers={"If-Match": row["revision"], "Idempotency-Key": str(uuid4())},
        json={"status": "COMPLETED"},
    )
    assert completed.status_code == 200 and completed.json()["status"] == "COMPLETED"
    # Existing root remains a draft and cannot be used by legacy recruitment/execution.
    with Session(engine) as db:
        assert db.get(ResearchStudy, UUID(row["study_id"])).status == "draft"


def test_wrong_instrument_study_version_condition_and_class_language(research):
    from app.models.research import SchedulerConfiguration

    client, engine, actor, classroom, *_ = research
    row, _, _ = create(client)
    other, _, _ = create(client)
    with Session(engine) as db, db.begin():
        instrument = ResearchAssessment(
            study_id=UUID(other["study_id"]),
            kind="post_test",
            instrument_version="synthetic-v1",
            instrument_snapshot={"synthetic": True},
            locked_at=datetime.now(timezone.utc),
        )
        scheduler = SchedulerConfiguration(
            algorithm="sm2", implementation_version="synthetic-" + uuid4().hex, configuration_version=1, parameters={}
        )
        db.add_all([instrument, scheduler])
        db.flush()
        instrument_id, scheduler_id = str(instrument.id), str(scheduler.id)
    path = f"{BASE}/{row['id']}/protocols"
    headers = {"If-Match": row["revision"], "Idempotency-Key": str(uuid4())}
    assert (
        client.post(
            path,
            headers=headers,
            json={"assessments": [{"assessment_id": instrument_id, "instrument_version": "synthetic-v1"}]},
        ).status_code
        == 404
    )
    assert (
        client.post(
            path,
            headers=headers,
            json={"conditions": [{"condition": "esr_experimental", "scheduler_configuration_id": scheduler_id}]},
        ).status_code
        == 422
    )

    other_path = f"{BASE}/{other['id']}/protocols"
    assert (
        client.post(
            other_path,
            headers={"If-Match": other["revision"], "Idempotency-Key": str(uuid4())},
            json={"assessments": [{"assessment_id": instrument_id, "instrument_version": "wrong-version"}]},
        ).status_code
        == 422
    )
    tagalog, _, _ = create(client, language="tagalog")
    grant(engine, actor, class_permission(classroom["id"], "manage"))
    assert (
        client.post(
            f"{BASE}/{tagalog['id']}/classrooms",
            headers={"If-Match": tagalog["revision"], "Idempotency-Key": str(uuid4())},
            json={"class_id": classroom["id"]},
        ).status_code
        == 422
    )


def test_class_grant_revocation_and_personal_state_unchanged(research):
    from sqlalchemy import delete
    from app.models.learning import LearningContext

    client, engine, actor, classroom, *_ = research
    _, personal_id = account(client, "personal_student")
    with Session(engine) as db, db.begin():
        db.add(LearningContext(student_id=personal_id, kind="personal"))

    def snapshot():
        with engine.connect() as connection:
            # Test DB only. Nonempty personal context/profile plus complete state/event tables.
            return {
                table: connection.execute(text(f"SELECT to_jsonb(t)::text FROM {table} t ORDER BY id")).scalars().all()
                for table in (
                    "learner_profiles",
                    "learning_contexts",
                    "learner_progress",
                    "vocabulary_review_states",
                    "vocabulary_review_events",
                )
            }

    before = snapshot()
    row, _, _ = create(client)
    designate(client, engine, actor, classroom, row)
    path = f"{BASE}/{row['id']}/classrooms"
    assert len(client.get(path).json()["items"]) == 1
    with Session(engine) as db, db.begin():
        permission = db.scalar(
            select(AdminPermission.id).where(AdminPermission.code == class_permission(classroom["id"], "manage"))
        )
        roles = select(AdminUserRole.role_id).where(AdminUserRole.user_id == actor)
        db.execute(
            delete(AdminRolePermission).where(
                AdminRolePermission.role_id.in_(roles), AdminRolePermission.permission_id == permission
            )
        )
    assert client.get(path).json()["items"] == []
    fresh = client.get(f"{BASE}/{row['id']}").json()
    assert (
        client.post(
            path,
            headers={"If-Match": fresh["revision"], "Idempotency-Key": str(uuid4())},
            json={"class_id": classroom["id"]},
        ).status_code
        == 404
    )
    assert snapshot() == before


def test_empty_additive_migration_roundtrip_only_in_own_uuid_database():
    from tests.integration.conftest import pg_engine as disposable_fixture

    generator = disposable_fixture.__wrapped__()
    engine = next(generator)
    try:
        with engine.begin() as connection:
            config = Config(str(ROOT / "alembic.ini"))
            config.attributes["connection"] = connection
            command.downgrade(config, "0016_learning_experience")
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "0016_learning_experience"
            command.upgrade(config, "0017_research_classrooms")
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "0017_research_classrooms"
    finally:
        generator.close()


def test_simulated_or_missing_model_remains_blocked(research):
    from app.models.research import SchedulerConfiguration

    client, engine, *_ = research
    row, _, _ = create(client)
    with Session(engine) as db, db.begin():
        scheduler = SchedulerConfiguration(
            algorithm="fifakt",
            implementation_version="synthetic-" + uuid4().hex,
            configuration_version=1,
            parameters={"simulated": True},
        )
        db.add(scheduler)
        db.flush()
        scheduler_id = str(scheduler.id)
    response = client.post(
        f"{BASE}/{row['id']}/protocols",
        headers={"If-Match": row["revision"], "Idempotency-Key": str(uuid4())},
        json={"conditions": [{"condition": "esr_experimental", "scheduler_configuration_id": scheduler_id}]},
    )
    assert response.status_code == 200, response.text
    assert "condition_model_unvalidated" in response.json()["activation_blockers"]
