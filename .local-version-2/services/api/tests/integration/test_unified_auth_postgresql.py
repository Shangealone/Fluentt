"""Cookie and native contracts against disposable, migrated PostgreSQL."""
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from app.core.config import Settings
from app.core.security import credential_digest
from app.main import create_app
from app.models.users import User, UserSession
from app.modules.identity.repository import IdentityRepository
from app.modules.identity.schemas import CreateUserRequest
from app.modules.identity.user_service import create_user

pytestmark = pytest.mark.postgresql
PASSWORD = "SyntheticPassword123!"
ORIGIN = "http://localhost:8082"
HEADERS = {"Origin": ORIGIN, "X-Fluentt-Web": "1"}

@pytest.fixture
def browser_api(pg_engine):
    settings = Settings(_env_file=None, environment="test",
        database_url=pg_engine.url.render_as_string(hide_password=False),
        mobile_web_origins=[ORIGIN], mobile_web_csrf_secret="test-only-cookie-secret-with-more-than-32-bytes",
        user_creation_limit=1000, mobile_session_request_limit=1000)
    with TestClient(create_app(settings), base_url="http://localhost:8001") as client:
        yield client, settings

@pytest.mark.parametrize("role", ["personal_student","school_student","instructor"])
def test_persistent_cookie_registration_login_restoration_logout(pg_engine, browser_api, role):
    client, settings = browser_api
    name = "Cookie_" + uuid4().hex[:12]
    created = client.post("/api/v1/browser/users",json={"username":name,"role":role,"password":PASSWORD},headers=HEADERS)
    assert created.status_code == 201, created.text
    data = created.json()
    assert data["user"]["role"] == role and data["user"]["has_password"]
    assert "credential" not in created.text and "flt_" not in created.text
    with Session(pg_engine) as db:
        user = db.get(User, UUID(data["user"]["id"]))
        saved_hash = user.password_hash
        assert saved_hash.startswith("scrypt:")
        stored = db.scalar(select(UserSession).where(UserSession.user_id==user.id))
        assert stored.credential_digest == credential_digest(client.cookies.get("fluentt_browser_session"))
    # A separate app/client proves database persistence and browser reopening.
    with TestClient(create_app(settings), base_url="http://localhost:8001") as reopened:
        reopened.cookies.update(client.cookies)
        assert reopened.get("/api/v1/browser/sessions/me").json()["user"]["id"] == data["user"]["id"]
    assert client.post("/api/v1/browser/users",json={"username":name.upper(),"role":role,"password":PASSWORD},headers=HEADERS).status_code == 409
    assert client.post("/api/v1/browser/sessions/login",json={"username":name,"password":"incorrect"},headers=HEADERS).status_code == 401
    login = client.post("/api/v1/browser/sessions/login",json={"username":name.upper(),"password":PASSWORD},headers=HEADERS)
    assert login.status_code == 200 and login.json()["user"]["id"] == data["user"]["id"]
    csrf = login.json()["csrf_token"]
    assert client.post("/api/v1/browser/sessions/revoke",headers=HEADERS).status_code == 403
    assert client.post("/api/v1/browser/sessions/revoke",headers={**HEADERS,"X-CSRF-Token":csrf}).status_code == 204
    assert client.get("/api/v1/browser/sessions/me").status_code == 401
    with Session(pg_engine) as db:
        assert db.get(User, UUID(data["user"]["id"])).password_hash == saved_hash

def test_old_tab_cannot_read_new_tab_account(pg_engine, browser_api):
    client, _ = browser_api
    first = client.post("/api/v1/browser/users",json={"username":"First_"+uuid4().hex[:10],"role":"personal_student","password":PASSWORD},headers=HEADERS).json()
    first_headers = {**HEADERS,"X-CSRF-Token":first["csrf_token"]}
    second = client.post("/api/v1/browser/users",json={"username":"Second_"+uuid4().hex[:10],"role":"school_student","password":PASSWORD},headers=HEADERS).json()
    stale = client.get("/api/v1/sessions/me",headers=first_headers)
    assert stale.status_code == 401 and "set-cookie" not in stale.headers
    assert client.patch("/api/v1/users/me/preferences",json={"language":"english"},headers=first_headers).status_code == 401
    active = client.get("/api/v1/sessions/me",headers={**HEADERS,"X-CSRF-Token":second["csrf_token"]})
    assert active.status_code == 200 and active.json()["id"] == second["user"]["id"]


