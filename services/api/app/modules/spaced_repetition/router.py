from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Request

from app.modules.classrooms.router import Credential, Repo
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.identity.session_service import authenticated_session
from app.modules.spaced_repetition.registry import registry
from app.modules.spaced_repetition.schemas import (
    ReviewEventInput,
    DueReviewBatch,
)
from app.modules.spaced_repetition.service import (
    record_review_event,
    get_due_reviews,
)

router = APIRouter(
    prefix="/me/reviews",
    tags=["spaced repetition"],
    dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)],
)


@router.get("/algorithms")
def list_algorithms(request: Request, credential: Credential, repo: Repo):
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return {
            "available_algorithms": registry.list_available(),
            "policy": "spaced-repetition-foundation-v1",
        }


@router.get("/due", response_model=DueReviewBatch)
def due_reviews(
    request: Request,
    credential: Credential,
    repo: Repo,
    algorithm: str = "sm2",
    context_type: str = "self_study",
    class_id: UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_due_reviews(
            repo.session,
            user,
            algorithm_name=algorithm,
            context_type=context_type,
            class_id=class_id,
            limit=limit,
        )


@router.post("/events")
def submit_review_event(
    event: ReviewEventInput,
    request: Request,
    credential: Credential,
    repo: Repo,
    algorithm: str = "sm2",
):
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return record_review_event(repo.session, user, event, algorithm_name=algorithm)
