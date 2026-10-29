from datetime import timedelta
import time

from fastapi.testclient import TestClient
from joserfc import jwt
from joserfc.jwk import RSAKey, KeySet
import pytest

from app.core.config import Settings
from app.main import create_app
from app.modules.administration import service
from app.modules.administration.oidc import OIDCProvider
from app.modules.administration.router import provider, repository
from app.modules.administration.security import derived, secret
from app.modules.identity.errors import IdentityError
from tests.admin_support import MemoryAdminRepository


def settings(**overrides):
    values = dict(
        _env_file=None,
        environment="test",
        database_url=None,
        admin_oidc_issuer="https://id.example",
        admin_oidc_client_id="synthetic-client",
        admin_oidc_client_secret="synthetic-test-only-secret",
        admin_oidc_mfa_values=["approved-mfa"],
    )
    values.update(overrides)
    return Settings(**values)


@pytest.fixture
def repo():
    return MemoryAdminRepository()


def issue(repo, **kwargs):
    return service.issue_session(repo, "https://id.example", "approved-subject", **kwargs)


def test_attempt_binding_expiry_and_one_use(repo):
    now = service.utcnow()
    state, binding = service.begin_attempt(repo, now)
    assert not service.consume_attempt(repo, state, secret(), now)
    assert service.consume_attempt(repo, state, binding, now)
    assert not service.consume_attempt(repo, state, binding, now)
    state, binding = service.begin_attempt(repo, now)
    assert not service.consume_attempt(repo, state, binding, now + timedelta(minutes=11))
    assert state not in str(repo.attempts[0].__dict__) and binding not in str(repo.attempts[0].__dict__)


def test_session_restoration_rotation_logout_and_secret_separation(repo):
    now = service.utcnow()
    token = issue(repo, now=now)
    profile = service.resolve_session(repo, token, now=now + timedelta(minutes=20))
    assert profile.username == "SyntheticAdmin"
    assert profile.expires_at == now + timedelta(minutes=50)
    assert token not in profile.model_dump_json()
    assert token not in str(repo.sessions[0].__dict__)
    rotated = issue(repo, previous=token, now=now + timedelta(minutes=21))
    assert rotated != token
    with pytest.raises(IdentityError):
        service.resolve_session(repo, token, now=now + timedelta(minutes=22))
    service.resolve_session(repo, rotated, logout=True, csrf=derived(rotated, "csrf"), now=now + timedelta(minutes=22))
    with pytest.raises(IdentityError):
        service.resolve_session(repo, rotated, now=now + timedelta(minutes=23))


@pytest.mark.parametrize("change", ["unknown", "disabled", "archived", "role", "permission"])
def test_unknown_or_ineligible_admin_cannot_sign_in(repo, change):
    if change == "unknown":
        repo.account = None
    elif change == "disabled":
        repo.account.profile_status = "disabled"
    elif change == "archived":
        repo.account.archived_at = service.utcnow()
    elif change == "role":
        repo.account.role = "instructor"
    else:
        repo.granted.clear()
    assert issue(repo) is None
    assert repo.events[-1][0] == "admin.login_failed"


@pytest.mark.parametrize("change", ["disabled", "role", "permission", "revoked", "idle", "absolute", "csrf"])
def test_existing_sessions_revalidate_live_access(repo, change):
    now = service.utcnow()
    token = issue(repo, now=now)
    if change == "disabled":
        repo.account.profile_status = "disabled"
    elif change == "role":
        repo.account.role = "school_student"
    elif change == "permission":
        repo.granted.clear()
    elif change == "revoked":
        repo.sessions[0].revoked_at = now
    elif change == "idle":
        now += timedelta(minutes=30)
    elif change == "absolute":
        repo.sessions[0].expires_at = now + timedelta(hours=9)
        now += timedelta(hours=8)
    with pytest.raises(IdentityError):
        service.resolve_session(repo, token, now=now, logout=change == "csrf", csrf="invalid")


def test_absolute_expiry_caps_sliding_idle(repo):
    now = service.utcnow()
    token = issue(repo, now=now)
    repo.sessions[0].expires_at = now + timedelta(hours=8)
    profile = service.resolve_session(repo, token, now=now + timedelta(hours=7, minutes=50))
    assert profile.expires_at == profile.absolute_expires_at == now + timedelta(hours=8)


class SyntheticProvider:
    def authorization_url(self, state, binding):
        return "https://id.example/authorize?state=" + state

    def authenticate(self, code, state, binding):
        if code != "synthetic-code":
            raise ValueError("private-provider-secret")
        return "https://id.example", "approved-subject"


@pytest.fixture
def client(repo):
    app = create_app(settings())
    app.app.dependency_overrides[repository] = lambda: repo
    app.app.dependency_overrides[provider] = SyntheticProvider
    with TestClient(app, follow_redirects=False) as client:
        yield client


