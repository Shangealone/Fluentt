import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.database.session import get_db
from app.reviews.eligibility import get_review_eligibility
from app.reviews.schemas import (
    ReviewAttemptCreate,
    ReviewAttemptResponse,
    ReviewEligibilityResponse,
    ReviewSessionCreate,
    ReviewSessionResponse,
)
from app.reviews.service import (
    get_or_create_review_session,
    record_review_attempt,
)

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/eligible-items", response_model=ReviewEligibilityResponse)
def eligible_review_items(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    lesson_id: uuid.UUID,
    content_release_id: uuid.UUID | None = None,
) -> ReviewEligibilityResponse:
    return get_review_eligibility(db, current_user.id, lesson_id, content_release_id)


@router.post("/sessions", response_model=ReviewSessionResponse)
def create_review_session(
    session_in: ReviewSessionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ReviewSessionResponse:
    session = get_or_create_review_session(
        db, current_user.id, session_in.client_session_id
    )
    return ReviewSessionResponse(
        id=session.id,
        client_session_id=session.client_session_id,
        created_at=session.created_at,
    )


@router.post("/attempts", response_model=ReviewAttemptResponse)
def submit_review_attempt(
    attempt_in: ReviewAttemptCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ReviewAttemptResponse:
    attempt, schedule = record_review_attempt(
        db=db,
        user=current_user,
        attempt_in=attempt_in,
    )
    return ReviewAttemptResponse(
        id=attempt.id,
        client_event_id=attempt.client_event_id,
        session_id=attempt.session_id,
        vocabulary_item_id=attempt.vocabulary_item_id,
        content_revision_id=attempt.content_revision_id,
        content_release_id=attempt.content_release_id,
        correct=attempt.correct,
        response_time_ms=attempt.response_time_ms,
        timing_evidence=attempt.timing_evidence,
        scheduler_type=attempt.scheduler_type,
        algorithm_version=attempt.algorithm_version,
        next_interval_seconds=schedule.interval_seconds,
        next_due_at=schedule.due_at,
        server_acceptance_at=attempt.server_acceptance_at,
        scheduler_state=schedule.scheduler_state,
    )
