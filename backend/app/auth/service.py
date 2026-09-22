import uuid
from datetime import UTC, datetime

import jwt
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.auth.models import RefreshSession, User
from app.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)


class DuplicateParticipantError(Exception):
    pass


class ParticipantNotFoundError(Exception):
    pass


class AuthenticationError(Exception):
    pass


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_participant_code(code: str) -> str:
    return code.strip().upper()


def provision_participant(
    db: Session,
    *,
    email: str,
    participant_code: str,
    temporary_password: str,
) -> User:
    norm_email = normalize_email(email)
    norm_code = normalize_participant_code(participant_code)

    existing_email = db.scalar(select(User).where(User.email == norm_email))
    if existing_email:
        raise DuplicateParticipantError(
            f"User with email '{norm_email}' already exists"
        )

    existing_code = db.scalar(select(User).where(User.participant_code == norm_code))
    if existing_code:
        raise DuplicateParticipantError(
            f"Participant with code '{norm_code}' already exists"
        )

    user = User(
        email=norm_email,
        participant_code=norm_code,
        password_hash=hash_password(temporary_password),
        must_change_password=True,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def reset_participant_password(
    db: Session,
    *,
    participant_code: str,
    temporary_password: str,
) -> User:
    norm_code = normalize_participant_code(participant_code)
    user = db.scalar(select(User).where(User.participant_code == norm_code))
    if not user:
        raise ParticipantNotFoundError(f"Participant with code '{norm_code}' not found")

    user.password_hash = hash_password(temporary_password)
    user.must_change_password = True

    now = datetime.now(UTC)
    db.execute(
        update(RefreshSession)
        .where(
            RefreshSession.user_id == user.id,
            RefreshSession.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )

    db.commit()
    db.refresh(user)
    return user


def authenticate_user(
    db: Session,
    *,
    email: str,
    password: str,
) -> User:
    norm_email = normalize_email(email)
    user = db.scalar(select(User).where(User.email == norm_email))
    if not user:
        raise AuthenticationError("Invalid email or password")

    if not user.is_active:
        raise AuthenticationError("Account is inactive")

    if not verify_password(password, user.password_hash):
        raise AuthenticationError("Invalid email or password")

    return user


def create_user_tokens(
    db: Session,
    *,
    user: User,
) -> tuple[str, str]:
    jti = str(uuid.uuid4())
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id), jti)

    payload = decode_token(refresh_token)
    expires_at = datetime.fromtimestamp(payload["exp"], tz=UTC)

    session = RefreshSession(
        user_id=user.id,
        jti=jti,
        token_hash=hash_token(refresh_token),
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()

    return access_token, refresh_token


def rotate_refresh_token(
    db: Session,
    *,
    raw_refresh_token: str,
) -> tuple[User, str, str]:
    try:
        payload = decode_token(raw_refresh_token)
    except (jwt.PyJWTError, ValueError) as exc:
        raise AuthenticationError("Invalid or expired refresh token") from exc

    if (
        payload.get("type") != "refresh"
        or not payload.get("jti")
        or not payload.get("sub")
    ):
        raise AuthenticationError("Invalid token type")

    jti = payload["jti"]
    user_id_str = payload["sub"]

    session = db.scalar(select(RefreshSession).where(RefreshSession.jti == jti))
    if not session:
        raise AuthenticationError("Refresh session not found")

    if session.revoked_at is not None:
        raise AuthenticationError("Refresh token has been revoked")

    now = datetime.now(UTC)
    if session.expires_at <= now:
        raise AuthenticationError("Refresh token has expired")

    if session.token_hash != hash_token(raw_refresh_token):
        raise AuthenticationError("Invalid token payload")

    user = db.scalar(select(User).where(User.id == session.user_id))
    if not user or not user.is_active:
        raise AuthenticationError("User is inactive or deleted")

    if str(user.id) != user_id_str:
        raise AuthenticationError("Invalid user token reference")

    # Revoke current session
    session.revoked_at = now

    # Issue new rotated session
    new_jti = str(uuid.uuid4())
    new_access_token = create_access_token(str(user.id))
    new_refresh_token = create_refresh_token(str(user.id), new_jti)

    new_payload = decode_token(new_refresh_token)
    new_expires_at = datetime.fromtimestamp(new_payload["exp"], tz=UTC)

    new_session = RefreshSession(
        user_id=user.id,
        jti=new_jti,
        token_hash=hash_token(new_refresh_token),
        expires_at=new_expires_at,
    )
    db.add(new_session)
    db.commit()

    return user, new_access_token, new_refresh_token


def revoke_refresh_token(
    db: Session,
    *,
    raw_refresh_token: str,
) -> None:
    try:
        payload = decode_token(raw_refresh_token)
        jti = payload.get("jti")
        if jti:
            session = db.scalar(select(RefreshSession).where(RefreshSession.jti == jti))
            if session and session.revoked_at is None:
                session.revoked_at = datetime.now(UTC)
                db.commit()
    except (jwt.PyJWTError, ValueError):
        # Safe no-op on malformed/already-expired tokens
        return


def change_user_password(
    db: Session,
    *,
    user: User,
    current_password: str,
    new_password: str,
) -> tuple[str, str]:
    if not verify_password(current_password, user.password_hash):
        raise AuthenticationError("Invalid current password")

    user.password_hash = hash_password(new_password)
    user.must_change_password = False

    # Revoke all existing sessions
    now = datetime.now(UTC)
    db.execute(
        update(RefreshSession)
        .where(
            RefreshSession.user_id == user.id,
            RefreshSession.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )

    access_token, refresh_token = create_user_tokens(db, user=user)
    return access_token, refresh_token