def test_legacy_passwordless_exchange_and_upgrade_preserves_account(pg_engine, browser_api):
    client, settings = browser_api
    with Session(pg_engine) as db:
        legacy = create_user(IdentityRepository(db), CreateUserRequest(username="Legacy_"+uuid4().hex[:12],role="personal_student"), settings)
    raw = legacy.session.credential
    exchange = client.post("/api/v1/browser/sessions/exchange",headers={**HEADERS,"Authorization":"Bearer "+raw})
    assert exchange.status_code == 200 and exchange.json()["user"]["has_password"] is False
    csrf = exchange.json()["csrf_token"]
    assert client.get("/api/v1/sessions/me",headers={"Authorization":"Bearer "+raw}).status_code == 401
    assert client.get("/api/v1/browser/sessions/me").status_code == 200
    assert client.post("/api/v1/users/me/password",json={"password":PASSWORD},headers=HEADERS).status_code == 403
    upgraded = client.post("/api/v1/users/me/password",json={"password":PASSWORD},headers={**HEADERS,"X-CSRF-Token":csrf})
    assert upgraded.status_code == 200 and upgraded.json()["id"] == str(legacy.user.id)
    assert upgraded.json()["has_password"]
    with Session(pg_engine) as db:
        assert db.get(User, legacy.user.id).has_password

def test_valid_legacy_account_takes_priority_over_different_cookie(pg_engine, browser_api):
    client, settings = browser_api
    with Session(pg_engine) as db:
        legacy = create_user(IdentityRepository(db), CreateUserRequest(username="Legacy_"+uuid4().hex[:12],role="personal_student"), settings)
    other = client.post("/api/v1/browser/users",json={"username":"Other_"+uuid4().hex[:12],"role":"instructor","password":PASSWORD},headers=HEADERS)
    assert other.status_code == 201
    result = client.post("/api/v1/browser/sessions/exchange",headers={**HEADERS,"Authorization":"Bearer "+legacy.session.credential})
    assert result.status_code == 200 and result.json()["user"]["id"] == str(legacy.user.id)
    assert client.get("/api/v1/sessions/me",headers={"Authorization":"Bearer "+legacy.session.credential}).status_code == 401
    assert client.get("/api/v1/browser/sessions/me").json()["user"]["id"] == str(legacy.user.id)


def test_legacy_exchange_survives_stale_cookie_transaction(pg_engine, browser_api):
    client, settings = browser_api
    with Session(pg_engine) as db:
        legacy = create_user(IdentityRepository(db), CreateUserRequest(username="Legacy_"+uuid4().hex[:12],role="personal_student"), settings)
    client.post("/api/v1/browser/users",json={"username":"Stale_"+uuid4().hex[:12],"role":"school_student","password":PASSWORD},headers=HEADERS)
    raw_cookie = client.cookies.get("fluentt_browser_session")
    with Session(pg_engine) as db, db.begin():
        db.execute(text("UPDATE user_sessions SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE credential_digest=:digest"),{"digest":credential_digest(raw_cookie)})
    exchanged = client.post("/api/v1/browser/sessions/exchange",headers={**HEADERS,"Authorization":"Bearer "+legacy.session.credential})
    assert exchanged.status_code == 200 and exchanged.json()["user"]["id"] == str(legacy.user.id)
    assert client.get("/api/v1/browser/sessions/me").status_code == 200


@pytest.mark.parametrize("state",["disabled","archived","expired","revoked"])
def test_invalid_persisted_accounts_and_sessions(pg_engine,browser_api,state):
    client,_ = browser_api
    name="Denied_"+uuid4().hex[:12]
    created=client.post("/api/v1/browser/users",json={"username":name,"role":"school_student","password":PASSWORD},headers=HEADERS).json()
    raw=client.cookies.get("fluentt_browser_session")
    with Session(pg_engine) as db, db.begin():
        user=db.get(User,UUID(created["user"]["id"]))
        session=db.scalar(select(UserSession).where(UserSession.credential_digest==credential_digest(raw)))
        if state in ("disabled","archived"):user.profile_status=state
        elif state=="expired":
            # Preserve the schema's creation/expiry order.
            db.execute(text("UPDATE user_sessions SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id=:id"),{"id":session.id})
        else:session.revoked_at=datetime.now(timezone.utc)
    assert client.get("/api/v1/browser/sessions/me").status_code==401
    if state in ("disabled","archived"):
        assert client.post("/api/v1/browser/sessions/login",json={"username":name,"password":PASSWORD},headers=HEADERS).status_code==403

def test_browser_signup_validation_and_blocked_cookie(pg_engine,browser_api):
    client,_=browser_api
    for password in (None,"12345","x"*129):
        result=client.post("/api/v1/browser/users",json={"username":"Invalid_"+uuid4().hex[:10],"role":"personal_student","password":password},headers=HEADERS)
        assert result.status_code==422
    registered=client.post("/api/v1/browser/users",json={"username":"Blocked_"+uuid4().hex[:10],"role":"personal_student","password":PASSWORD},headers=HEADERS)
    assert registered.status_code==201
    client.cookies.clear()
    assert client.get("/api/v1/browser/sessions/me").status_code==401
