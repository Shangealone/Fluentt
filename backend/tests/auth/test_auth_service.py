import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.auth.models import RefreshSession
from app.auth.security import hash_password, verify_password
from app.auth.service import (
    AuthenticationError,
    DuplicateParticipantError,
    ParticipantNotFoundError,
    change_user_password,
    create_user_tokens,
    provision_participant,
    reset_participant_password,
    rotate_refresh_token,
)
from app.database.session import SessionLocal, engine


@pytest.fixture(autouse=True)
def clean_database():
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE refresh_sessions, users CASCADE;"))
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE refresh_sessions, users CASCADE;"))


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_password_is_argon2_hashed() -> None:
    encoded = hash_password("TemporaryPass!23")
    assert encoded != "TemporaryPass!23"
    assert encoded.startswith("$argon2")
    assert verify_password("TemporaryPass!23", encoded)
    assert not verify_password("WrongPassword!23", encoded)


def test_duplicate_participant_code_rejected(db_session: Session) -> None:
    email1 = "learner1_dup@example.test"
    email2 = "learner2_dup@example.test"
    code = "P_DUP_01"

    provision_participant(
        db_session,
        email=email1,
        participant_code=code,
        temporary_password="TempPassword!1",
    )

    with pytest.raises(DuplicateParticipantError):
        provision_participant(
            db_session,
            email=email2,
            participant_code=code,
            temporary_password="TempPassword!2",
        )


def test_duplicate_email_rejected(db_session: Session) -> None:
    email = "learner_same_email@example.test"
    code1 = "P_EM_01"
    code2 = "P_EM_02"

    provision_participant(
        db_session,
        email=email,
        participant_code=code1,
        temporary_password="TempPassword!1",
    )

    with pytest.raises(DuplicateParticipantError):
        provision_participant(
            db_session,
            email=email,
            participant_code=code2,
            temporary_password="TempPassword!2",
        )


def test_reset_participant_password(db_session: Session) -> None:
    email = "reset_test@example.test"
    code = "P_RESET_01"
    user = provision_participant(
        db_session,
        email=email,
        participant_code=code,
        temporary_password="OldPassword!1",
    )

    # Issue refresh session
    _, _ = create_user_tokens(db_session, user=user)

    # Reset password
    updated_user = reset_participant_password(
        db_session,
        participant_code=code,
        temporary_password="NewTemporary!2",
    )
    assert updated_user.must_change_password is True
    assert verify_password("NewTemporary!2", updated_user.password_hash)

    # Verify old refresh session is revoked
    sessions = db_session.scalars(
        select(RefreshSession).where(RefreshSession.user_id == user.id)
    ).all()
    assert all(s.revoked_at is not None for s in sessions)


def test_reset_nonexistent_participant_raises(db_session: Session) -> None:
    with pytest.raises(ParticipantNotFoundError):
        reset_participant_password(
            db_session,
            participant_code="NON_EXISTENT",
            temporary_password="TempPass!1",
        )


def test_refresh_token_rotation_and_revocation(db_session: Session) -> None:
    email = "rotation_test@example.test"
    code = "P_ROT_01"
    user = provision_participant(
        db_session,
        email=email,
        participant_code=code,
        temporary_password="TempPass!1",
    )

    access_tok1, refresh_tok1 = create_user_tokens(db_session, user=user)

    # Rotate
    user_rot, access_tok2, refresh_tok2 = rotate_refresh_token(
        db_session, raw_refresh_token=refresh_tok1
    )
    assert user_rot.id == user.id
    assert access_tok1 != access_tok2
    assert refresh_tok1 != refresh_tok2

    # Old refresh token is now revoked and rejected
    with pytest.raises(AuthenticationError, match="revoked"):
        rotate_refresh_token(db_session, raw_refresh_token=refresh_tok1)

    # New refresh token works
    _, _, refresh_tok3 = rotate_refresh_token(
        db_session, raw_refresh_token=refresh_tok2
    )
    assert refresh_tok2 != refresh_tok3


def test_change_user_password(db_session: Session) -> None:
    email = "change_pass_test@example.test"
    code = "P_CHG_01"
    user = provision_participant(
        db_session,
        email=email,
        participant_code=code,
        temporary_password="InitialPassword!1",
    )
    assert user.must_change_password is True

    _, _ = change_user_password(
        db_session,
        user=user,
        current_password="InitialPassword!1",
        new_password="NewPermanentPassword!123",
    )
    assert user.must_change_password is False
    assert verify_password("NewPermanentPassword!123", user.password_hash)

    # Bad current password rejected
    with pytest.raises(AuthenticationError, match="Invalid current password"):
        change_user_password(
            db_session,
            user=user,
            current_password="WrongPassword!1",
            new_password="AnotherPassword!123",
        )
