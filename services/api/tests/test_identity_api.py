from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import credential_digest
from app.main import create_app
from app.modules.identity.dependencies import get_identity_repository
from tests.identity_support import MemoryIdentityRepository


@pytest.fixture
def identity_api():
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=None,
        username_check_limit=1000,
        user_creation_limit=1000,
        mobile_session_request_limit=1000,
    )
    app = create_app(settings)
    repository = MemoryIdentityRepository()
    app.app.dependency_overrides[get_identity_repository] = lambda: repository
    with TestClient(app) as client:
        yield client, repository


def register(client, username="SyntheticLearner", role="personal_student"):
    response = client.post("/api/v1/users", json={"username": username, "role": role})
    assert response.status_code == 201
    return response.json()


def bearer(created):
    return {"Authorization": "Bearer " + created["session"]["credential"]}


@pytest.mark.parametrize("role", ["personal_student", "school_student", "instructor"])
def test_public_creation_profiles_and_secure_issuance(identity_api, role):
    client, repository = identity_api
    created = register(client, role=role)
    user = created["user"]
    assert user["role"] == role and user["canonical_username"] == "syntheticlearner"
    assert user["profile_status"] == "onboarding" and user["onboarding_step"]
    assert repository.profiles[next(iter(repository.users.values())).id] == (
        "instructor" if role == "instructor" else "learner"
    )
    raw = created["session"]["credential"]
    assert credential_digest(raw) in repository.sessions
    assert raw not in repository.sessions
    assert all(raw not in vars(session).values() for session in repository.sessions.values())
    profile = client.get("/api/v1/sessions/me", headers=bearer(created))
    assert profile.status_code == 200 and profile.json()["id"] == user["id"]
    assert raw not in profile.text and "credential_digest" not in profile.text
    assert profile.headers["Cache-Control"] == "no-store"


def test_check_and_duplicate_do_not_claim_profile(identity_api):
    client, repository = identity_api
    check = client.get("/api/v1/usernames/check", params={"username": "shan_mike"})
    assert check.json() == {"username": "shan_mike", "available": True, "message": "Username is available."}
    register(client, "shan_mike")
    duplicate = client.post("/api/v1/users", json={"username": "SHAN_MIKE", "role": "instructor"})
    assert duplicate.status_code == 409 and duplicate.json()["error"]["code"] == "username_taken"
    assert len(repository.users) == len(repository.sessions) == 1
    check = client.get("/api/v1/usernames/check", params={"username": "SHAN_MIKE"})
    assert check.json()["available"] is False
    assert set(check.json()) == {"username", "available", "message"}
    assert "credential" not in duplicate.text


@pytest.mark.parametrize(
    "username",
    [
        "ab",
        "a" * 25,
        " leading",
        "trailing ",
        "with spaces",
        "bad!",
        "éclair",
        "ADMIN",
        "administrator",
        "system",
        "support",
    ],
)
def test_invalid_names_and_reserved_names(identity_api, username):
    client, repository = identity_api
    response = client.post("/api/v1/users", json={"username": username, "role": "school_student"})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["message"]
    assert not repository.users and not repository.sessions
    check = client.get("/api/v1/usernames/check", params={"username": username})
    assert check.status_code == 200 and check.json()["available"] is False


@pytest.mark.parametrize(
    "payload",
    [
        {"username": "learner", "role": "administrator"},
        {"username": "learner", "role": "admin"},
        {"username": "learner", "role": "student"},
        {"username": "learner", "role": "instructor", "profile_status": "active"},
        {"username": "learner", "role": "instructor", "id": "client-selected"},
        {"username": "learner", "role": "instructor", "admin_roles": ["superuser"]},
    ],
)
def test_roles_and_extra_privileged_fields_rejected(identity_api, payload):
    client, repository = identity_api
    assert client.post("/api/v1/users", json=payload).status_code == 422
    assert not repository.users


@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": "Basic anything"}, {"Authorization": "Bearer username"}, {"Authorization": "Bearer "}],
)
def test_missing_malformed_credentials_denied(identity_api, headers):
    client, _ = identity_api
    response = client.get("/api/v1/sessions/me", headers=headers)
    assert response.status_code == 401 and response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "invalidity", ["idle_expired", "absolute_expired", "revoked", "disabled", "archived", "admin", "unknown"]
)
def test_invalid_sessions_and_accounts_denied(identity_api, invalidity):
    client, repository = identity_api
    created = register(client)
    session = repository.sessions[credential_digest(created["session"]["credential"])]
    user = next(iter(repository.users.values()))
    past = datetime.now(timezone.utc) - timedelta(seconds=1)
    if invalidity == "idle_expired":
        session.expires_at = past
    elif invalidity == "absolute_expired":
        session.absolute_expires_at = past
    elif invalidity == "revoked":
        session.revoked_at = past
    elif invalidity == "disabled":
        user.profile_status = "disabled"
    elif invalidity == "archived":
        user.archived_at = past
    elif invalidity == "admin":
        user.role = "administrator"
    else:
        repository.sessions.clear()
    response = client.get("/api/v1/sessions/me", headers=bearer(created))
    assert response.status_code == 401 and response.json()["error"]["code"] == "invalid_session"


