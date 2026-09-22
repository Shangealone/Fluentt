from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.database.session import get_db
from app.sync.schemas import SyncReviewEventsRequest, SyncReviewEventsResponse
from app.sync.service import sync_review_events

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/review-events", response_model=SyncReviewEventsResponse)
def sync_events(
    sync_in: SyncReviewEventsRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SyncReviewEventsResponse:
    accepted = sync_review_events(
        db=db,
        user=current_user,
        events=sync_in.events,
    )
    return SyncReviewEventsResponse(accepted_events=accepted)
