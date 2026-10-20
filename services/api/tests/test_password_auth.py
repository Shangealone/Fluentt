"""Tests for password hashing, user registration with passwords, and login authentication."""

import pytest
from starlette.testclient import TestClient

from app.core.config import Settings
from app.core.security import hash_password, verify_password
from app.main import create_app
from app.modules.identity.dependencies import get_identity_repository
from tests.identity_support import MemoryIdentityRepository


@pytest.fixture
def repo():
    return MemoryIdentityRepository()


@pytest.fixture
def client(repo):
    app = create_app()
    app.app.dependency_overrides[get_identity_repository] = lambda: repo
    return TestClient(app.app, base_url="http://testserver")


def test_password_hashing_and_verification():
    raw = "SecureSecret123!"
    hashed = hash_password(raw)
    assert hashed.startswith("scrypt:")
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False
    assert verify_password("", hashed) is False
    assert verify_password(raw, None) is False
    assert verify_password(raw, "invalid:format") is False


def test_register_user_with_password(client):
    response = client.post(
        "/api/v1/users",
        json={"username": "mika_student", "role": "school_student", "password": "Password123!"},
        headers={"Host": "127.0.0.1"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["username"] == "mika_student"
    assert data["session"]["credential"].startswith("flt_")


def test_register_user_password_too_short(client):
    response = client.post(
        "/api/v1/users",
        json={"username": "short_pw_user", "role": "school_student", "password": "123"},
        headers={"Host": "127.0.0.1"},
    )
    assert response.status_code == 422


def test_login_success(client):
    # 1. Register with password
    client.post(
        "/api/v1/users",
        json={"username": "carlos_guro", "role": "instructor", "password": "GuroPassword2026"},
        headers={"Host": "127.0.0.1"},
    )

    # 2. Login with correct credentials (case-insensitive username)
    login_res = client.post(
        "/api/v1/sessions/login",
        json={"username": "Carlos_Guro", "password": "GuroPassword2026"},
        headers={"Host": "127.0.0.1"},
    )
    assert login_res.status_code == 200
    data = login_res.json()
    assert data["user"]["username"] == "carlos_guro"
    assert data["user"]["role"] == "instructor"
    token = data["session"]["credential"]
    assert token.startswith("flt_")

    # 3. Use token to fetch profile
    me_res = client.get(
        "/api/v1/sessions/me",
        headers={"Authorization": f"Bearer {token}", "Host": "127.0.0.1"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "carlos_guro"


def test_login_wrong_password(client):
    client.post(
        "/api/v1/users",
        json={"username": "elena_learner", "role": "personal_student", "password": "CorrectPassword"},
        headers={"Host": "127.0.0.1"},
    )

    login_res = client.post(
        "/api/v1/sessions/login",
        json={"username": "elena_learner", "password": "WrongPassword"},
        headers={"Host": "127.0.0.1"},
    )
    assert login_res.status_code == 401
    assert login_res.json()["error"]["code"] == "invalid_credentials"


def test_login_nonexistent_user(client):
    login_res = client.post(
        "/api/v1/sessions/login",
        json={"username": "ghost_user", "password": "SomePassword123"},
        headers={"Host": "127.0.0.1"},
    )
    assert login_res.status_code == 401
    assert login_res.json()["error"]["code"] == "invalid_credentials"


def test_login_user_without_password(client):
    # Legacy registration without password
    client.post(
        "/api/v1/users",
        json={"username": "legacy_user", "role": "school_student"},
        headers={"Host": "127.0.0.1"},
    )

    login_res = client.post(
        "/api/v1/sessions/login",
        json={"username": "legacy_user", "password": "AnyPassword"},
        headers={"Host": "127.0.0.1"},
    )
    assert login_res.status_code == 401
    assert login_res.json()["error"]["code"] == "invalid_credentials"