def signin(client):
    response = client.post("/api/v1/admin/auth/start", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 303
    from urllib.parse import urlparse, parse_qs

    state = parse_qs(urlparse(response.headers["location"]).query)["state"][0]
    return client.get("/api/v1/admin/auth/callback", params={"state": state, "code": "synthetic-code"}), state


def test_http_login_restore_logout_csrf_and_replay(client, repo):
    response, state = signin(client)
    assert response.headers["location"] == "http://localhost:3000/dashboard"
    assert "HttpOnly" in response.headers["set-cookie"] and "SameSite=lax" in response.headers["set-cookie"]
    profile = client.get("/api/v1/admin/me")
    assert profile.status_code == 200 and profile.headers["cache-control"] == "no-store"
    assert client.delete("/api/v1/admin/session").status_code == 403
    assert client.delete("/api/v1/admin/session", headers={"Origin": "https://attacker.example"}).status_code == 403
    assert client.delete("/api/v1/admin/session", headers={"Origin": "http://localhost:3000"}).status_code == 403
    # Invalid CSRF did not revoke the server session.
    assert client.get("/api/v1/admin/me").status_code == 200
    assert (
        client.delete(
            "/api/v1/admin/session",
            headers={"Origin": "http://localhost:3000", "X-CSRF-Token": profile.json()["csrf_token"]},
        ).status_code
        == 204
    )
    assert client.get("/api/v1/admin/me").status_code == 401
    replay = client.get("/api/v1/admin/auth/callback", params={"state": state, "code": "synthetic-code"})
    assert replay.headers["location"].endswith("/login?error=sign_in_failed")


def test_http_failures_unauthorized_and_no_secret_leak(client, repo):
    assert client.get("/api/v1/admin/me").status_code == 401
    assert client.get("/api/v1/admin/me", headers={"Authorization": "Bearer flt_" + "a" * 43}).status_code == 401
    assert client.post("/api/v1/admin/auth/start", headers={"Origin": "https://attacker.example"}).status_code == 403
    repo.account.profile_status = "disabled"
    response, _ = signin(client)
    assert response.headers["location"].endswith("sign_in_failed")
    assert client.get("/api/v1/admin/me").status_code == 401


def test_unbound_callback_cannot_clear_current_session_or_pending_binding(client):
    signin(client)
    active_cookie = client.cookies.get("fluentt_admin")
    started = client.post("/api/v1/admin/auth/start", headers={"Origin": "http://localhost:3000"})
    assert started.status_code == 303
    binding = client.cookies.get("fluentt_oidc")
    response = client.get("/api/v1/admin/auth/callback?state=invalid&code=invalid")
    assert "set-cookie" not in response.headers
    assert client.cookies.get("fluentt_admin") == active_cookie
    assert client.cookies.get("fluentt_oidc") == binding
    assert client.get("/api/v1/admin/me").status_code == 200


def test_disabled_configuration_no_database_required():
    with TestClient(create_app(Settings(_env_file=None, database_url=None)), follow_redirects=False) as client:
        assert client.get("/api/v1/admin/auth/config").json() == {"enabled": False}
        assert client.post("/api/v1/admin/auth/start", headers={"Origin": "http://localhost:3000"}).status_code == 503
        assert client.get("/api/v1/admin/me").status_code == 401


def test_failed_login_throttling(client):
    for _ in range(10):
        assert client.get("/api/v1/admin/auth/callback?state=invalid").status_code == 303
    result = client.get("/api/v1/admin/auth/callback?state=invalid")
    assert result.status_code == 429 and result.headers["retry-after"]


@pytest.fixture(scope="module")
def signing_key():
    return RSAKey.generate_key(2048, parameters={"kid": "synthetic-key"})


@pytest.mark.parametrize("change", [None, "iss", "aud", "nonce", "exp", "sub", "mfa", "auth_time", "signature", "alg"])
def test_real_signed_oidc_tokens_validate_all_required_claims(signing_key, change):
    now = int(time.time())
    claims = {
        "iss": "https://id.example",
        "aud": "synthetic-client",
        "sub": "approved-subject",
        "iat": now,
        "exp": now + 300,
        "auth_time": now,
        "nonce": "synthetic-nonce",
        "acr": "approved-mfa",
    }
    if change in {"iss", "aud", "nonce", "sub"}:
        claims[change] = "" if change == "sub" else "wrong-value"
    elif change == "exp":
        claims["exp"] = now - 100
    elif change == "mfa":
        claims["acr"] = "password-only"
    elif change == "auth_time":
        claims["auth_time"] = now - 1000
    key = RSAKey.generate_key(2048, parameters={"kid": "synthetic-key"}) if change == "signature" else signing_key
    algorithm = "RS384" if change == "alg" else "RS256"
    encoded = jwt.encode({"alg": algorithm, "kid": "synthetic-key"}, claims, key, algorithms=[algorithm])
    oidc = OIDCProvider(settings())
    keys = KeySet.import_key_set({"keys": [signing_key.as_dict(private=False)]})
    if change:
        with pytest.raises(Exception):
            oidc.validate_id_token({"id_token": encoded}, keys, "synthetic-nonce")
    else:
        assert oidc.validate_id_token({"id_token": encoded}, keys, "synthetic-nonce") == (
            "https://id.example",
            "approved-subject",
        )


def test_oidc_http_code_flow_pkce_nonce_and_no_token_leakage(monkeypatch, signing_key):
    import base64
    import hashlib
    import httpx
    from urllib.parse import parse_qs, urlparse
    from authlib.integrations.httpx_client import OAuth2Client
    import app.modules.administration.oidc as module

    state, binding = secret(), secret()
    verifier = derived(binding, "pkce:" + state)
    requests = []

    def handle(request):
        requests.append(request)
        if request.url.path.endswith("openid-configuration"):
            return httpx.Response(
                200,
                json={
                    "issuer": "https://id.example",
                    "authorization_endpoint": "https://id.example/authorize",
                    "token_endpoint": "https://id.example/token",
                    "jwks_uri": "https://id.example/jwks",
                    "response_types_supported": ["code"],
                    "code_challenge_methods_supported": ["S256"],
                    "token_endpoint_auth_methods_supported": ["client_secret_basic"],
                },
            )
        if request.url.path == "/token":
            body = parse_qs(request.content.decode())
            assert body["code_verifier"] == [verifier]
            assert body["code"] == ["synthetic-code"]
            assert body["redirect_uri"] == ["http://localhost:3000/api/admin/callback"]
            assert request.headers["authorization"].startswith("Basic ")
            now = int(time.time())
            claims = {
                "iss": "https://id.example",
                "sub": "approved-subject",
                "aud": "synthetic-client",
                "iat": now,
                "exp": now + 300,
                "auth_time": now,
                "acr": "approved-mfa",
                "nonce": derived(binding, "nonce:" + state),
            }
            encoded = jwt.encode({"alg": "RS256", "kid": "synthetic-key"}, claims, signing_key)
            return httpx.Response(
                200, json={"id_token": encoded, "access_token": "synthetic-access-token", "token_type": "Bearer"}
            )
        assert request.url.path == "/jwks" and "authorization" not in request.headers
        return httpx.Response(200, json={"keys": [signing_key.as_dict(private=False)]})

    monkeypatch.setattr(
        module,
        "OAuth2Client",
        lambda *args, **kwargs: OAuth2Client(*args, transport=httpx.MockTransport(handle), **kwargs),
    )
    oidc = OIDCProvider(settings())
    query = parse_qs(urlparse(oidc.authorization_url(state, binding)).query)
    assert query["state"] == [state] and query["nonce"] == [derived(binding, "nonce:" + state)]
    assert query["code_challenge_method"] == ["S256"]
    assert query["code_challenge"] == [
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    ]
    assert query["response_type"] == ["code"] and query["max_age"] == ["300"]
    assert "client_secret" not in query and "code_verifier" not in query
    assert oidc.authenticate("synthetic-code", state, binding) == ("https://id.example", "approved-subject")
    assert len(requests) == 4


@pytest.mark.parametrize(
    "field,value",
    [
        ("issuer", "https://attacker.example"),
        ("jwks_uri", "http://id.example/jwks"),
        ("code_challenge_methods_supported", ["plain"]),
    ],
)
def test_discovery_fails_closed(field, value):
    import httpx

    metadata = {
        "issuer": "https://id.example",
        "authorization_endpoint": "https://id.example/authorize",
        "token_endpoint": "https://id.example/token",
        "jwks_uri": "https://id.example/jwks",
        "code_challenge_methods_supported": ["S256"],
        "response_types_supported": ["code"],
        "token_endpoint_auth_methods_supported": ["client_secret_basic"],
    }
    metadata[field] = value
    with httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(200, json=metadata))) as client:
        with pytest.raises(ValueError):
            OIDCProvider(settings()).metadata(client)


def test_production_cookie_and_transport_contract(repo):
    app = create_app(settings(environment="production", admin_web_origin="https://admin.example"))
    app.app.dependency_overrides[repository] = lambda: repo
    app.app.dependency_overrides[provider] = SyntheticProvider
    with TestClient(app, base_url="https://api.example", follow_redirects=False) as client:
        response = client.post("/api/v1/admin/auth/start", headers={"Origin": "https://admin.example"})
        cookie = response.headers["set-cookie"]
        assert "__Host-fluentt_oidc=" in cookie and "Secure" in cookie and "HttpOnly" in cookie
        assert "Domain=" not in cookie and "Path=/" in cookie
    with TestClient(app) as client:
        assert client.get("/api/v1/admin/auth/config").status_code == 400


def test_mfa_is_required_for_enabled_configuration():
    assert not settings(admin_oidc_mfa_values=[]).admin_oidc_enabled
    assert not settings(admin_oidc_client_secret="").admin_oidc_enabled
    assert not settings(admin_oidc_client_id=" ").admin_oidc_enabled
    assert settings().admin_oidc_enabled