def test_revocation_and_bounded_rolling_expiry(identity_api):
    client, repository = identity_api
    created = register(client)
    session = repository.sessions[credential_digest(created["session"]["credential"])]
    session.absolute_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    session.expires_at = datetime.now(timezone.utc) + timedelta(minutes=20)
    response = client.get("/api/v1/sessions/me", headers=bearer(created))
    assert response.status_code == 200 and session.expires_at == session.absolute_expires_at and session.last_used_at
    response = client.post("/api/v1/sessions/revoke", headers=bearer(created))
    assert response.status_code == 204 and response.content == b"" and session.revoked_at
    assert client.get("/api/v1/sessions/me", headers=bearer(created)).status_code == 401
    assert client.post("/api/v1/sessions/revoke", headers=bearer(created)).status_code == 401


def test_raw_credentials_not_logged_or_returned_on_errors(identity_api, caplog):
    client, _ = identity_api
    created = register(client)
    raw = created["session"]["credential"]
    client.get("/api/v1/sessions/me", headers=bearer(created))
    response = client.post("/api/v1/users", json={"username": "another", "role": "personal_student", "credential": raw})
    assert response.status_code == 422 and raw not in response.text and raw not in caplog.text


def test_identity_routes_have_no_password_or_role_mutation(identity_api):
    client, _ = identity_api
    created = register(client)
    assert (
        client.patch(
            "/api/v1/users/" + created["user"]["id"], json={"role": "instructor"}, headers=bearer(created)
        ).status_code
        == 404
    )
    assert client.post("/api/v1/sessions/restore", json={"username": "SyntheticLearner"}).status_code == 404


def test_creation_and_checks_throttled_and_forwarded_header_not_trusted():
    app = create_app(
        Settings(_env_file=None, environment="test", database_url=None, username_check_limit=1, user_creation_limit=1)
    )
    repository = MemoryIdentityRepository()
    app.app.dependency_overrides[get_identity_repository] = lambda: repository
    with TestClient(app) as client:
        assert client.get("/api/v1/usernames/check?username=first").status_code == 200
        limited = client.get("/api/v1/usernames/check?username=second", headers={"X-Forwarded-For": "192.0.2.77"})
        assert limited.status_code == 429 and int(limited.headers["Retry-After"]) > 0
        register(client)
        assert client.post("/api/v1/users", json={"username": "another", "role": "instructor"}).status_code == 429


def test_session_attempts_throttled():
    app = create_app(Settings(_env_file=None, environment="test", database_url=None, mobile_session_request_limit=1))
    with TestClient(app) as client:
        assert client.get("/api/v1/sessions/me").status_code == 401
        assert client.get("/api/v1/sessions/me").status_code == 429


def test_no_database_returns_503_and_public_role_validation_still_runs():
    with TestClient(create_app(Settings(_env_file=None, environment="test", database_url=None))) as client:
        assert client.post("/api/v1/users", json={"username": "learner", "role": "administrator"}).status_code == 422
        assert client.post("/api/v1/users", json={"username": "learner", "role": "personal_student"}).status_code == 503
        assert client.get("/api/v1/sessions/me").status_code == 401


@pytest.mark.parametrize(
    "payload", [None, [], {}, {"username": "missingrole"}, {"username": 123, "role": "personal_student"}]
)
def test_malformed_creation_payload_is_rejected_without_database(payload):
    with TestClient(create_app(Settings(_env_file=None, environment="test", database_url=None))) as client:
        assert client.post("/api/v1/users", json=payload).status_code == 422


def test_current_profile_ignores_client_supplied_user_identity(identity_api):
    client, _ = identity_api
    first = register(client, "FirstSynthetic")
    second = register(client, "SecondSynthetic")
    response = client.get("/api/v1/sessions/me", params={"user_id": second["user"]["id"]}, headers=bearer(first))
    assert response.status_code == 200 and response.json()["id"] == first["user"]["id"]
    assert client.get("/api/v1/sessions/me", params={"username": "FirstSynthetic"}).status_code == 401


def test_openapi_declares_mobile_only_role_and_bearer_security(identity_api):
    client, _ = identity_api
    schema = client.get("/openapi.json").json()
    request_schema = schema["paths"]["/api/v1/users"]["post"]["requestBody"]["content"]["application/json"]["schema"]
    assert request_schema["properties"]["role"]["enum"] == ["personal_student", "school_student", "instructor"]
    assert request_schema["properties"]["username"]["maxLength"] == 24
    assert schema["paths"]["/api/v1/sessions/me"]["get"]["security"] == [{"MobileDeviceSession": []}]


def test_production_identity_requires_https():
    app = create_app(Settings(_env_file=None, environment="production", database_url=None))
    app.app.dependency_overrides[get_identity_repository] = lambda: MemoryIdentityRepository()
    with TestClient(app) as client:
        response = client.post("/api/v1/users", json={"username": "learner", "role": "personal_student"})
        assert response.status_code == 400 and response.json()["error"]["code"] == "https_required"
    with TestClient(app, base_url="https://testserver") as client:
        assert client.post("/api/v1/users", json={"username": "learner", "role": "personal_student"}).status_code == 201


