"""Actual PostgreSQL: uniqueness/savepoints, atomicity, idempotency, migration-preserved metadata.
Skipped without FLUENTT_TEST_DATABASE_URL; doubles are not persistence evidence.
"""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import UUID, uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session
from app.core.config import Settings
from app.main import create_app
from app.models.curriculum import GradeLevel
from app.models.users import Classroom, ClassJoinCode, ClassMembership, User
from app.modules.classrooms import service

pytestmark = pytest.mark.postgresql


@pytest.fixture
def live_classes(pg_engine):
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=pg_engine.url.render_as_string(hide_password=False),
        user_creation_limit=1000,
        class_creation_limit=1000,
        mobile_session_request_limit=1000,
    )
    with TestClient(create_app(settings)) as client:
        yield client
    # Only synthetic owners/classes created by this test module, in the generated disposable DB.
    with Session(pg_engine) as db, db.begin():
        owner_ids = select(User.id).where(User.username.startswith("ClassTest_"))
        class_ids = select(Classroom.id).where(Classroom.instructor_id.in_(owner_ids))
        db.execute(delete(ClassMembership).where(ClassMembership.class_id.in_(class_ids)))
        db.execute(delete(ClassJoinCode).where(ClassJoinCode.class_id.in_(class_ids)))
        db.execute(delete(Classroom).where(Classroom.instructor_id.in_(owner_ids)))


def account(client):
    issued = client.post("/api/v1/users", json={"username": "ClassTest_" + uuid4().hex[:12], "role": "instructor"})
    assert issued.status_code == 201
    return {"Authorization": "Bearer " + issued.json()["session"]["credential"]}, UUID(issued.json()["user"]["id"])


def create(client, headers, key=None, grade=5):
    return client.post(
        "/api/v1/classes",
        headers={**headers, "Idempotency-Key": str(key or uuid4())},
        json={"class_name": "Synthetic class", "grade_level": grade, "language": "english"},
    )


def test_persist_own_class_and_code_and_safe_edit(pg_engine, live_classes, monkeypatch):
    client = live_classes
    first, owner = account(client)
    second, _ = account(client)
    monkeypatch.setattr(service, "generate_code", lambda: "000005")
    created = create(client, first)
    assert created.status_code == 201 and created.json()["join_code"] == "000005"
    class_id = UUID(created.json()["id"])
    with Session(pg_engine) as db:
        row = db.get(Classroom, class_id)
        assert row.instructor_id == owner and row.subject_id is None
        assert db.get(GradeLevel, row.grade_level_id).number == 5
        assert db.scalar(select(ClassJoinCode.code).where(ClassJoinCode.class_id == class_id)) == "000005"
        assert db.get(User, owner).profile_status == "active"
    path = f"/api/v1/classes/{class_id}"
    assert client.get(path, headers=second).status_code == 404
    assert client.patch(path, headers=second, json={"class_name": "Other"}).status_code == 404
    edited = client.patch(
        path, headers=first, json={"class_name": " Renamed ", "grade_level": 12, "language": "tagalog"}
    )
    assert edited.status_code == 200 and edited.json()["join_code"] == "000005" and edited.json()["grade_level"] == 12
    with Session(pg_engine) as db, db.begin():
        student = User(username="Member_" + uuid4().hex[:12], role="school_student")
        db.add(student)
        db.flush()
        db.add(ClassMembership(class_id=class_id, student_id=student.id))
    assert client.patch(path, headers=first, json={"grade_level": 1}).status_code == 409
    assert client.get("/api/v1/sessions/me", headers=first).json()["profile_status"] == "active"


def test_real_collision_savepoint_exhaustion_and_nonreuse(pg_engine, live_classes, monkeypatch):
    client = live_classes
    first, owner = account(client)
    second, other = account(client)
    monkeypatch.setattr(service, "generate_code", lambda: "000006")
    assert create(client, first).status_code == 201
    codes = iter(["000006", "000009"])
    monkeypatch.setattr(service, "generate_code", lambda: next(codes))
    assert create(client, first).json()["join_code"] == "000009"
    with Session(pg_engine) as db, db.begin():
        db.execute(text("UPDATE class_join_codes SET status='expired' WHERE code='000006'"))
    monkeypatch.setattr(service, "generate_code", lambda: "000006")
    assert create(client, second).status_code == 503
    with Session(pg_engine) as db:
        assert db.scalar(select(func.count()).select_from(Classroom).where(Classroom.instructor_id == other)) == 0
        assert db.get(User, other).onboarding_step == "first_class"
        assert db.scalar(select(func.count()).select_from(Classroom).where(Classroom.instructor_id == owner)) == 2


def test_real_concurrent_retry_is_one_class(pg_engine, live_classes):
    client = live_classes
    headers, owner = account(client)
    key = uuid4()
    barrier = Barrier(2)

    def submit():
        barrier.wait(timeout=10)
        response = create(client, headers, key=key, grade=4)
        assert response.status_code == 201
        return response.json()

    with ThreadPoolExecutor(max_workers=2) as pool:
        rows = list(pool.map(lambda _: submit(), range(2)))
    assert rows[0] == rows[1]
    with Session(pg_engine) as db:
        assert db.scalar(select(func.count()).select_from(Classroom).where(Classroom.instructor_id == owner)) == 1


def test_real_unexpected_code_failure_leaves_no_class(pg_engine, live_classes, monkeypatch):
    client = live_classes
    headers, owner = account(client)

    def fail():
        raise RuntimeError("synthetic generator failure")

    monkeypatch.setattr(service, "generate_code", fail)
    # Return HTTP 500 rather than surfacing the exception through the test transport.
    app = client.app
    with TestClient(app, raise_server_exceptions=False) as failing:
        assert create(failing, headers).status_code == 500
    with Session(pg_engine) as db:
        assert db.scalar(select(func.count()).select_from(Classroom).where(Classroom.instructor_id == owner)) == 0
        assert db.get(User, owner).onboarding_step == "first_class"


def test_real_concurrent_code_collision(pg_engine, live_classes, monkeypatch):
    from itertools import count

    client = live_classes
    first, _ = account(client)
    second, _ = account(client)
    barrier = Barrier(2)
    attempts = count()

    def same_first_candidate():
        attempt = next(attempts)
        if attempt < 2:
            return "000010"
        return "000011"

    monkeypatch.setattr(service, "generate_code", same_first_candidate)

    def submit(headers, grade):
        # Start requests concurrently, before transactions acquire curriculum's
        # shared-label guard lock. Waiting inside the generator would deadlock
        # the test barrier against a correctly serialized second transaction.
        barrier.wait(timeout=10)
        return create(client, headers, None, grade)

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(submit, headers, grade) for headers, grade in ((first, 1), (second, 2))]
        results = [future.result(timeout=20) for future in futures]
    assert all(result.status_code == 201 for result in results)
    assert {result.json()["join_code"] for result in results} == {"000010", "000011"}
