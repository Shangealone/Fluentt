"""Complete Track 1 paths with synthetic identities in disposable local PostgreSQL."""
from datetime import datetime, date, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4
import secrets

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text, func
from sqlalchemy.exc import DBAPIError

from app.core.config import Settings
from app.core.security import credential_digest
from app.db.session import get_session
from app.main import create_app
from app.models.users import User, UserSession, ClassMembership
from app.models.research import ResearchStudy, ResearchParticipant
from app.models.learning import VocabularyItem
from app.models.vocabulary_review import VocabularyPack
from app.models.parallel_study import ParallelProtocol, ParallelAssessment, ParallelOpportunity, ParallelAllocation
from app.models.parallel_workflow import WorkflowAttempt, WorkflowMemory, WorkflowEvent
from app.modules.parallel_study import workflow_engine as engine
from app.modules.parallel_study.policy import CONTROL, EXPERIMENTAL, CONTRACT, windows
from app.modules.parallel_study.workflow_schemas import WorkflowSetup, Enrollment
from app.modules.spaced_repetition.fsrs6 import calculate_fsrs6
from tests.test_vocabulary_review import card

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/me/parallel-test/studies"


@pytest.fixture
def flow(db, graph, monkeypatch, request):
    def add(row):
        db.add(row)
        db.flush()
        return row
    graph["instructor"].profile_status = "active"
    definition = card()
    add(VocabularyItem(id=definition.vocabulary_item_id, lesson_id=graph["lesson"].id, language="tagalog",
                       term=definition.term, meaning=definition.meaning, version=1))
    pack = add(VocabularyPack(author_id=graph["instructor"].id, lesson_id=graph["lesson"].id,
        title="SYNTHETIC Track 1", language="tagalog", content={"cards": [definition.model_dump(mode="json")]},
        fingerprint="a"*64, published_at=datetime.now(timezone.utc)))
    study = add(ResearchStudy(code=uuid4().hex, title="SYNTHETIC Track 1", target_language="tagalog",
                              protocol_version="TEST-v1", conditions={"research_contract": CONTRACT}))
    config = dict(title="SYNTHETIC Track 1", start_date="2026-11-02", end_date="2026-12-02",
                  posttest_date="2026-12-02", timezone="Asia/Manila", required_consent_kinds=["consent"])
    protocol = add(ParallelProtocol(study_id=study.id, class_id=graph["classroom"].id, pack_id=pack.id,
          actor_id=graph["instructor"].id, request_id=uuid4(), fingerprint="a"*64, configuration=config, seed=bytes(32)))
    for day, opens, closes in windows(date(2026, 11, 2), "Asia/Manila"):
        add(ParallelOpportunity(protocol_id=protocol.id, local_date=day, opens_at=opens, closes_at=closes))
    for kind, day in (("pretest", None), ("posttest", date(2026, 12, 2)), ("delayed", date(2026, 12, 9))):
        add(ParallelAssessment(protocol_id=protocol.id, kind=kind, designated_date=day))
    clock = SimpleNamespace(at=datetime(2026, 11, 1, tzinfo=timezone.utc))
    monkeypatch.setattr(engine, "now", lambda: clock.at)
    setup = WorkflowSetup(pretest_date=date(2026, 11, 1), assessment_version="TEST-INSTRUMENT-v1",
           assessment_format=getattr(request, "param", "multiple_choice"), policy="development-objective-complete-v1",
           approvals={kind: "SYNTHETIC: fixture" for kind in ("protocol", "ethics", "site")})
    engine.configure(db, protocol, setup, graph["instructor"].id)
    accounts = []
    for _ in range(30):
        user = add(User(username="wf_"+uuid4().hex[:20], role="school_student", profile_status="active"))
        add(ClassMembership(class_id=protocol.class_id, student_id=user.id, status="active"))
        enrollment = Enrollment(user_id=user.id, eligibility_confirmed=True, consent_evidence={"consent": "SYNTHETIC: fixture"})
        result = engine.enroll(db, protocol, enrollment, graph["instructor"].id)
        assert result == engine.enroll(db, protocol, enrollment, graph["instructor"].id)
        allocation = db.get(ParallelAllocation, UUID(result["id"]))
        token = "flt_"+secrets.token_urlsafe(32)
        auth_now = datetime.now(timezone.utc)
        add(UserSession(user_id=user.id, credential_digest=credential_digest(token),
            expires_at=auth_now+timedelta(days=1), absolute_expires_at=auth_now+timedelta(days=2)))
        accounts.append(dict(user=user, allocation=allocation, headers={"Authorization": "Bearer "+token}, enrollment=enrollment))
    owner_token = "flt_"+secrets.token_urlsafe(32)
    add(UserSession(user_id=graph["instructor"].id, credential_digest=credential_digest(owner_token),
          expires_at=datetime.now(timezone.utc)+timedelta(days=1), absolute_expires_at=datetime.now(timezone.utc)+timedelta(days=2)))
    db.commit()
    settings = Settings(_env_file=None, environment="test", database_url=None,
            parallel_research_enabled=True, parallel_test_workflows_enabled=True, mobile_session_request_limit=10000)
    app = create_app(settings)
    def test_session():
        # Assertions may have opened a read transaction between HTTP requests.
        if db.in_transaction():
            db.commit()
        yield db
    app.app.dependency_overrides[get_session] = test_session
    with TestClient(app) as client:
        yield SimpleNamespace(db=db, client=client, protocol=protocol, clock=clock, definition=definition,
            accounts=accounts, control=next(a for a in accounts if a["allocation"].condition == CONTROL),
            experimental=next(a for a in accounts if a["allocation"].condition == EXPERIMENTAL),
            owner_headers={"Authorization": "Bearer "+owner_token}, graph=graph, setup=setup)


