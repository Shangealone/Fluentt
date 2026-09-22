from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user_allow_pending_password
from app.auth.models import User
from app.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshTokenRequest,
    TokenResponse,
)
from app.auth.service import (
    AuthenticationError,
    authenticate_user,
    change_user_password,
    create_user_tokens,
    revoke_refresh_token,
    rotate_refresh_token,
)
from app.database.session import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    request: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    try:
        user = authenticate_user(db, email=request.email, password=request.password)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc

    access_token, refresh_token = create_user_tokens(db, user=user)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        must_change_password=user.must_change_password,
    )


@router.post("/change-password", response_model=TokenResponse)
def change_password(
    request: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user_allow_pending_password)],
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    try:
        access_token, refresh_token = change_user_password(
            db,
            user=current_user,
            current_password=request.current_password,
            new_password=request.new_password,
        )
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        must_change_password=current_user.must_change_password,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: RefreshTokenRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    try:
        user, access_token, refresh_token = rotate_refresh_token(
            db, raw_refresh_token=request.refresh_token
        )
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked refresh token",
        ) from exc

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        must_change_password=user.must_change_password,
    )


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: LogoutRequest,
    db: Annotated[Session, Depends(get_db)],
) -> MessageResponse:
    if request.refresh_token:
        revoke_refresh_token(db, raw_refresh_token=request.refresh_token)
    return MessageResponse(status="ok")