@pytest.mark.parametrize("grade", range(1, 13))
def test_personal_preferences_persist_and_restore(identity_api, grade):
    client, _ = identity_api
    created = register(client)
    headers = bearer(created)
    saved = client.patch("/api/v1/users/me/preferences", headers=headers, json={"grade": grade})
    assert saved.status_code == 200
    assert saved.json()["grade"] == grade and saved.json()["profile_status"] == "onboarding"
    restored = client.get("/api/v1/sessions/me", headers=headers).json()
    assert restored["grade"] == grade and restored["language"] is None
    saved = client.patch("/api/v1/users/me/preferences", headers=headers, json={"language": "tagalog"})
    assert saved.json()["profile_status"] == "active" and saved.json()["onboarding_step"] is None
    restored = client.get("/api/v1/sessions/me", headers=headers).json()
    assert restored["grade"] == grade and restored["language"] == "tagalog"
    assert "credential" not in restored


@pytest.mark.parametrize(
    "body",
    [
        {"grade": 0},
        {"grade": 13},
        {"grade": "5"},
        {"grade": True},
        {"grade": None},
        {"language": "filipino"},
        {"language": None},
        {"role": "instructor"},
        {"user_id": "other"},
    ],
)
def test_reject_invalid_preference_updates(identity_api, body):
    client, _ = identity_api
    created = register(client)
    assert client.patch("/api/v1/users/me/preferences", headers=bearer(created), json=body).status_code == 422
    assert client.get("/api/v1/sessions/me", headers=bearer(created)).json()["grade"] is None


@pytest.mark.parametrize("role", ["school_student", "instructor"])
def test_school_cannot_change_personal_preferences(identity_api, role):
    client, _ = identity_api
    created = register(client, role=role)
    assert client.patch("/api/v1/users/me/preferences", headers=bearer(created), json={"grade": 1}).status_code == 403
    assert client.patch("/api/v1/users/me/preferences", json={"grade": 1}).status_code == 401


def test_preference_update_is_scoped_to_credential(identity_api):
    client, _ = identity_api
    first = register(client, "FirstLearner")
    second = register(client, "SecondLearner")
    client.patch("/api/v1/users/me/preferences", headers=bearer(first), json={"grade": 12, "language": "english"})
    assert client.get("/api/v1/sessions/me", headers=bearer(second)).json()["grade"] is None
    client.post("/api/v1/sessions/revoke", headers=bearer(first))
    assert client.patch("/api/v1/users/me/preferences", headers=bearer(first), json={"grade": 2}).status_code == 401


def test_personal_learning_focus_restores_without_choosing_a_grade(identity_api):
    client, _ = identity_api
    issued = register(client, "FocusLearner")
    headers = bearer(issued)
    focus = {"topics": [" Vocabulary ", "Reading comprehension"], "lessons": ["Writing a paragraph"]}
    saved = client.patch("/api/v1/users/me/preferences", headers=headers, json={"learning_focus": focus})
    assert saved.status_code == 200
    assert saved.json()["learning_focus"]["topics"] == ["Vocabulary", "Reading comprehension"]
    assert saved.json()["grade"] is None
    assert saved.json()["profile_status"] == "onboarding"
    saved = client.patch("/api/v1/users/me/preferences", headers=headers, json={"language": "english"})
    assert saved.json()["profile_status"] == "active"
    restored = client.get("/api/v1/sessions/me", headers=headers).json()
    assert restored["learning_focus"] == saved.json()["learning_focus"]
    assert restored["grade"] is None
    other = register(client, "OtherFocusLearner")
    assert client.get("/api/v1/sessions/me", headers=bearer(other)).json()["learning_focus"] is None
    client.post("/api/v1/sessions/revoke", headers=headers)
    assert client.patch("/api/v1/users/me/preferences", headers=headers, json={"learning_focus": focus}).status_code == 401


@pytest.mark.parametrize("focus", [None, {}, {"topics": [" "]}, {"topics": ["x" * 121]}, {"topics": [str(i) for i in range(11)]}, {"lessons": ["same", "same"]}, {"topics": ["one"], "grade": 5}])
def test_invalid_learning_focus_is_rejected(identity_api, focus):
    client, _ = identity_api
    issued = register(client)
    assert client.patch("/api/v1/users/me/preferences", headers=bearer(issued), json={"learning_focus": focus}).status_code == 422
    assert client.get("/api/v1/sessions/me", headers=bearer(issued)).json()["learning_focus"] is None


@pytest.mark.parametrize("role", ["instructor", "school_student"])
def test_school_profiles_cannot_write_personal_focus(identity_api, role):
    client, _ = identity_api
    issued = register(client, role=role)
    response = client.patch("/api/v1/users/me/preferences", headers=bearer(issued), json={"learning_focus": {"topics": ["Vocabulary"]}})
    assert response.status_code == 403
