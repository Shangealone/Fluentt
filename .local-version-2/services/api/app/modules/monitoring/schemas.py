from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.modules.progress.schemas import Counts, HistoryItem
from app.modules.assignments.schemas import Context


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class Query(Model):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=100000)
    q: str = Field(default="", max_length=200)
    lesson_id: UUID | None = None
    curriculum_version_id: UUID | None = None
    status: Literal["all", "not_started", "in_progress", "submitted"] = "all"
    kind: Literal["lesson", "edition"] = "lesson"


class Classroom(Model):
    id: UUID
    class_name: str
    grade: int
    language: Literal["english", "tagalog"]


class Results(Model):
    awaiting_evaluation: int = 0
    awaiting_manual_review: int = 0
    withheld: int = 0
    released: int = 0
    not_applicable: int = 0


class Overview(Model):
    classroom: Classroom
    as_of: datetime
    available_assignments: int
    eligible_students: int
    counts: Counts
    results: Results
    progress_policy: Literal["submission-counts-v1"] = "submission-counts-v1"


class Student(Model):
    id: UUID
    username: str
    counts: Counts
    results: Results


class Mean(Model):
    status: Literal["available", "unavailable", "not_comparable"]
    eligible_results: int
    mean_points: Decimal | None = None
    max_points: Decimal | None = None
    engine_version: str | None = None
    policy_version: str | None = None
    mean_policy: Literal["released-assignment-mean-v1"] = "released-assignment-mean-v1"


class Assignment(Model):
    id: UUID
    version_id: UUID
    title: str
    context: Context
    published_at: datetime
    counts: Counts
    results: Results
    mean: Mean


class ContextOption(Model):
    id: UUID
    label: str


class Page[T](Model):
    items: list[T]
    limit: int
    offset: int
    has_more: bool


class StudentDetail(Page[HistoryItem]):
    summary: Student
    overview: Overview


class StudentOutcome(Model):
    id: UUID
    username: str
    submission_status: Literal["not_started", "in_progress", "submitted"]
    result_state: Literal[
        "not_submitted", "submitted", "awaiting_manual_review", "withheld", "released", "not_applicable"
    ]
    attempt_id: UUID | None
    submitted_at: datetime | None
    released_run_id: UUID | None
    earned_points: Decimal | None
    possible_points: Decimal | None


class AssignmentDetail(Page[StudentOutcome]):
    summary: Assignment
    overview: Overview
