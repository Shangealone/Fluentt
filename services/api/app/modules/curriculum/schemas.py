from datetime import datetime
from typing import Generic, Literal, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Status = Literal["draft", "published", "archived"]
T = TypeVar("T")


class BrowseQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=100000)
    grade: int | None = Field(default=None, ge=1, le=12)
    subject_id: UUID | None = None
    class_id: UUID | None = None
    status: Status | None = Field(default=None, description="Admin-only filter on versions, topics and lessons")


class ClassContext(BaseModel):
    class_id: UUID
    grade_level_id: UUID
    subject_id: UUID | None
    language: Literal["english", "tagalog"]
    requires_subject: bool


class Page(BaseModel, Generic[T]):
    items: list[T]
    limit: int
    offset: int
    has_more: bool
    class_context: ClassContext | None = None


class VersionView(BaseModel):
    id: UUID
    code: str
    name: str
    description: str | None
    status: Status
    verification_status: Literal["unverified", "verified"]
    published_at: datetime | None


class GradeView(BaseModel):
    id: UUID
    curriculum_version_id: UUID
    grade_level_id: UUID
    number: int
    name: str


class SubjectView(BaseModel):
    id: UUID
    curriculum_grade_id: UUID
    subject_id: UUID
    code: str
    name: str
    description: str | None


class QuarterView(BaseModel):
    id: UUID
    curriculum_subject_id: UUID
    number: int
    name: str


class TopicView(BaseModel):
    id: UUID
    quarter_id: UUID
    name: str
    description: str | None
    position: int
    status: Status


class LessonView(BaseModel):
    id: UUID
    topic_id: UUID
    name: str
    description: str | None
    position: int
    status: Status


class CompetencyView(BaseModel):
    id: UUID
    lesson_id: UUID
    code: str | None
    description: str
    position: int
