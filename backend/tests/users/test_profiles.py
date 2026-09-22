import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth.service import (
    change_user_password,
    create_user_tokens,
    provision_participant,
)
from app.database.session import SessionLocal, engine
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_database():
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE refresh_sessions, users CASCADE;"))
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE refresh_sessions, users CASCADE;"))


def test_get_profile_returns_initial_preferences() -> None:
    db = SessionLocal()
    try:
        user = provision_participant(
            db,
            email="learner_profile@example.test",
            participant_code="P_PROF_01",
            temporary_password="TempPass!123",
        )
        # Change password so learner can access normal routes
        access_tok, _ = change_user_password(
            db,
            user=user,
            current_password="TempPass!123",
            new_password="PermanentPass!123",
        )
    finally:
        db.close()

    response = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {access_tok}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["participant_code"] == "P_PROF_01"
    assert data["email"] == "learner_profile@example.test"
    assert data["interface_language"] is None
    assert data["target_learning_language"] is None


def test_update_valid_preferences_success() -> None:
    db = SessionLocal()
    try:
        user = provision_participant(
            db,
            email="learner_pref@example.test",
            participant_code="P_PREF_01",
            temporary_password="TempPass!123",
        )
        access_tok, _ = change_user_password(
            db,
            user=user,
            current_password="TempPass!123",
            new_password="PermanentPass!123",
        )
    finally:
        db.close()

    # Update preferences: Tagalog interface, English learning
    patch_resp = client.patch(
        "/users/me/preferences",
        headers={"Authorization": f"Bearer {access_tok}"},
        json={"interface_language": "fil", "target_learning_language": "en"},
    )
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["interface_language"] == "fil"
    assert data["target_learning_language"] == "en"

    # Verify GET /users/me reflects updated preferences
    get_resp = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {access_tok}"},
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["interface_language"] == "fil"
    assert get_resp.json()["target_learning_language"] == "en"


def test_unsupported_language_code_rejected() -> None:
    db = SessionLocal()
    try:
        user = provision_participant(
            db,
            email="learner_bad_lang@example.test",
            participant_code="P_LANG_01",
            temporary_password="TempPass!123",
        )
        access_tok, _ = change_user_password(
            db,
            user=user,
            current_password="TempPass!123",
            new_password="PermanentPass!123",
        )
    finally:
        db.close()

    # Reject unsupported interface language
    resp1 = client.patch(
        "/users/me/preferences",
        headers={"Authorization": f"Bearer {access_tok}"},
        json={"interface_language": "xx"},
    )
    assert resp1.status_code == 422

    # Reject unsupported target language
    resp2 = client.patch(
        "/users/me/preferences",
        headers={"Authorization": f"Bearer {access_tok}"},
        json={"target_learning_language": "es"},
    )
    assert resp2.status_code == 422


def test_temporary_password_user_cannot_access_profile() -> None:
    db = SessionLocal()
    try:
        user = provision_participant(
            db,
            email="learner_temp_prof@example.test",
            participant_code="P_TEMP_01",
            temporary_password="TempPass!123",
        )
        access_tok, _ = create_user_tokens(db, user=user)
    finally:
        db.close()

    response = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {access_tok}"},
    )
    assert response.status_code == 403
