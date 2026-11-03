"""Real browser-auth contract tests; all persistence here is an isolated repository double."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest
from starlette.testclient import TestClient
from starlette.responses import Response
from app.core.config import Settings
from app.core.security import issue_credential
from app.main import create_app
from app.models.users import User, UserSession
from app.modules.identity.dependencies import get_identity_repository, get_registration_repository
from tests.identity_support import MemoryIdentityRepository

ORIGIN = "http://localhost:8082"
PASSWORD = "ExamplePassword123!"
HEADERS = {"Origin": ORIGIN, "X-Fluentt-Web": "1"}

@pytest.fixture
def state():
    repo = MemoryIdentityRepository()
    settings = Settings(personal_learner_registration_enabled=True, _env_file=None, environment="test", mobile_web_origins=[ORIGIN], mobile_web_csrf_secret="test-only-csrf-key-with-more-than-32-bytes")
    application = create_app(settings)
    application.app.dependency_overrides[get_identity_repository] = lambda: repo
    application.app.dependency_overrides[get_registration_repository] = lambda: repo
    with TestClient(application, base_url="http://localhost:8001") as client:
        yield client, repo

def register(client, name="browser_learner"):
    response = client.post("/api/v1/browser/users", json={"username":name,"role":"personal_student","password":PASSWORD}, headers=HEADERS)
    assert response.status_code == 201, response.text
    return response

def test_browser_cookie_profile_and_csrf(state):
    client, _ = state
    response = register(client)
    data = response.json()
    assert data["user"]["has_password"] is True
    assert "credential" not in response.text and "flt_" not in response.text
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "path=/" in cookie
    restored = client.get("/api/v1/browser/sessions/me")
    assert restored.status_code == 200
    assert restored.json()["csrf_token"] == data["csrf_token"]
    denied = client.patch("/api/v1/users/me/preferences", json={"language":"english"}, headers=HEADERS)
    assert denied.status_code == 403
    allowed = client.patch("/api/v1/users/me/preferences", json={"language":"english"}, headers={**HEADERS,"X-CSRF-Token":data["csrf_token"]})
    assert allowed.status_code == 200
    assert allowed.json()["language"] == "english"

def test_stale_tab_cannot_read_or_change_another_browser_account(state):
    client, _ = state
    first = register(client, "first_tab")
    first_csrf = first.json()["csrf_token"]
    first_headers = {**HEADERS, "X-CSRF-Token": first_csrf}
    assert client.get("/api/v1/sessions/me", headers=first_headers).status_code == 200
    second = register(client, "second_tab")
    second_csrf = second.json()["csrf_token"]
    # The second tab replaces the shared cookie. The first tab must fail closed.
    stale_read = client.get("/api/v1/sessions/me", headers=first_headers)
    assert stale_read.status_code == 401
    assert "set-cookie" not in stale_read.headers
    assert client.patch("/api/v1/users/me/preferences", json={"language":"english"}, headers=first_headers).status_code == 401
    active = client.get("/api/v1/sessions/me", headers={**HEADERS, "X-CSRF-Token": second_csrf})
    assert active.status_code == 200 and active.json()["username"] == "second_tab"


def test_browser_session_restore_rejects_a_different_allowed_cors_origin(state):
    client, _ = state
    register(client)
    response = client.get("/api/v1/browser/sessions/me", headers={"Origin":"http://localhost:3000","X-Fluentt-Web":"1"})
    assert response.status_code == 403
    assert "csrf_token" not in response.text


def test_browser_requires_exact_origin_and_custom_header(state):
    client, repo = state
    for headers in [{"Origin":"http://localhost:8082.evil.test","X-Fluentt-Web":"1"},{"Origin":ORIGIN},{"X-Fluentt-Web":"1"}]:
        result = client.post("/api/v1/browser/users",json={"username":"rejected_user","role":"personal_student","password":PASSWORD},headers=headers)
        assert result.status_code == 403
    assert not repo.users

def test_browser_login_logout_wrong_password_and_csrf(state):
    client, _ = state
    register(client)
    wrong = client.post("/api/v1/browser/sessions/login",json={"username":"browser_learner","password":"incorrect"},headers=HEADERS)
    assert wrong.status_code == 401
    assert wrong.json()["error"]["code"] == "invalid_credentials"
    signed = client.post("/api/v1/browser/sessions/login",json={"username":"BROWSER_LEARNER","password":PASSWORD},headers=HEADERS)
    assert signed.status_code == 200
    csrf = signed.json()["csrf_token"]
    assert client.post("/api/v1/browser/sessions/revoke",headers=HEADERS).status_code == 403
    result = client.post("/api/v1/browser/sessions/revoke",headers={**HEADERS,"X-CSRF-Token":csrf})
    assert result.status_code == 204
    assert client.get("/api/v1/browser/sessions/me").status_code == 401

def test_browser_expired_session_is_cleared(state):
    client, repo = state
    register(client)
    next(iter(repo.sessions.values())).expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    result = client.get("/api/v1/browser/sessions/me")
    assert result.status_code == 401
    assert "max-age=0" in result.headers.get("set-cookie","").lower()

def test_registration_requires_password(state):
    client, _ = state
    result = client.post("/api/v1/users",json={"username":"no_password","role":"personal_student"})
    assert result.status_code == 422

def test_legacy_exchange_rotates_session_without_exposing_credential(state):
    client, _ = state
    native = client.post("/api/v1/users",json={"username":"native_user","role":"instructor","password":PASSWORD})
    assert native.status_code == 201
    credential = native.json()["session"]["credential"]
    exchanged = client.post("/api/v1/browser/sessions/exchange",headers={**HEADERS,"Authorization":"Bearer "+credential})
    assert exchanged.status_code == 200
    assert "flt_" not in exchanged.text and "credential" not in exchanged.text
    assert client.get("/api/v1/sessions/me",headers={"Authorization":"Bearer "+credential}).status_code == 401
    assert client.get("/api/v1/browser/sessions/me").status_code == 200

def test_valid_legacy_account_is_not_discarded_when_a_different_cookie_exists(state):
    client, _ = state
    old = client.post("/api/v1/users", json={"username":"legacy_owner","role":"personal_student","password":PASSWORD})
    raw = old.json()["session"]["credential"]
    register(client, "other_account")
    result = client.post("/api/v1/browser/sessions/exchange", headers={**HEADERS,"Authorization":"Bearer "+raw})
    assert result.status_code == 200 and result.json()["user"]["username"] == "legacy_owner"
    assert client.get("/api/v1/sessions/me", headers={"Authorization":"Bearer "+raw}).status_code == 401
    assert client.get("/api/v1/browser/sessions/me").json()["user"]["username"] == "legacy_owner"


def test_legacy_exchange_recovers_when_an_expired_cookie_is_present(state):
    client, repo = state
    old = client.post("/api/v1/users", json={"username":"saved_legacy","role":"instructor","password":PASSWORD})
    raw = old.json()["session"]["credential"]
    register(client, "expired_cookie")
    # The stale browser cookie must not cause us to discard a still-valid legacy session.
    from app.core.security import credential_digest
    expired_raw = client.cookies.get("fluentt_browser_session")
    repo.sessions[credential_digest(expired_raw)].expires_at = datetime.now(timezone.utc)-timedelta(seconds=1)
    result = client.post("/api/v1/browser/sessions/exchange", headers={**HEADERS,"Authorization":"Bearer "+raw})
    assert result.status_code == 200 and result.json()["user"]["username"] == "saved_legacy"
    assert client.get("/api/v1/browser/sessions/me").status_code == 200
    assert client.get("/api/v1/sessions/me", headers={"Authorization":"Bearer "+raw}).status_code == 401


def test_invalid_legacy_entry_falls_back_to_existing_browser_cookie(state):
    client, _ = state
    registered = register(client)
    expired = issue_credential().raw
    result = client.post("/api/v1/browser/sessions/exchange", headers={**HEADERS,"Authorization":"Bearer "+expired})
    assert result.status_code == 200 and result.json()["user"]["id"] == registered.json()["user"]["id"]
    assert client.get("/api/v1/browser/sessions/me").status_code == 200


def test_authenticated_legacy_password_setup_is_idempotent(state):
    client, repo = state
    now = datetime.now(timezone.utc)
    user = User(id=uuid4(),username="legacy_user",password_hash=None,role="personal_student",profile_status="onboarding",onboarding_step="personal_preferences",created_at=now,updated_at=now)
    issued = issue_credential()
    with repo.transaction():
        repo.add_user(user); repo.add_profile(user)
        repo.add_session(UserSession(id=uuid4(),user_id=user.id,credential_digest=issued.digest,created_at=now,updated_at=now,expires_at=now+timedelta(days=30),absolute_expires_at=now+timedelta(days=90)))
    assert client.post("/api/v1/users/me/password",json={"password":PASSWORD}).status_code == 401
    headers = {"Authorization":"Bearer "+issued.raw}
    result = client.post("/api/v1/users/me/password",json={"password":PASSWORD},headers=headers)
    assert result.status_code == 200 and result.json()["has_password"] is True
    assert client.post("/api/v1/users/me/password",json={"password":PASSWORD},headers=headers).status_code == 200
    assert client.post("/api/v1/users/me/password",json={"password":"DifferentPassword123!"},headers=headers).status_code == 409

def test_browser_cookie_is_secure_in_production():
    from app.modules.identity.browser_security import set_browser_cookie
    settings = Settings(personal_learner_registration_enabled=True, _env_file=None,environment="production",mobile_web_origins=["https://app.example.test"],mobile_web_csrf_secret="test-only-secret-with-more-than-32-bytes")
    response = Response()
    set_browser_cookie(response, issue_credential().raw, datetime.now(timezone.utc)+timedelta(days=90), settings)
    cookie = response.headers["set-cookie"].lower()
    assert "__host-" in cookie and "secure" in cookie and "httponly" in cookie