def tasks(f, account=None):
    response = f.client.get(BASE+"/"+str(f.protocol.id), headers=(account or f.control)["headers"])
    assert response.status_code == 200, response.text
    return response.json()["tasks"]


def task(f, title, account=None):
    return next(t for t in tasks(f, account) if t["title"] == title)


def begin(f, target, account=None):
    response = f.client.post(f"{BASE}/{f.protocol.id}/{target['kind']}/{target['id']}/start", headers=(account or f.control)["headers"])
    assert response.status_code == 200, response.text
    return response.json()


def submit(f, attempt, account=None, *, activity=False, answer="a"):
    key = str(f.definition.vocabulary_item_id)
    body = dict(responses={key: answer}, ratings={key: "good"} if activity else {},
                expected_revision=attempt["revision"], request_id=str(uuid4()))
    url = f"{BASE}/{f.protocol.id}/attempts/{attempt['id']}/submit"
    response = f.client.post(url, headers=(account or f.control)["headers"], json=body)
    assert response.status_code == 200, response.text
    return response.json(), body


def pretest(f, account=None):
    return submit(f, begin(f, task(f, "pretest", account), account), account)[0]


def test_complete_control_journey_persistence_scoring_and_exact_fsrs(flow):
    f = flow
    assert len(f.accounts) == 30
    assert sum(a["allocation"].condition == CONTROL for a in f.accounts) == 15
    initial = begin(f, task(f, "pretest"))
    assert "correct_option_id" not in str(initial) and "accepted_forms" not in str(initial)
    key = str(f.definition.vocabulary_item_id)
    url = f"{BASE}/{f.protocol.id}/attempts/{initial['id']}"
    saved = f.client.post(url+"/save", headers=f.control["headers"], json=dict(responses={key: "a"},
              expected_revision=1, request_id=str(uuid4())))
    assert saved.status_code == 200 and saved.json()["revision"] == 2
    restored = f.client.get(url, headers=f.control["headers"]).json()
    assert restored["responses"] == {key: "a"}
    receipt, body = submit(f, restored)
    assert receipt["result"]["points"] == receipt["result"]["maximum"] == 1
    assert f.client.post(url+"/submit", headers=f.control["headers"], json=body).json() == receipt
    assert "cards" not in receipt
    f.clock.at = datetime(2026, 11, 2, tzinfo=timezone.utc)
    assert task(f, "2026-11-03")["status"] == "blocked_publication"
    owner = f.client.post(f"/api/v1/instructor/parallel-test/{f.protocol.id}/publish", headers=f.owner_headers)
    assert owner.status_code == 200
    assert task(f, "2026-11-03")["status"] == "locked"
    activity = begin(f, task(f, "2026-11-02"))
    result, retry = submit(f, activity, activity=True)
    expected = calculate_fsrs6({}, "good", f.clock.at, revision=1)
    memory = f.db.scalar(select(WorkflowMemory).where(WorkflowMemory.allocation_id == f.control["allocation"].id))
    assert memory.memory == expected.resulting_state and memory.due_at == expected.due_at and memory.revision == 2
    f.clock.at += timedelta(days=2)
    assert f.client.post(f"{BASE}/{f.protocol.id}/attempts/{activity['id']}/submit", headers=f.control["headers"], json=retry).json() == result
    assert task(f, "2026-11-02")["status"] == "completed"
    f.clock.at = datetime(2026, 12, 2, tzinfo=timezone.utc)
    assert submit(f, begin(f, task(f, "posttest")))[0]["result"]["points"] == 1
    assert task(f, "delayed")["status"] == "locked"
    f.clock.at = datetime(2026, 12, 9, tzinfo=timezone.utc)
    assert submit(f, begin(f, task(f, "delayed")))[0]["result"]["points"] == 1
    assert f.client.get(BASE+"/"+str(f.protocol.id), headers=f.control["headers"]).json()["status"] == "assessment_sequence_completed"


def test_experimental_learning_is_blocked_not_fake_control(flow):
    f = flow
    assert pretest(f, f.experimental)["result"]["points"] == 1
    f.clock.at = datetime(2026, 11, 2, tzinfo=timezone.utc)
    target = task(f, "2026-11-02", f.experimental)
    assert target["status"] == "blocked_model"
    response = f.client.post(f"{BASE}/{f.protocol.id}/activity/{target['id']}/start", headers=f.experimental["headers"])
    assert response.status_code == 409
    assert f.db.scalar(select(func.count()).select_from(WorkflowAttempt).where(
          WorkflowAttempt.allocation_id == f.experimental["allocation"].id, WorkflowAttempt.opportunity_id.is_not(None))) == 0


def test_control_second_review_uses_prior_memory_and_observed_failure(flow):
    f = flow
    pretest(f)
    f.client.post(f"/api/v1/instructor/parallel-test/{f.protocol.id}/publish", headers=f.owner_headers)
    f.clock.at = datetime(2026, 11, 2, tzinfo=timezone.utc)
    submit(f, begin(f, task(f, "2026-11-02")), activity=True)
    memory = f.db.scalar(select(WorkflowMemory).where(WorkflowMemory.allocation_id == f.control["allocation"].id))
    prior, revision = dict(memory.memory), memory.revision
    next_day = f.db.scalar(select(ParallelOpportunity).where(ParallelOpportunity.protocol_id == f.protocol.id,
           ParallelOpportunity.closes_at > memory.due_at).order_by(ParallelOpportunity.opens_at).limit(1))
    f.clock.at = max(next_day.opens_at, memory.due_at)
    attempt = begin(f, task(f, next_day.local_date.isoformat()))
    wrong = "b" if attempt["cards"][0]["format"] == "multiple_choice" else "wrong"
    key = str(f.definition.vocabulary_item_id)
    body = dict(responses={key: wrong}, ratings={key: "easy"}, expected_revision=1, request_id=str(uuid4()))
    response = f.client.post(f"{BASE}/{f.protocol.id}/attempts/{attempt['id']}/submit", headers=f.control["headers"], json=body)
    assert response.status_code == 200, response.text
    assert response.json()["result"]["points"] == 0
    expected = calculate_fsrs6(prior, "again", f.clock.at, revision=revision)
    assert memory.memory == expected.resulting_state and memory.due_at == expected.due_at
    retained = f.db.get(WorkflowAttempt, UUID(attempt["id"]))
    assert retained.result["decisions"][key]["raw_rating"] == "easy"
    assert retained.result["decisions"][key]["effective_rating"] == "again"
    assert retained.result["scheduler_identity"]["implementation_version"] == "fsrs-6-reference-v1"


