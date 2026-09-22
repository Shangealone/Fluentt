from pydantic import BaseModel

from app.reviews.schemas import ReviewAttemptCreate, ReviewAttemptResponse


class SyncReviewEventsRequest(BaseModel):
    events: list[ReviewAttemptCreate]


class SyncReviewEventsResponse(BaseModel):
    accepted_events: list[ReviewAttemptResponse]
