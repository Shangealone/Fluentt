"""Only synthetic fixtures in the generated UUID PostgreSQL database."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from uuid import uuid4, UUID

import pytest
from sqlalchemy import select, func, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import DBAPIError

from app.models.parallel_study import ParallelProtocol, ParallelAllocation, ParallelClearance
from app.models.research import ResearchStudy, ResearchParticipant, ResearchIdentityLink, ResearchConsentRecord
from app.models.users import User, ClassMembership
from app.models.vocabulary_review import VocabularyPack
from app.modules.parallel_study import service
from app.modules.parallel_study.policy import CONTROL, EXPERIMENTAL, CONTRACT
from app.modules.parallel_study.schemas import Draft
from app.modules.identity.errors import IdentityError
from app.modules.vocabulary_review.service import digest

pytestmark = pytest.mark.postgresql


def prepare(db, graph, n=32):
    add = graph["add"]
    graph["instructor"].profile_status = "active"
    pack = add(VocabularyPack(author_id=graph["instructor"].id, lesson_id=graph["lesson"].id,
                title="Synthetic", language="tagalog", content={"cards": []}, fingerprint="a"*64,
                published_at=datetime.now(timezone.utc)))
    study = add(ResearchStudy(code=uuid4().hex, title="Synthetic", target_language="tagalog", protocol_version="test",
                              conditions={"research_contract": CONTRACT}))
    config = dict(required_consent_kinds=["consent"])
    protocol = add(ParallelProtocol(study_id=study.id, class_id=graph["classroom"].id, pack_id=pack.id,
                    actor_id=graph["instructor"].id, request_id=uuid4(), fingerprint="a"*64,
                    configuration=config, seed=bytes(range(32))))
    add(ParallelClearance(protocol_id=protocol.id, configuration_sha256=digest(config),
                          evidence_reference="SYNTHETIC TEST ONLY", sequence=1, status="verified"))
    participants = []
    for i in range(n):
        user = add(User(username="p"+uuid4().hex[:20], role="school_student", profile_status="active"))
        add(ClassMembership(class_id=protocol.class_id, student_id=user.id, status="active"))
        p = add(ResearchParticipant(study_id=study.id, participant_code=uuid4().hex,
                enrollment_status="enrolled", eligibility_status="eligible"))
        add(ResearchIdentityLink(study_id=study.id, participant_id=p.id, user_id=user.id))
        add(ResearchConsentRecord(participant_id=p.id, kind="consent", protocol_version="test", status="granted",
                                  evidence_reference="SYNTHETIC TEST ONLY", recorded_at=datetime.now(timezone.utc)))
        participants.append(p)
    return protocol, participants


def test_replay_withdrawal_clearance_and_immutable_history(db, graph):
    protocol, people = prepare(db, graph, 2)
    first = service.allocate(db, protocol, people[0].id, graph["instructor"].id)
    assert first == service.allocate(db, protocol, people[0].id, graph["instructor"].id)
    people[0].enrollment_status = "withdrawn"
    db.flush()
    with pytest.raises(IdentityError):
        service.allocate(db, protocol, people[0].id, graph["instructor"].id)
    assert db.scalar(select(func.count()).select_from(ParallelAllocation)) == 1
    with pytest.raises(DBAPIError), db.begin_nested():
        db.execute(text("UPDATE research_private.parallel_allocations SET condition=:c WHERE id=:id"),
                   {"c": CONTROL, "id": UUID(first["id"])})
    db.add(ParallelClearance(protocol_id=protocol.id, configuration_sha256=digest(protocol.configuration),
                             sequence=2, status="revoked", evidence_reference="SYNTHETIC REVOCATION"))
    db.flush()
    with pytest.raises(IdentityError):
        service.allocate(db, protocol, people[1].id, graph["instructor"].id)


@pytest.fixture
def concurrency_engine():
    from tests.integration.conftest import pg_engine as engine_fixture
    yield from engine_fixture.__wrapped__()


def test_concurrent_30_slots_and_duplicate_identity(concurrency_engine):
    pg_engine = concurrency_engine
    from tests.integration.conftest import graph as graph_fixture
    with Session(pg_engine, expire_on_commit=False) as db, db.begin():
        graph = graph_fixture.__wrapped__(db)
        # This fixture commits only to the disposable database; avoid shared test names.
        graph["student"].username = "s"+uuid4().hex[:20]
        graph["instructor"].username = "t"+uuid4().hex[:20]
        protocol, people = prepare(db, graph)
        pid, ids, actor = protocol.id, [p.id for p in people], graph["instructor"].id
    def assign(person):
        with Session(pg_engine) as db, db.begin():
            row = db.scalar(select(ParallelProtocol).where(ParallelProtocol.id == pid).with_for_update())
            return service.allocate(db, row, person, actor)
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(assign, ids[:30]+ids[:2]))
    assert results[0] == results[-2] and results[1] == results[-1]
    with Session(pg_engine) as db:
        conditions = list(db.scalars(select(ParallelAllocation.condition).where(ParallelAllocation.protocol_id == pid)))
        assert conditions.count(CONTROL) == conditions.count(EXPERIMENTAL) == 15
    with pytest.raises(IdentityError):
        assign(ids[30])
    from alembic import command
    from alembic.config import Config
    from tests.integration.conftest import ROOT
    with pytest.raises(RuntimeError, match="evidence exists"), pg_engine.begin() as connection:
        cfg = Config(str(ROOT / "alembic.ini"))
        cfg.attributes["connection"] = connection
        command.downgrade(cfg, "0025_assessed_proficiency")


def test_admin_create_is_authorized_idempotent_and_redacts_seed(db, graph):
    from app.modules.administration.cli import provision
    from app.modules.administration.repository import AdminRepository
    from app.modules.administration.service import issue_session, resolve_session
    from app.models.users import AdminRole, AdminPermission, AdminUserRole, AdminRolePermission
    protocol, _ = prepare(db, graph, 0)
    db.commit()
    repo = AdminRepository(db)
    name = "Parallel_"+uuid4().hex[:10]
    actor = provision(repo, name, "https://id.example", name)
    token = issue_session(repo, "https://id.example", name)
    csrf = resolve_session(repo, token).csrf_token
    payload = Draft(class_id=protocol.class_id, pack_id=protocol.pack_id, title="Synthetic preparation",
                    protocol_version="not-approved", start_date=date(2026, 11, 2), posttest_date=date(2026, 12, 2),
                    required_consent_kinds=["consent"])
    key = uuid4()
    with pytest.raises(IdentityError):
        service.admin(repo, token, action="create", payload=payload, key=key, csrf=csrf)
    with repo.transaction():
        role = AdminRole(name="test_"+uuid4().hex)
        db.add(role)
        db.flush()
        db.add(AdminUserRole(user_id=actor, role_id=role.id))
        for code in ("research.read", "research.manage", f"research.classroom.{protocol.class_id}.read",
                     f"research.classroom.{protocol.class_id}.manage"):
            perm = db.scalar(select(AdminPermission).where(AdminPermission.code == code))
            if not perm:
                perm = AdminPermission(code=code)
                db.add(perm)
                db.flush()
            db.add(AdminRolePermission(role_id=role.id, permission_id=perm.id))
    result = service.admin(repo, token, action="create", payload=payload, key=key, csrf=csrf)
    assert result == service.admin(repo, token, action="create", payload=payload, key=key, csrf=csrf)
    assert result["status"] == "inactive" and not result["live_scheduling_enabled"]
    assert "seed" not in str(result) and "FSRS6_CONTROL" not in result["configuration"]
    with pytest.raises(IdentityError):
        service.admin(repo, token, action="create", payload=payload.model_copy(update={"title": "Other"}), key=key, csrf=csrf)
    with pytest.raises(IdentityError):
        service.admin(repo, token, action="create", payload=payload, key=uuid4(), csrf="bad")
    with pytest.raises(IdentityError):
        service.admin(repo, token, action="create", payload=payload.model_copy(update={"class_id": uuid4()}), key=uuid4(), csrf=csrf)


def test_empty_additive_migration_can_round_trip(concurrency_engine):
    from alembic import command
    from alembic.config import Config
    from tests.integration.conftest import ROOT
    with concurrency_engine.begin() as connection:
        cfg = Config(str(ROOT / "alembic.ini"))
        cfg.attributes["connection"] = connection
        command.downgrade(cfg, "0025_assessed_proficiency")
        assert connection.scalar(text("SELECT to_regclass('research_private.parallel_protocols')")) is None
        assert connection.scalar(text("SELECT to_regclass('research_private.esr_allocations')")) is not None
        command.upgrade(cfg, "head")
        assert connection.scalar(text("SELECT to_regclass('research_private.parallel_protocols')")) is not None
