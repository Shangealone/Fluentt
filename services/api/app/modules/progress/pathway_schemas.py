from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class CurrentMilestone(Model):
    kind: Literal["lesson", "assignment"]
    id: UUID
    title: str
    completed_at: datetime
    class_id: UUID | None = None
    topic_name: str | None = None


class PrerequisiteStatus(Model):
    total_required: int
    fulfilled: int
    all_met: bool


class EligibleActivity(Model):
    activity_type: Literal["lesson", "assignment", "flashcard_practice"]
    id: UUID
    title: str
    topic_name: str | None = None
    position: int
    prerequisites: PrerequisiteStatus
    is_required: bool
    status: Literal["available", "in_progress", "completed", "locked"]
    class_id: UUID | None = None
    lesson_id: UUID | None = None


class Recommendation(Model):
    id: str
    recommendation_type: Literal["next_lesson", "classroom_assignment", "self_study_practice", "review_lesson"]
    title: str
    reason: str
    target_id: UUID
    is_required: bool
    class_id: UUID | None = None


class CurrentPosition(Model):
    curriculum_version_id: UUID | None = None
    curriculum_version_name: str | None = None
    grade_number: int | None = None
    subject_id: UUID | None = None
    subject_name: str | None = None
    topic_id: UUID | None = None
    topic_name: str | None = None
    lesson_id: UUID | None = None
    lesson_name: str | None = None
    position_index: int = 0
    total_lessons_in_topic: int = 0


class Pathway(Model):
    availability: Literal["available", "empty", "unavailable"]
    as_of: datetime
    policy_version: Literal["deterministic-curriculum-v1"] = "deterministic-curriculum-v1"
    student_role: Literal["school_student", "personal_student"]
    class_id: UUID | None = None
    class_name: str | None = None
    current_position: CurrentPosition | None = None
    eligible_activities: list[EligibleActivity] = Field(default_factory=list)
    completed_milestones: list[CurrentMilestone] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)