def test_closed_partial_missing_attempts_and_final_immutability(flow):
    f = flow
    pretest(f)
    f.client.post(f"/api/v1/instructor/parallel-test/{f.protocol.id}/publish", headers=f.owner_headers)
    f.clock.at = datetime(2026, 11, 2, tzinfo=timezone.utc)
    attempt = begin(f, task(f, "2026-11-02"))
    f.clock.at = datetime(2026, 11, 2, 16, tzinfo=timezone.utc)
    assert task(f, "2026-11-02")["status"] == "missed_incomplete"
    response = f.client.post(f"{BASE}/{f.protocol.id}/attempts/{attempt['id']}/submit", headers=f.control["headers"],
           json=dict(responses={str(f.definition.vocabulary_item_id): "a"}, ratings={str(f.definition.vocabulary_item_id): "good"},
                     expected_revision=1, request_id=str(uuid4())))
    assert response.status_code == 409
    f.clock.at = datetime(2026, 12, 3, tzinfo=timezone.utc)
    assert task(f, "posttest")["status"] == "missed"
    assert f.db.scalar(select(WorkflowEvent).where(WorkflowEvent.participant_id == f.control["allocation"].participant_id,
               WorkflowEvent.kind == "assessment_missed")) is not None
    row = f.db.get(WorkflowAttempt, UUID(attempt["id"]))
    assert row.submitted_at is None and row.result == {}


def test_withdrawal_and_unauthorized_attempt_access(flow):
    f = flow
    attempt = begin(f, task(f, "pretest"))
    stolen = f.client.get(f"{BASE}/{f.protocol.id}/attempts/{attempt['id']}", headers=f.experimental["headers"])
    assert stolen.status_code == 404
    withdrawn = f.client.post(f"{BASE}/{f.protocol.id}/withdraw", headers=f.control["headers"])
    assert withdrawn.status_code == 200
    assert f.client.post(f"{BASE}/{f.protocol.id}/withdraw", headers=f.control["headers"]).json() == withdrawn.json()
    assert f.db.get(ResearchParticipant, f.control["allocation"].participant_id).enrollment_status == "withdrawn"
    assert f.client.get(f"{BASE}/{f.protocol.id}/attempts/{attempt['id']}", headers=f.control["headers"]).status_code == 403
    assert f.db.get(ParallelAllocation, f.control["allocation"].id) is not None


def test_database_rejects_final_response_mutation(flow):
    f = flow
    receipt = pretest(f)
    f.db.commit()
    with pytest.raises(DBAPIError), f.db.begin_nested():
        f.db.execute(text("UPDATE research_private.parallel_workflow_attempts SET responses='{}' WHERE id=:id"), {"id": UUID(receipt["id"])})


def test_revision_invalid_answers_and_no_zero_for_incomplete(flow):
    f = flow
    initial = begin(f, task(f, "pretest"))
    url = f"{BASE}/{f.protocol.id}/attempts/{initial['id']}"
    key = str(f.definition.vocabulary_item_id)
    body = dict(responses={key: "not-an-option"}, expected_revision=1, request_id=str(uuid4()))
    assert f.client.post(url+"/submit", headers=f.control["headers"], json=body).status_code == 422
    body["responses"] = {}
    assert f.client.post(url+"/submit", headers=f.control["headers"], json=body).status_code == 422
    body["responses"] = {key: "a"}
    assert f.client.post(url+"/save", headers=f.control["headers"], json=body).status_code == 200
    assert f.client.post(url+"/submit", headers=f.control["headers"], json=body).status_code == 409
    assert f.db.get(WorkflowAttempt, UUID(initial["id"])).result == {}


