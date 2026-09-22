from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.analytics.schemas import LearnerProgressResponse
from app.analytics.service import get_learner_progress
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.database.session import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/progress", response_model=LearnerProgressResponse)
def get_progress(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> LearnerProgressResponse:
    return get_learner_progress(db=db, user=current_user)
