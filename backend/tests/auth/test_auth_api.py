from typing import Annotated

from fastapi import Depends
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.auth.service import provision_participant
from app.database.session import SessionLocal
from app.main import app

client = TestClient(app)


# Protected test route to verify get_current_user restrictions
@app.get("/test-protected")
def protected_route(user: Annotated[User, Depends(get_current_user)]):
    return {"status": "ok", "user_id": str(user.id)}


def test_login_success_and_temporary_password_flag() -> None:
    db = SessionLocal()
    try:
        provision_participant(
            db,
            email="learner1@example.test",
            participant_code="P001",
            temporary_password="TempPassword!123",
        )
    finally:
        db.close()

    response = client.post(
        "/auth/login",
        json={"email": "learner1@example.test", "password": "TempPassword!123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["must_change_password"] is True


def test_invalid_password_returns_401() -> None:
    db = SessionLocal()
    try:
        provision_participant(
            db,
            email="learner2@example.test",
            participant_code="P002",
            temporary_password="CorrectPassword!1",
        )
    finally:
        db.close()

    response = client.post(
        "/auth/login",
        json={"email": "learner2@example.test", "password": "WrongPassword!99"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_inactive_learner_cannot_authenticate() -> None:
    db = SessionLocal()
    try:
        user = provision_participant(
            db,
            email="inactive@example.test",
            participant_code="P003",
            temporary_password="CorrectPassword!1",
        )
        user.is_active = False
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/auth/login",
        json={"email": "inactive@example.test", "password": "CorrectPassword!1"},
    )
    assert response.status_code == 401


def test_temporary_password_blocks_normal_protected_route() -> None:
    db = SessionLocal()
    try:
        provision_participant(
            db,
            email="learner_temp@example.test",
            participant_code="P004",
            temporary_password="TempPassword!123",
        )
    finally:
        db.close()

    login_resp = client.post(
        "/auth/login",
        json={"email": "learner_temp@example.test", "password": "TempPassword!123"},
    )
    access_token = login_resp.json()["access_token"]

    # Attempting to access protected endpoint with must_change_password=True yields 403
    protected_resp = client.get(
        "/test-protected",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert protected_resp.status_code == 403


def test_password_change_flow_and_protected_access() -> None:
    db = SessionLocal()
    try:
        provision_participant(
            db,
            email="learner_chg@example.test",
            participant_code="P005",
            temporary_password="InitialPassword!1",
        )
    finally:
        db.close()

    # 1. Login with temporary password
    login_resp = client.post(
        "/auth/login",
        json={"email": "learner_chg@example.test", "password": "InitialPassword!1"},
    )
    tok1 = login_resp.json()["access_token"]

    # 2. Change password
    change_resp = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {tok1}"},
        json={
            "current_password": "InitialPassword!1",
            "new_password": "NewSecurePassword!2026",
        },
    )
    assert change_resp.status_code == 200
    new_data = change_resp.json()
    assert new_data["must_change_password"] is False
    new_access_tok = new_data["access_token"]

    # 3. Access protected route with new token
    protected_resp = client.get(
        "/test-protected",
        headers={"Authorization": f"Bearer {new_access_tok}"},
    )
    assert protected_resp.status_code == 200
    assert protected_resp.json()["status"] == "ok"


def test_refresh_token_rotation_and_revocation_via_api() -> None:
    db = SessionLocal()
    try:
        provision_participant(
            db,
            email="learner_rot@example.test",
            participant_code="P006",
            temporary_password="InitialPassword!1",
        )
    finally:
        db.close()

    login_resp = client.post(
        "/auth/login",
        json={"email": "learner_rot@example.test", "password": "InitialPassword!1"},
    )
    refresh_tok1 = login_resp.json()["refresh_token"]

    # 1. Rotate refresh token
    rotate_resp = client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_tok1},
    )
    assert rotate_resp.status_code == 200
    refresh_tok2 = rotate_resp.json()["refresh_token"]
    assert refresh_tok1 != refresh_tok2

    # 2. Old refresh token cannot be reused
    reuse_resp = client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_tok1},
    )
    assert reuse_resp.status_code == 401

    # 3. New refresh token works
    second_rotate = client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_tok2},
    )
    assert second_rotate.status_code == 200


def test_malformed_or_invalid_refresh_token() -> None:
    response = client.post(
        "/auth/refresh",
        json={"refresh_token": "not-a-valid-jwt"},
    )
    assert response.status_code == 401


def test_logout_revokes_token() -> None:
    db = SessionLocal()
    try:
        provision_participant(
            db,
            email="learner_logout@example.test",
            participant_code="P007",
            temporary_password="InitialPassword!1",
        )
    finally:
        db.close()

    login_resp = client.post(
        "/auth/login",
        json={"email": "learner_logout@example.test", "password": "InitialPassword!1"},
    )
    refresh_tok = login_resp.json()["refresh_token"]

    # Logout
    logout_resp = client.post("/auth/logout", json={"refresh_token": refresh_tok})
    assert logout_resp.status_code == 200

    # Token should now be revoked
    refresh_resp = client.post("/auth/refresh", json={"refresh_token": refresh_tok})
    assert refresh_resp.status_code == 401