@pytest.mark.parametrize("flow", ["typed_recall"], indirect=True)
def test_typed_assessments_use_pinned_existing_checking_policy(flow):
    f = flow
    initial = begin(f, task(f, "pretest"))
    assert initial["cards"][0]["options"] == []
    assert submit(f, initial, answer="cafe")[0]["result"]["points"] == 0
    f.clock.at = datetime(2026, 12, 2, tzinfo=timezone.utc)
    assert submit(f, begin(f, task(f, "posttest")), answer=" CAFE\u0301 ")[0]["result"]["points"] == 1


def test_enrollment_rejects_ineligible_accounts_and_changed_consent(flow):
    from app.modules.identity.errors import IdentityError
    f = flow
    with pytest.raises(IdentityError):
        engine.enroll(f.db, f.protocol, f.control["enrollment"].model_copy(update={"user_id": f.graph["instructor"].id}), f.graph["instructor"].id)
    with pytest.raises(IdentityError):
        engine.enroll(f.db, f.protocol, f.control["enrollment"].model_copy(update={"consent_evidence": {"assent": "SYNTHETIC: wrong kind"}}), f.graph["instructor"].id)
    with pytest.raises(IdentityError):
        engine.enroll(f.db, f.protocol, f.control["enrollment"].model_copy(update={"consent_evidence": {"consent": "SYNTHETIC: changed retry"}}), f.graph["instructor"].id)


def test_current_membership_and_clearance_required(flow):
    from app.models.parallel_study import ParallelClearance
    from app.modules.vocabulary_review.service import digest
    f = flow
    member = f.db.scalar(select(ClassMembership).where(ClassMembership.student_id == f.control["user"].id))
    member.status, member.ended_at = "left", datetime.now(timezone.utc)
    f.db.commit()
    assert f.client.get(BASE+"/"+str(f.protocol.id), headers=f.control["headers"]).status_code == 403
    # Withdrawal remains possible after loss of class access.
    assert f.client.post(BASE+"/"+str(f.protocol.id)+"/withdraw", headers=f.control["headers"]).status_code == 200
    f.db.add(ParallelClearance(protocol_id=f.protocol.id, sequence=2, status="revoked",
             configuration_sha256=digest(f.protocol.configuration), evidence_reference="SYNTHETIC: revoked"))
    f.db.commit()
    assert f.client.get(BASE+"/"+str(f.protocol.id), headers=f.experimental["headers"]).status_code == 409
    assert f.client.post(f"/api/v1/instructor/parallel-test/{f.protocol.id}/publish", headers=f.owner_headers).status_code == 409


def test_missing_baseline_does_not_hide_expired_assessment_or_make_zero(flow):
    f = flow
    f.clock.at = datetime(2026, 12, 3, tzinfo=timezone.utc)
    assert task(f, "posttest")["status"] == "missed"
    events = list(f.db.scalars(select(WorkflowEvent).where(WorkflowEvent.participant_id == f.control["allocation"].participant_id,
             WorkflowEvent.kind == "assessment_missed")))
    assert any(event.evidence.get("prerequisite_incomplete") for event in events)
    assert f.db.scalar(select(func.count()).select_from(WorkflowAttempt).where(
             WorkflowAttempt.allocation_id == f.control["allocation"].id)) == 0


