from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator
from app.modules.assignments.schemas import Context


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class Query(Model):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=100000)


class HistoryQuery(Query):
    class_id: UUID | None = None
    status: Literal["all", "not_started", "in_progress", "submitted"] = "all"
    since: AwareDatetime | None = None
    before: AwareDatetime | None = None

    @model_validator(mode="after")
    def valid_window(self):
        if self.since and self.before and self.since >= self.before:
            raise ValueError("The date range must have a start before its end")
        return self


class Counts(Model):
    available: int
    not_started: int
    in_progress: int
    submitted: int
    pending: int


class Summary(Model):
    availability: Literal["available", "unavailable"]
    as_of: datetime
    class_id: UUID | None
    class_name: str | None
    class_count: int | None
    counts: Counts | None
    policy_version: Literal["submission-counts-v1"] = "submission-counts-v1"


class ClassOption(Model):
    id: UUID
    class_name: str
    grade: int
    language: Literal["english", "tagalog"]


class Classes(Model):
    items: list[ClassOption]
    limit: int
    offset: int
    has_more: bool


class HistoryItem(Model):
    id: UUID
    version_id: UUID
    class_id: UUID
    class_name: str
    language: Literal["english", "tagalog"]
    title: str
    context: Context
    submission_status: Literal["not_started", "in_progress", "submitted"]
    result_state: Literal[
        "not_submitted", "submitted", "awaiting_manual_review", "withheld", "released", "not_applicable"
    ]
    attempt_id: UUID | None
    published_at: datetime
    started_at: datetime | None
    last_activity_at: datetime | None
    submitted_at: datetime | None
    sort_at: datetime
    released_run_id: UUID | None
    policy_version: str | None
    earned_points: Decimal | None
    possible_points: Decimal | None


class History(Model):
    availability: Literal["available", "unavailable"]
    as_of: datetime
    items: list[HistoryItem]
    limit: int
    offset: int
    has_more: bool
