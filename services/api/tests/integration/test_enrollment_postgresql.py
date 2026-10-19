"""Conditional PostgreSQL proof. All mutations target the fixture's UUID disposable database."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.models.operations import AuditLog
from app.models.users import Classroom, ClassJoinCode, ClassMembership, User
from app.modules.classrooms import service as class_service
from app.modules.enrollment.repository import EnrollmentRepository

pytestmark = pytest.mark.postgresql
PREVIEW = "/api/v1/class-enrollment-previews"
JOIN = "/api/v1/class-memberships"


def account(client, role):
    response = client.post("/api/v1/users", json={"username": "Enroll_" + uuid4().hex[:12], "role": role})
    assert response.status_code == 201
    return {"Authorization": "Bearer " + response.json()["session"]["credential"]}, UUID(response.json()["user"]["id"])


@pytest.fixture
def enrollment_db(pg_engine, monkeypatch):
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=pg_engine.url.render_as_string(hide_password=False),
        user_creation_limit=1000,
        class_creation_limit=1000,
        enrollment_peer_limit=1000,
        enrollment_session_limit=1000,
        mobile_session_request_limit=1000,
    )
    owned_ids = []
    with TestClient(create_app(settings), raise_server_exceptions=False) as client:
        owner, _ = account(client, "instructor")
        monkeypatch.setattr(class_service, "generate_code", lambda: "060001")
        response = client.post(
            "/api/v1/classes",
            headers={**owner, "Idempotency-Key": str(uuid4())},
            json={"class_name": "Synthetic enrollment class", "grade_level": 5, "language": "tagalog"},
        )
        assert response.status_code == 201
        classroom = response.json()
        owned_ids.append(UUID(classroom["id"]))
        student, user_id = account(client, "school_student")
        yield client, student, user_id, classroom
    # Preserve audit/history in normal runtime. Cleanup here is only within generated test DB.
    with Session(pg_engine) as db, db.begin():
        db.execute(delete(ClassMembership).where(ClassMembership.class_id.in_(owned_ids)))
        db.execute(delete(ClassJoinCode).where(ClassJoinCode.class_id.in_(owned_ids)))
        db.execute(delete(Classroom).where(Classroom.id.in_(owned_ids)))


def confirmation(client, headers, classroom):
    response = client.post(PREVIEW, headers=headers, json={"code": classroom["join_code"]})
    assert response.status_code == 200
    return {"code": classroom["join_code"], "class_version": response.json()["class_version"]}


def test_live_persistence_restore_ownership_and_code_independent_membership(enrollment_db, pg_engine):
    client, student, user_id, classroom = enrollment_db
    request = confirmation(client, student, classroom)
    with Session(pg_engine) as db:
        assert (
            db.scalar(select(func.count()).select_from(ClassMembership).where(ClassMembership.student_id == user_id))
            == 0
        )
    saved = client.post(JOIN, headers=student, json=request)
    assert saved.status_code == 200
    assert client.post(JOIN, headers=student, json=request).json() == saved.json()
    with Session(pg_engine) as db, db.begin():
        membership = db.get(ClassMembership, UUID(saved.json()["id"]))
        assert membership.student_id == user_id and membership.class_id == UUID(classroom["id"])
        audit = db.scalar(select(AuditLog).where(AuditLog.entity_id == membership.id))
        assert audit.action == "class.enrolled" and "code" not in audit.safe_metadata
        code = db.scalar(select(ClassJoinCode).where(ClassJoinCode.class_id == membership.class_id))
        code.status = "revoked"
        code.revoked_at = datetime.now(timezone.utc)
    # Invitation expiry/revocation never withdraws an existing class membership.
    assert client.get("/api/v1/sessions/me", headers=student).json()["profile_status"] == "active"
    assert len(client.get(JOIN + "/mine", headers=student).json()) == 1
    outsider, _ = account(client, "school_student")
    assert client.get(JOIN + "/mine", headers=outsider).json() == []
    assert client.get("/api/v1/classes/" + classroom["id"], headers=student).status_code == 403


def test_live_concurrent_confirmation_is_one_membership_and_audit(enrollment_db, pg_engine):
    client, student, user_id, classroom = enrollment_db
    request = confirmation(client, student, classroom)
    barrier = Barrier(2)

    def confirm():
        barrier.wait(timeout=10)
        response = client.post(JOIN, headers=student, json=request)
        assert response.status_code == 200
        return response.json()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: confirm(), range(2)))
    assert results[0] == results[1]
    with Session(pg_engine) as db:
        assert (
            db.scalar(select(func.count()).select_from(ClassMembership).where(ClassMembership.student_id == user_id))
            == 1
        )
        assert (
            db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.entity_id == UUID(results[0]["id"])))
            == 1
        )


def test_live_left_history_removed_block_and_class_context_lock(enrollment_db, pg_engine):
    client, student, _, classroom = enrollment_db
    request = confirmation(client, student, classroom)
    first = client.post(JOIN, headers=student, json=request).json()
    with Session(pg_engine) as db, db.begin():
        row = db.get(ClassMembership, UUID(first["id"]))
        row.status = "left"
        row.ended_at = datetime.now(timezone.utc)
    assert client.get("/api/v1/sessions/me", headers=student).json()["profile_status"] == "onboarding"
    assert client.post(JOIN, headers=student, json=request).status_code == 409
    second = client.post(JOIN, headers=student, json=confirmation(client, student, classroom)).json()
    assert second["id"] != first["id"]
    with Session(pg_engine) as db, db.begin():
        row = db.get(ClassMembership, UUID(second["id"]))
        row.status = "removed"
        row.ended_at = datetime.now(timezone.utc)
    assert client.post(PREVIEW, headers=student, json={"code": classroom["join_code"]}).status_code == 404
    assert client.post(JOIN, headers=student, json=request).status_code == 404
    assert client.get(JOIN + "/mine", headers=student).json() == []


def test_live_rollback_includes_membership_audit_and_completion(enrollment_db, pg_engine, monkeypatch):
    client, student, user_id, classroom = enrollment_db
    request = confirmation(client, student, classroom)
    original = EnrollmentRepository.enroll

    def fail_after_writes(self, *args):
        original(self, *args)
        raise RuntimeError("synthetic failure after membership and audit")

    monkeypatch.setattr(EnrollmentRepository, "enroll", fail_after_writes)
    assert client.post(JOIN, headers=student, json=request).status_code == 500
    with Session(pg_engine) as db:
        assert (
            db.scalar(select(func.count()).select_from(ClassMembership).where(ClassMembership.student_id == user_id))
            == 0
        )
        assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.actor_id == user_id)) == 0
        assert db.get(User, user_id).profile_status == "onboarding"


@pytest.mark.parametrize("change", ["expiry", "archived", "owner_disabled", "version"])
def test_live_confirmation_revalidates_after_preview(enrollment_db, pg_engine, change):
    client, student, user_id, classroom = enrollment_db
    request = confirmation(client, student, classroom)
    with Session(pg_engine) as db, db.begin():
        row = db.get(Classroom, UUID(classroom["id"]))
        if change == "expiry":
            code = db.scalar(select(ClassJoinCode).where(ClassJoinCode.class_id == row.id))
            # Past expiry still satisfies the DB's expires_at > created_at constraint.
            code.created_at = datetime.now(timezone.utc) - timedelta(days=2)
            code.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        elif change == "archived":
            row.status = "archived"
        elif change == "owner_disabled":
            db.get(User, row.instructor_id).profile_status = "disabled"
        else:
            row.language = "english"
    response = client.post(JOIN, headers=student, json=request)
    assert response.status_code == (409 if change == "version" else 404)
    with Session(pg_engine) as db:
        assert (
            db.scalar(select(func.count()).select_from(ClassMembership).where(ClassMembership.student_id == user_id))
            == 0
        )
