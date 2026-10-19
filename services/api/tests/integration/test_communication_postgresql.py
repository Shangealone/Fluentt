"""Synthetic ordinary-class communication over real HTTP/PostgreSQL."""

from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func, update, delete
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.main import create_app
from app.core.config import Settings
from app.models.operations import Message, MessageRead, AuditLog
from app.models.users import User, UserSession, ClassMembership, Classroom
from tests.integration.conftest import pg_engine as disposable_engine_fixture
from tests.integration.test_enrollment_postgresql import account, confirmation

pytestmark = pytest.mark.postgresql


@pytest.fixture(scope="module")
def communication_engine():
    yield from disposable_engine_fixture.__wrapped__()


@pytest.fixture
def comm_case(communication_engine):
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=communication_engine.url.render_as_string(hide_password=False),
        user_creation_limit=1000,
        mobile_session_request_limit=1000,
        enrollment_peer_limit=1000,
        enrollment_session_limit=1000,
    )
    with TestClient(create_app(settings)) as client:
        owner, owner_id = account(client, "instructor")
        response = client.post(
            "/api/v1/classes",
            headers=owner | {"Idempotency-Key": str(uuid4())},
            json={"class_name": "Synthetic communication class", "grade_level": 5, "language": "tagalog"},
        )
        assert response.status_code == 201, response.text
        classroom = response.json()
        student, student_id = account(client, "school_student")
        enrolled = client.post(
            "/api/v1/class-memberships", headers=student, json=confirmation(client, student, classroom)
        )
        assert enrolled.status_code == 200, enrolled.text
        yield client, owner, student, student_id, classroom, communication_engine


def base(case):
    return f"/api/v1/classes/{case[4]['id']}"


def send(case, content="Synthetic hello ñ😀", *, auth=None, student=None, key=None):
    return case[0].post(
        base(case) + (f"/messages/{student}" if student else "/announcements"),
        headers=(auth or case[1]) | {"Idempotency-Key": str(key or uuid4())},
        json={"content": content},
    )


def read(case, path="/announcements", auth=None, **params):
    response = case[0].get(base(case) + path, headers=auth or case[2], params=params)
    assert response.status_code == 200, response.text
    assert "no-store" in response.headers["cache-control"]
    return response.json()


def test_announcement_direct_reply_and_own_read_state(comm_case):
    case = comm_case
    assert read(case)["items"] == []
    announcement = send(case)
    assert announcement.status_code == 201, announcement.text
    item = announcement.json()
    assert item["read"] is True
    assert read(case)["items"][0]["read"] is False
    detail = base(case) + f"/communication/messages/{item['id']}"
    assert case[0].get(detail, headers=case[2]).json()["read"] is False
    for _ in range(2):
        result = case[0].post(detail + "/read", headers=case[2], json={})
        assert result.status_code == 200, result.text
        assert result.json()["read"] is True
    assert read(case)["items"][0]["read"] is True
    direct = send(case, student=case[3])
    assert direct.status_code == 201, direct.text
    reply = send(case, "Synthetic student reply", student=case[3], auth=case[2])
    assert reply.status_code == 201, reply.text
    rows = read(case, f"/messages/{case[3]}")["items"]
    assert [row["id"] for row in rows] == [reply.json()["id"], direct.json()["id"]]
    assert rows[0]["read"] is True and rows[1]["read"] is False
    assert read(case, f"/messages/{case[3]}", auth=case[1])["items"][0]["read"] is False
    with Session(case[5]) as db:
        assert (
            db.scalar(select(func.count()).select_from(MessageRead).where(MessageRead.message_id == UUID(item["id"])))
            == 1
        )
        audit = db.scalar(
            select(AuditLog).where(AuditLog.entity_id == UUID(item["id"]), AuditLog.action == "communication.send")
        )
        assert "Synthetic" not in str(audit.safe_metadata) and "content" not in audit.safe_metadata


def test_idempotence_mismatch_and_input(comm_case):
    case = comm_case
    key = uuid4()
    text = " \nKumusta ñ😀 <script>literal</script>  "
    first = send(case, text, key=key)
    assert first.status_code == 201, first.text
    assert first.json()["content"] == text
    assert send(case, text, key=key).json() == first.json()
    assert send(case, "different", key=key).status_code == 409
    assert send(case, text, key=key, student=case[3]).status_code == 409
    for invalid in ("", " \t\n", "a" * 4001, "\x00"):
        assert send(case, invalid).status_code == 422
    assert send(case, "😀" * 4000).status_code == 201
    assert case[0].post(base(case) + "/announcements", headers=case[1], json={"content": "x"}).status_code == 422
    assert (
        case[0]
        .post(
            base(case) + "/announcements",
            headers=case[1] | {"Idempotency-Key": str(uuid4())},
            json={"content": "x", "sender_id": str(case[3])},
        )
        .status_code
        == 422
    )


