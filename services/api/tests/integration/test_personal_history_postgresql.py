"""Real HTTP/session/database checks with synthetic identities in UUID disposable DBs."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.models.personal_history import PersonalActivityEvent
from app.models.learning import LearnerProgress, LearningContext, VocabularyReviewEvent
from app.models.users import User
from tests.integration.test_enrollment_postgresql import account
from tests.integration.conftest import ROOT
from tests.test_personal_history import payload

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/me/personal-history"


@pytest.fixture
def history_app(pg_engine):
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=pg_engine.url.render_as_string(hide_password=False),
        user_creation_limit=1000,
        mobile_session_request_limit=1000,
    )
    with TestClient(create_app(settings)) as client:
        auth, user = account(client, "personal_student")
        res = client.patch(
            "/api/v1/users/me/preferences", headers=auth, json={"language": "english", "experience": "starting_fresh"}
        )
        assert res.status_code == 200
        yield client, auth, user


def test_persistent_owner_history_idempotency_filters_and_no_scheduler_writes(history_app, pg_engine):
    client, auth, user = history_app
    assert client.get(BASE).status_code == 401
    assert client.get(BASE, headers=auth).json()["items"] == []
    with Session(pg_engine) as db:
        tables = [LearnerProgress, LearningContext, VocabularyReviewEvent]
        before = [db.scalar(select(func.count()).select_from(table)) for table in tables]
    bodies = [
        payload(kind=kind, prompt=None if kind.startswith("tutor") else "Synthetic public phrase")
        for kind in ["learn_question", "learn_lesson", "voice_phrase", "tutor_reply", "tutor_session"]
    ]
    for body in bodies:
        saved = client.post(BASE, headers=auth, json=body)
        assert saved.status_code == 200, saved.text
        repeated = client.post(BASE, headers=auth, json=body)
        assert repeated.json() == saved.json()
        assert "no-store" in saved.headers["cache-control"]
    conflict = client.post(BASE, headers=auth, json={**bodies[0], "title": "Changed request"})
    assert conflict.status_code == 409
    listing = client.get(BASE, headers=auth)
    assert len(listing.json()["items"]) == 5 and "user_id" not in listing.text
    for area, count in [("learn", 2), ("voice", 1), ("tutor", 2)]:
        response = client.get(BASE, headers=auth, params={"area": area})
        assert len(response.json()["items"]) == count and "no-store" in response.headers["cache-control"]
    first = client.get(BASE, headers=auth, params={"limit": 2}).json()
    second = client.get(BASE, headers=auth, params={"limit": 2, "offset": 2}).json()
    assert first["has_more"] and not ({row["id"] for row in first["items"]} & {row["id"] for row in second["items"]})
    assert client.get(BASE, headers=auth, params={"area": "research"}).status_code == 422
    assert client.get(BASE, headers=auth, params={"limit": 51}).status_code == 422
    with Session(pg_engine) as db:
        assert before == [db.scalar(select(func.count()).select_from(table)) for table in tables]
        assert (
            db.scalar(
                select(func.count()).select_from(PersonalActivityEvent).where(PersonalActivityEvent.user_id == user)
            )
            == 5
        )
    # A new HTTP client/session application instance reads durable records, not client memory.
    with TestClient(create_app(client.app.app.state.settings)) as fresh:
        assert len(fresh.get(BASE, headers=auth).json()["items"]) == 5


def test_cross_owner_and_classroom_denial_private_text_and_role_guards(history_app, pg_engine):
    client, auth, user = history_app
    first = client.post(BASE, headers=auth, json=payload()).json()
    other, _ = account(client, "personal_student")
    assert (
        client.patch(
            "/api/v1/users/me/preferences", headers=other, json={"language": "english", "experience": "starting_fresh"}
        ).status_code
        == 200
    )
    assert client.get(BASE, headers=other).json()["items"] == []
    for role in ("school_student", "instructor"):
        denied, _ = account(client, role)
        assert client.get(BASE, headers=denied).status_code == 403
        assert client.post(BASE, headers=denied, json=payload()).status_code == 403
    for extra in [{"user_id": str(user)}, {"class_id": str(uuid4())}, {"score": 100}, {"audio": "forbidden"}]:
        assert client.post(BASE, headers=auth, json=payload(**extra)).status_code == 422
    assert (
        client.post(BASE, headers=auth, json=payload(kind="tutor_reply", prompt="Synthetic private chat")).status_code
        == 422
    )
    with Session(pg_engine) as db, pytest.raises(DBAPIError), db.begin():
        db.execute(text("UPDATE personal_activity_events SET title='changed' WHERE id=:id"), {"id": UUID(first["id"])})
    with Session(pg_engine) as db, pytest.raises(DBAPIError), db.begin():
        db.execute(text("DELETE FROM personal_activity_events WHERE id=:id"), {"id": UUID(first["id"])})


def test_empty_migration_roundtrip_and_retained_history_downgrade_refusal():
    from tests.integration.conftest import pg_engine as disposable

    generator = disposable.__wrapped__()
    engine = next(generator)
    try:
        with engine.begin() as connection:
            config = Config(str(ROOT / "alembic.ini"))
            config.attributes["connection"] = connection
            command.downgrade(config, "0017_research_classrooms")
            command.upgrade(config, "0018_personal_history")
        with Session(engine) as db, db.begin():
            user = User(username="History_" + uuid4().hex[:10], role="personal_student", profile_status="active")
            db.add(user)
            db.flush()
            db.add(
                PersonalActivityEvent(
                    user_id=user.id,
                    event_key=uuid4(),
                    kind="learn_question",
                    source_id="synthetic",
                    title="Synthetic QA only",
                    language="english",
                    fingerprint="0" * 64,
                    recorded_at=datetime.now(timezone.utc),
                )
            )
        with engine.begin() as connection:
            config = Config(str(ROOT / "alembic.ini"))
            config.attributes["connection"] = connection
            with pytest.raises(DBAPIError), connection.begin_nested():
                command.downgrade(config, "0017_research_classrooms")
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "0018_personal_history"
    finally:
        try:
            next(generator)
        except StopIteration:
            pass