def test_admin_enrollment_requires_live_grants_and_csrf(flow):
    from app.modules.administration.cli import provision
    from app.modules.administration.repository import AdminRepository
    from app.modules.administration.service import issue_session, resolve_session
    from app.models.users import AdminRole, AdminPermission, AdminUserRole, AdminRolePermission
    from app.modules.parallel_study.workflow_service import admin
    from app.modules.identity.errors import IdentityError
    f = flow
    repo = AdminRepository(f.db)
    name = "Track1_"+uuid4().hex[:12]
    actor = provision(repo, name, "https://id.example", name)
    token = issue_session(repo, "https://id.example", name)
    csrf = resolve_session(repo, token).csrf_token
    settings = f.client.app.app.state.settings
    args = dict(action="enroll", protocol_id=f.protocol.id, payload=f.control["enrollment"])
    with pytest.raises(IdentityError):
        admin(repo, token, settings, csrf=csrf, **args)
    with repo.transaction():
        role = AdminRole(name="wf_"+uuid4().hex)
        f.db.add(role)
        f.db.flush()
        f.db.add(AdminUserRole(user_id=actor, role_id=role.id))
        for code in ("research.read", "research.manage", f"research.classroom.{f.protocol.class_id}.manage"):
            perm = f.db.scalar(select(AdminPermission).where(AdminPermission.code == code))
            if not perm:
                perm = AdminPermission(code=code)
                f.db.add(perm)
                f.db.flush()
            f.db.add(AdminRolePermission(role_id=role.id, permission_id=perm.id))
    with pytest.raises(IdentityError):
        admin(repo, token, settings, csrf="wrong", **args)
    assert admin(repo, token, settings, csrf=csrf, **args)["id"] == str(f.control["allocation"].id)
    assert admin(repo, token, settings, csrf=csrf, action="configure", protocol_id=f.protocol.id, payload=f.setup)["status"] == "configured_development_only"


def test_concurrent_enrollment_and_final_retry_are_one_record(monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from sqlalchemy.orm import Session
    from tests.integration.conftest import pg_engine, graph as graph_fixture
    from app.modules.classrooms.repository import ClassroomRepository
    from app.modules.parallel_study.workflow_service import mobile
    from app.modules.parallel_study.workflow_schemas import Snapshot
    engine_fixture = pg_engine.__wrapped__()
    pg = next(engine_fixture)
    try:
        with Session(pg, expire_on_commit=False) as db:
            graph = graph_fixture.__wrapped__(db)
            fixture = flow.__wrapped__(db, graph, monkeypatch, None)
            f = next(fixture)
            try:
                initial = begin(f, task(f, "pretest"))
                db.commit()
                settings = f.client.app.app.state.settings
                pid, actor, payload = f.protocol.id, graph["instructor"].id, f.control["enrollment"]
                def enrollment_retry(_):
                    with Session(pg) as thread_db, thread_db.begin():
                        protocol = thread_db.scalar(select(ParallelProtocol).where(ParallelProtocol.id == pid).with_for_update())
                        return engine.enroll(thread_db, protocol, payload, actor)
                with ThreadPoolExecutor(max_workers=3) as executor:
                    results = list(executor.map(enrollment_retry, range(3)))
                assert results[0] == results[1] == results[2]
                body = Snapshot(responses={str(f.definition.vocabulary_item_id): "a"}, expected_revision=1, request_id=uuid4())
                token = f.control["headers"]["Authorization"][7:]
                def final_retry(_):
                    with Session(pg) as thread_db:
                        return mobile(ClassroomRepository(thread_db), token, settings, action="submit", protocol_id=pid,
                                      target_id=UUID(initial["id"]), payload=body)
                with ThreadPoolExecutor(max_workers=3) as executor:
                    receipts = list(executor.map(final_retry, range(3)))
                assert receipts[0] == receipts[1] == receipts[2]
                assert db.scalar(select(func.count()).select_from(WorkflowAttempt).where(WorkflowAttempt.submitted_at.is_not(None))) == 1
                from alembic import command
                from alembic.config import Config
                from tests.integration.conftest import ROOT
                with pytest.raises(RuntimeError, match="Workflow evidence exists"), pg.begin() as connection:
                    config = Config(str(ROOT/"alembic.ini"))
                    config.attributes["connection"] = connection
                    command.downgrade(config, "0026_parallel_foundation")
            finally:
                fixture.close()
    finally:
        engine_fixture.close()