def test_role_recipient_class_and_history_isolation(comm_case):
    case = comm_case
    other, other_id = account(case[0], "school_student")
    outsider, _ = account(case[0], "instructor")
    personal, _ = account(case[0], "personal_student")
    assert send(case, auth=case[2]).status_code == 403
    assert send(case, student=other_id).status_code == 404
    assert send(case, student=case[3], auth=other).status_code == 404
    for auth, code in ((other, 404), (outsider, 404), (personal, 403)):
        assert case[0].get(base(case) + "/announcements", headers=auth).status_code == code
    assert case[0].get(base(case) + "/communication/participants", headers=case[2]).status_code == 403
    own = send(case, student=case[3]).json()
    assert case[0].get(base(case) + f"/communication/messages/{own['id']}", headers=other).status_code == 404
    assert case[0].get(base(case) + "/announcements").status_code == 401
    assert case[0].get(f"/api/v1/classes/{uuid4()}/announcements", headers=case[1]).status_code == 404
    assert read(case, "/communication/participants", auth=case[1])["items"][0]["id"] == str(case[3])
    assert read(case, "/communication/participants", auth=case[1], q="%_")["items"] == []
    for auth in (case[1], case[2]):
        classes = case[0].get("/api/v1/communication/classes", headers=auth)
        assert classes.status_code == 200 and "no-store" in classes.headers["cache-control"]
        assert str(case[4]["id"]) in [row["id"] for row in classes.json()["items"]]


def test_enrollment_changes_restore_history_and_later_announcement_access(comm_case):
    case = comm_case
    announcement = send(case).json()
    direct = send(case, student=case[3]).json()
    with Session(case[5]) as db, db.begin():
        row = db.scalar(
            select(ClassMembership).where(
                ClassMembership.class_id == UUID(case[4]["id"]),
                ClassMembership.student_id == case[3],
                ClassMembership.status == "active",
            )
        )
        row.status = "left"
        row.ended_at = datetime.now(timezone.utc)
    assert case[0].get(base(case) + "/announcements", headers=case[2]).status_code == 404
    assert send(case, student=case[3]).status_code == 404
    with Session(case[5]) as db, db.begin():
        db.add(
            ClassMembership(
                class_id=UUID(case[4]["id"]), student_id=case[3], status="active", joined_at=datetime.now(timezone.utc)
            )
        )
    assert read(case)["items"][0]["id"] == announcement["id"]
    assert read(case, f"/messages/{case[3]}")["items"][0]["id"] == direct["id"]
    later, later_id = account(case[0], "school_student")
    assert (
        case[0].post("/api/v1/class-memberships", headers=later, json=confirmation(case[0], later, case[4])).status_code
        == 200
    )
    assert read(case, auth=later)["items"][0]["id"] == announcement["id"]
    assert case[0].get(base(case) + f"/communication/messages/{direct['id']}", headers=later).status_code == 404
    with Session(case[5]) as db, db.begin():
        db.get(User, case[3]).profile_status = "disabled"
    assert send(case, student=case[3]).status_code == 404
    assert case[0].get(base(case) + "/announcements", headers=case[2]).status_code == 401


def test_frozen_history_pagination_and_database_guards(comm_case):
    case = comm_case
    for index in range(23):
        assert send(case, f"Synthetic page {index}").status_code == 201
    first = read(case)
    anchor = first["as_of"]
    assert send(case, "Synthetic newer publication").status_code == 201
    second = read(case, offset=20, before=anchor)
    assert len(first["items"]) == 20 and first["has_more"] and len(second["items"]) == 3
    assert len({row["id"] for row in first["items"] + second["items"]}) == 23
    assert read(case)["items"][0]["content"] == "Synthetic newer publication"
    message_id = UUID(first["items"][0]["id"])
    for statement in (
        update(Message).where(Message.id == message_id).values(content="tamper"),
        delete(Message).where(Message.id == message_id),
    ):
        with Session(case[5]) as db, db.begin(), pytest.raises(IntegrityError), db.begin_nested():
            db.execute(statement)
    with Session(case[5]) as db, db.begin(), pytest.raises(IntegrityError), db.begin_nested():
        db.add(
            Message(
                sender_id=case[3],
                recipient_id=None,
                class_id=UUID(case[4]["id"]),
                context_class_id=UUID(case[4]["id"]),
                communication_contract="class-text-v1",
                send_request_id=uuid4(),
                message_type="announcement",
                content="invalid",
                sent_at=datetime.now(timezone.utc),
            )
        )
        db.flush()


