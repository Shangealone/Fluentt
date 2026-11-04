"""School signup policy using isolated in-memory accounts, never the local database."""
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.modules.identity.dependencies import get_identity_repository, get_registration_repository
from app.modules.identity.errors import IdentityError
from app.modules.identity.schemas import RegistrationRequest
from app.modules.identity.user_service import create_user
from tests.identity_support import MemoryIdentityRepository

ORIGIN = "http://localhost:8082"
PASSWORD = "SyntheticPassword123!"


def application(enabled=False):
    settings = Settings(
        _env_file=None, environment="test", database_url=None,
        personal_learner_registration_enabled=enabled,
        mobile_web_origins=[ORIGIN],
        mobile_web_csrf_secret="test-only-secret-longer-than-32-bytes",
    )
    repository = MemoryIdentityRepository()
    app = create_app(settings)
    app.app.dependency_overrides[get_identity_repository] = lambda: repository
    app.app.dependency_overrides[get_registration_repository] = lambda: repository
    return app, repository


@pytest.mark.parametrize("enabled", [False, True])
def test_options_follow_server_flag_and_are_not_cached(enabled):
    app, _ = application(enabled)
    with TestClient(app) as client:
        response = client.get("/api/v1/registration/options")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    expected = ["school_student", "instructor"]
    assert response.json()["roles"] == (["personal_student"] + expected if enabled else expected)


@pytest.mark.parametrize("path", ["/api/v1/users", "/api/v1/browser/users"])
@pytest.mark.parametrize("enabled", [False, True])
def test_both_registration_transports_enforce_policy(path, enabled):
    app, repository = application(enabled)
    with TestClient(app, base_url="http://localhost:8001") as client:
        response = client.post(path, json={
            "username": "policy_learner", "password": PASSWORD, "role": "personal_student",
        }, headers={"Origin": ORIGIN, "X-Fluentt-Web": "1"})
    assert response.status_code == (201 if enabled else 403), response.text
    if enabled:
        assert len(repository.users) == len(repository.profiles) == len(repository.sessions) == 1
    else:
        assert not repository.users and not repository.profiles and not repository.sessions


def test_default_is_disabled_and_guard_precedes_repository_access():
    settings = Settings(_env_file=None)
    assert not settings.personal_learner_registration_enabled
    with pytest.raises(IdentityError) as error:
        create_user(object(), RegistrationRequest(username="blocked_learner", role="personal_student", password=PASSWORD), settings)
    assert error.value.code == "personal_registration_disabled"


def test_existing_personal_account_can_login_and_restore_when_signup_disabled():
    app, repository = application()
    created = create_user(repository, RegistrationRequest(username="existing_learner", role="personal_student", password=PASSWORD),
                          Settings(_env_file=None, personal_learner_registration_enabled=True))
    with TestClient(app) as client:
        restored = client.get("/api/v1/sessions/me", headers={"Authorization": "Bearer " + created.session.credential})
        signed_in = client.post("/api/v1/sessions/login", json={"username": "existing_learner", "password": PASSWORD})
        browser_login = client.post("/api/v1/browser/sessions/login", json={"username": "existing_learner", "password": PASSWORD}, headers={"Origin": ORIGIN, "X-Fluentt-Web": "1"})
        browser_restored = client.get("/api/v1/browser/sessions/me")
    assert browser_login.status_code == browser_restored.status_code == 200
    assert restored.status_code == signed_in.status_code == 200
    assert signed_in.json()["user"]["role"] == "personal_student"


def test_teacher_registration_still_available_by_default():
    app, repository = application()
    with TestClient(app) as client:
        response = client.post("/api/v1/users", json={"username": "policy_teacher", "password": PASSWORD, "role": "instructor"})
    assert response.status_code == 201, response.text
    assert len(repository.users) == 1


@pytest.mark.parametrize("path", ["/api/v1/users", "/api/v1/browser/users"])
def test_school_signup_requires_verified_class_before_any_account_is_created(path):
    app, repository = application()
    with TestClient(app, base_url="http://localhost:8001") as client:
        response = client.post(path, json={"username": "unverified_student", "password": PASSWORD,
                                          "role": "school_student"},
                               headers={"Origin": ORIGIN, "X-Fluentt-Web": "1"})
    assert response.status_code == 422
    assert not repository.users and not repository.profiles and not repository.sessions
