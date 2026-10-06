from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.database.session import get_db
from app.users.schemas import LearnerProfileResponse, UpdatePreferencesRequest
from app.users.service import get_or_create_profile, update_profile_preferences

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=LearnerProfileResponse)
def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> LearnerProfileResponse:
    profile = get_or_create_profile(db, current_user)
    return LearnerProfileResponse(
        id=profile.id,
        user_id=current_user.id,
        participant_code=current_user.participant_code,
        email=current_user.email,
        interface_language=profile.interface_language,  # type: ignore[arg-type]
        target_learning_language=profile.target_learning_language,  # type: ignore[arg-type]
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.patch("/me/preferences", response_model=LearnerProfileResponse)
def update_preferences(
    request: UpdatePreferencesRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> LearnerProfileResponse:
    profile = update_profile_preferences(
        db,
        user=current_user,
        interface_language=request.interface_language.value
        if request.interface_language
        else None,
        target_learning_language=request.target_learning_language.value
        if request.target_learning_language
        else None,
    )
    return LearnerProfileResponse(
        id=profile.id,
        user_id=current_user.id,
        participant_code=current_user.participant_code,
        email=current_user.email,
        interface_language=profile.interface_language,  # type: ignore[arg-type]
        target_learning_language=profile.target_learning_language,  # type: ignore[arg-type]
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )
