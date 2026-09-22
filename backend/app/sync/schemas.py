import uuid
from datetime import datetime

from pydantic import BaseModel

from app.reviews.schemas import ReviewAttemptCreate, ReviewAttemptResponse


class SyncReviewEventsRequest(BaseModel):
    events: list[ReviewAttemptCreate]


class SyncServerEventResult(BaseModel):
    client_event_id: uuid.UUID
    status: str = "accepted"
    attempt_id: uuid.UUID | None = None
    due_date: datetime | None = None
    error_detail: str | None = None


class SyncReviewEventsResponse(BaseModel):
    accepted_events: list[ReviewAttemptResponse]
    processed_count: int = 0
    results: list[SyncServerEventResult] = []
