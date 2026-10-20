"""Live API/persistence/race checks. Skipped unless disposable PostgreSQL is configured."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import credential_digest
from app.main import create_app
from app.models.users import InstructorProfile, LearnerProfile, User, UserSession
from app.modules.identity.errors import IdentityError
from app.modules.identity.repository import IdentityRepository
from app.modules.identity.schemas import CreateUserRequest
from app.modules.identity.user_service import create_user

pytestmark = pytest.mark.postgresql


def test_personal_language_first_experience_restores_independently(live_identity):
    client = live_identity
    created = client.post("/api/v1/users", json={"username": "Start " + uuid4().hex[:9], "role": "personal_student"}).json()
    auth = {"Authorization": "Bearer " + created["session"]["credential"]}
    url = "/api/v1/users/me/preferences"
    assert client.patch(url, headers=auth, json={"experience": "starting_fresh"}).status_code == 409
    first = client.patch(url, headers=auth, json={"language": "english"}).json()
    assert first["experience"] is None and first["profile_status"] == "onboarding"
    ready = client.patch(url, headers=auth, json={"experience": "comfortable"}).json()
    assert ready["experience"] == "comfortable" and ready["profile_status"] == "active"
    assert ready["grade"] is None and ready["learning_focus"] is None
    assert client.get("/api/v1/sessions/me", headers=auth).json()["experience"] == "comfortable"
    changed = client.patch(url, headers=auth, json={"language": "tagalog"}).json()
    assert changed["experience"] is None and changed["profile_status"] == "onboarding"
    assert client.patch(url, headers=auth, json={"experience": "some_words"}).json()["profile_status"] == "active"
    restored = client.patch(url, headers=auth, json={"language": "english"}).json()
    assert restored["experience"] == "comfortable"
    for experience in (None, "expert", 5):
        assert client.patch(url, headers=auth, json={"experience": experience}).status_code == 422


def test_spaced_username_creation_login_and_case_insensitive_collision(live_identity):
    client = live_identity
    name = "Space " + uuid4().hex[:10]
    body = {"username": name, "role": "personal_student", "password": "SyntheticPass123!"}
    created = client.post("/api/v1/users", json=body)
    assert created.status_code == 201, created.text
    assert created.json()["user"]["canonical_username"] == name.lower()
    duplicate = client.post("/api/v1/users", json=body | {"username": name.upper()})
    assert duplicate.status_code == 409
    assert client.get("/api/v1/usernames/check", params={"username": name.upper()}).json()["available"] is False
    login = client.post("/api/v1/sessions/login", json={"username": name.upper(), "password": body["password"]})
    assert login.status_code == 200, login.text


@pytest.fixture
def live_identity(pg_engine):
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=pg_engine.url.render_as_string(hide_password=False),
        user_creation_limit=1000,
        username_check_limit=1000,
        mobile_session_request_limit=1000,
    )
    with TestClient(create_app(settings)) as client:
        yield client


def unique_name():
    return "Identity_" + uuid4().hex[:12]


@pytest.mark.parametrize("role", ["personal_student", "school_student", "instructor"])
def test_real_creation_restoration_revocation_and_digest_storage(pg_engine, live_identity, role):
    client = live_identity
    name = unique_name()
    response = client.post("/api/v1/users", json={"username": name, "role": role})
    assert response.status_code == 201
    result = response.json()
    raw = result["session"]["credential"]
    headers = {"Authorization": "Bearer " + raw}
    with Session(pg_engine) as db:
        user = db.scalar(select(User).where(User.canonical_username == name.lower()))
        record = db.scalar(select(UserSession).where(UserSession.user_id == user.id))
        assert record.credential_digest == credential_digest(raw) and record.credential_digest != raw
        profile_type = InstructorProfile if role == "instructor" else LearnerProfile
        assert db.scalar(select(profile_type).where(profile_type.user_id == user.id)) is not None
        assert record.expires_at.tzinfo is not None
    restored = client.get("/api/v1/sessions/me", headers=headers)
    assert restored.status_code == 200 and restored.json()["id"] == result["user"]["id"]
    duplicate = client.post("/api/v1/users", json={"username": name.upper(), "role": "instructor"})
    assert duplicate.status_code == 409 and "credential" not in duplicate.text
    assert client.post("/api/v1/sessions/revoke", headers=headers).status_code == 204
    assert client.get("/api/v1/sessions/me", headers=headers).status_code == 401
    with Session(pg_engine) as db:
        assert (
            db.scalar(select(UserSession).where(UserSession.credential_digest == credential_digest(raw))).revoked_at
            is not None
        )


@pytest.mark.parametrize("reason", ["idle_expired", "absolute_expired", "disabled"])
def test_real_session_expiration_and_account_disable(pg_engine, live_identity, reason):
    client = live_identity
    result = client.post("/api/v1/users", json={"username": unique_name(), "role": "school_student"}).json()
    raw = result["session"]["credential"]
    now = datetime.now(timezone.utc)
    with Session(pg_engine) as db, db.begin():
        if reason == "disabled":
            db.execute(text("UPDATE users SET profile_status='disabled' WHERE id=:id"), {"id": result["user"]["id"]})
        else:
            record = db.scalar(select(UserSession).where(UserSession.credential_digest == credential_digest(raw)))
            record.created_at = now - timedelta(days=100)
            record.expires_at = now - timedelta(days=1)
            if reason == "absolute_expired":
                record.absolute_expires_at = now - timedelta(hours=1)
    response = client.get("/api/v1/sessions/me", headers={"Authorization": "Bearer " + raw})
    assert response.status_code == 401


def test_racing_case_variant_registration_is_atomic(pg_engine):
    name = unique_name()
    barrier = Barrier(2)
    settings = Settings(_env_file=None, environment="test")

    class RacingRepository(IdentityRepository):
        def username_exists(self, canonical):
            exists = super().username_exists(canonical)
            barrier.wait(timeout=15)
            return exists

    def attempt(username):
        with Session(pg_engine) as db:
            try:
                create_user(
                    RacingRepository(db), CreateUserRequest(username=username, role="personal_student"), settings
                )
                return 201
            except IdentityError as exc:
                return exc.status

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(attempt, [name, name.upper()]))
    assert sorted(results) == [201, 409]
    with Session(pg_engine) as db:
        user = db.scalar(select(User).where(User.canonical_username == name.lower()))
        assert db.scalar(select(func.count()).select_from(User).where(User.canonical_username == name.lower())) == 1
        assert db.scalar(select(func.count()).select_from(UserSession).where(UserSession.user_id == user.id)) == 1
        assert db.scalar(select(func.count()).select_from(LearnerProfile).where(LearnerProfile.user_id == user.id)) == 1


def test_session_write_failure_rolls_back_user_and_profile(pg_engine):
    name = unique_name()

    class BrokenSessionRepository(IdentityRepository):
        def add_session(self, session):
            raise RuntimeError("Synthetic persistence failure")

    with Session(pg_engine) as db:
        with pytest.raises(RuntimeError):
            create_user(
                BrokenSessionRepository(db),
                CreateUserRequest(username=name, role="instructor"),
                Settings(_env_file=None),
            )
    with Session(pg_engine) as db:
        assert db.scalar(select(User.id).where(User.canonical_username == name.lower())) is None


def test_live_preference_persistence(pg_engine, live_identity):
    client = live_identity
    issued = client.post("/api/v1/users", json={"username": unique_name(), "role": "personal_student"}).json()
    headers = {"Authorization": "Bearer " + issued["session"]["credential"]}
    for grade in (1, 12):
        response = client.patch(
            "/api/v1/users/me/preferences", headers=headers, json={"grade": grade, "language": "english"}
        )
        assert response.status_code == 200
        restored = client.get("/api/v1/sessions/me", headers=headers).json()
        assert (
            restored["grade"] == grade and restored["language"] == "english" and restored["profile_status"] == "active"
        )
        with Session(pg_engine) as db:
            user = db.scalar(select(User).where(User.username == issued["user"]["username"]))
            learner = db.scalar(select(LearnerProfile).where(LearnerProfile.user_id == user.id))
            from app.models.curriculum import GradeLevel

            assert db.get(GradeLevel, learner.preferred_grade_id).number == grade


def test_live_focus_roundtrip_preserves_legacy_grade(pg_engine, live_identity):
    client = live_identity
    issued = client.post("/api/v1/users", json={"username": unique_name(), "role": "personal_student"}).json()
    headers = {"Authorization": "Bearer " + issued["session"]["credential"]}
    focus = {"topics": ["Vocabulary"], "lessons": ["Writing a paragraph"]}
    response = client.patch("/api/v1/users/me/preferences", headers=headers, json={"learning_focus": focus, "language": "english"})
    assert response.status_code == 200 and response.json()["grade"] is None
    assert response.json()["profile_status"] == "active"
    assert client.get("/api/v1/sessions/me", headers=headers).json()["learning_focus"] == focus
    with Session(pg_engine) as db:
        learner = db.scalar(select(LearnerProfile).where(LearnerProfile.user_id == issued["user"]["id"]))
        assert learner.learning_focus == focus and learner.preferred_grade_id is None
    assert client.patch("/api/v1/users/me/preferences", headers=headers, json={"grade": 6}).status_code == 200
    changed = {"topics": ["Reading comprehension"], "lessons": []}
    assert client.patch("/api/v1/users/me/preferences", headers=headers, json={"learning_focus": changed}).status_code == 200
    restored = client.get("/api/v1/sessions/me", headers=headers).json()
    assert restored["grade"] == 6 and restored["learning_focus"] == changed


def test_live_postgresql_password_creation_and_login(pg_engine, live_identity):
    client = live_identity
    name = unique_name()
    password = "LivePostgresPassword123!"

    # 1. Register with password
    create_res = client.post(
        "/api/v1/users",
        json={"username": name, "role": "school_student", "password": password},
    )
    assert create_res.status_code == 201

    # Verify password hash exists in live DB and uses scrypt
    with Session(pg_engine) as db:
        user = db.scalar(select(User).where(User.canonical_username == name.lower()))
        assert user.password_hash is not None
        assert user.password_hash.startswith("scrypt:")

    # 2. Login with correct password
    login_res = client.post(
        "/api/v1/sessions/login",
        json={"username": name, "password": password},
    )
    assert login_res.status_code == 200
    token = login_res.json()["session"]["credential"]
    assert token.startswith("flt_")

    # 3. Access profile with new token
    me_res = client.get("/api/v1/sessions/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["username"] == name

    # 4. Login with wrong password
    bad_login = client.post(
        "/api/v1/sessions/login",
        json={"username": name, "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401

