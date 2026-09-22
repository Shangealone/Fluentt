import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RecentActivityItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    attempt_id: uuid.UUID
    vocabulary_item_id: uuid.UUID
    term: str
    correct: bool
    performance_rating: str | None = None
    created_at: datetime


class LearnerProgressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_reviews: int
    unique_vocabulary_reviewed: int
    streak_days: int
    performance_breakdown: dict[str, int]
    recent_activity: list[RecentActivityItem]