def test_busy_recipient_concurrent_retry_and_revoked_session(comm_case):
    case = comm_case
    with Session(case[5]) as db, db.begin():
        db.scalar(select(User).where(User.id == case[3]).with_for_update())
        assert send(case, student=case[3]).status_code == 409
    key = uuid4()
    gate = Barrier(2)

    def writer(_):
        with TestClient(create_app(case[0].app.app.state.settings)) as client:
            gate.wait(timeout=10)
            return client.post(
                base(case) + f"/messages/{case[3]}",
                headers=case[1] | {"Idempotency-Key": str(key)},
                json={"content": "Synthetic concurrent send"},
            )

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(writer, range(2)))
    assert [row.status_code for row in results] == [201, 201], [row.text for row in results]
    assert results[0].json()["id"] == results[1].json()["id"]
    with Session(case[5]) as db, db.begin():
        owner_id = db.get(Classroom, UUID(case[4]["id"])).instructor_id
        for session in db.scalars(select(UserSession).where(UserSession.user_id == owner_id)):
            session.revoked_at = datetime.now(timezone.utc)
    assert send(case).status_code == 401


def test_read_record_immutability_expiry_and_inactive_class(comm_case):
    case = comm_case
    item = send(case).json()
    detail = base(case) + f"/communication/messages/{item['id']}"
    assert case[0].post(detail + "/read", headers=case[2], json={}).status_code == 200
    with Session(case[5]) as db:
        receipt = db.scalar(select(MessageRead).where(MessageRead.message_id == UUID(item["id"])))
        receipt_id = receipt.id
    for statement in (
        update(MessageRead).where(MessageRead.id == receipt_id).values(read_at=datetime.now(timezone.utc)),
        delete(MessageRead).where(MessageRead.id == receipt_id),
    ):
        with Session(case[5]) as db, db.begin(), pytest.raises(IntegrityError), db.begin_nested():
            db.execute(statement)
    with Session(case[5]) as db, db.begin():
        for session in db.scalars(select(UserSession).where(UserSession.user_id == case[3])):
            session.created_at = datetime.now(timezone.utc) - timedelta(days=3)
            session.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    assert case[0].get(detail, headers=case[2]).status_code == 401
    with Session(case[5]) as db, db.begin():
        db.get(Classroom, UUID(case[4]["id"])).status = "archived"
    assert case[0].get(base(case) + "/announcements", headers=case[1]).status_code == 404
    assert send(case).status_code == 404


def test_existing_message_destinations_survive_additive_migration_and_safe_roundtrip():
    from alembic import command
    from alembic.config import Config
    from pathlib import Path
    from sqlalchemy import text

    generator = disposable_engine_fixture.__wrapped__()
    engine = next(generator)
    try:
        config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
        legacy, first, second = uuid4(), uuid4(), uuid4()
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.downgrade(config, "0011_result_release")
            for id, name, role in (
                (first, "LegacyFixtureTeacher", "instructor"),
                (second, "LegacyFixtureStudent", "school_student"),
            ):
                connection.execute(
                    text("INSERT INTO users(id,username,role) VALUES(:id,:name,:role)"),
                    dict(id=id, name=name, role=role),
                )
            connection.execute(
                text(
                    "INSERT INTO messages(id,sender_id,recipient_id,message_type,content,sent_at) VALUES(:id,:sender,:recipient,'direct','LEGACY SYNTHETIC ONLY',now())"
                ),
                dict(id=legacy, sender=first, recipient=second),
            )
            before = connection.execute(
                text(
                    "SELECT id,sender_id,recipient_id,class_id,message_type,content,sent_at,created_at,updated_at FROM messages WHERE id=:id"
                ),
                dict(id=legacy),
            ).one()
            command.upgrade(config, "head")
            after = connection.execute(
                text(
                    "SELECT id,sender_id,recipient_id,class_id,message_type,content,sent_at,created_at,updated_at FROM messages WHERE id=:id"
                ),
                dict(id=legacy),
            ).one()
            assert before == after
            assert connection.execute(
                text("SELECT communication_contract,context_class_id,send_request_id FROM messages WHERE id=:id"),
                dict(id=legacy),
            ).one() == (None, None, None)
            command.check(config)
            # Empty new contract permits safe rollback; legacy text/destination stays intact.
            command.downgrade(config, "0011_result_release")
            assert (
                connection.scalar(text("SELECT content FROM messages WHERE id=:id"), dict(id=legacy))
                == "LEGACY SYNTHETIC ONLY"
            )
            command.upgrade(config, "head")
    finally:
        try:
            next(generator)
        except StopIteration:
            pass


def test_student_can_initiate_and_context_authorizes_named_recipient(comm_case):
    case = comm_case
    opened = send(case, "Synthetic student-initiated question", auth=case[2], student=case[3])
    assert opened.status_code == 201, opened.text
    context = read(case, "/communication", auth=case[1], student_id=str(case[3]))
    assert context["peer"]["id"] == str(case[3]) and context["peer"]["username"]
    assert (
        case[0].get(base(case) + "/communication", headers=case[1], params={"student_id": str(uuid4())}).status_code
        == 404
    )
    assert read(case, f"/messages/{case[3]}", auth=case[1])["items"][0]["id"] == opened.json()["id"]
