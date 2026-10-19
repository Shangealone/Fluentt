from uuid import UUID
from typing import Literal, Generic, TypeVar
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.modules.questions.schemas import Preview, Method


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class DraftInput(Model):
    lesson_id: UUID
    title: str = Field(strict=True, min_length=1, max_length=200)
    instructions: str | None = Field(default=None, strict=True, max_length=8000)
    question_revision_ids: list[UUID] = Field(max_length=200)

    @field_validator("title", "instructions", mode="before")
    @classmethod
    def trim(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("question_revision_ids")
    @classmethod
    def unique(cls, value):
        if len(set(value)) != len(value):
            raise ValueError("Duplicate question revisions are not permitted")
        return value


class Query(Model):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=100000)
    q: str = Field(default="", max_length=200)
    method: Method | None = None


class Item(Model):
    id: UUID
    question_id: UUID
    version: int
    definition: Preview
    eligible: bool


class Context(Model):
    lesson_id: UUID
    lesson_name: str
    curriculum_version_id: UUID
    curriculum_name: str
    grade: int
    subject_id: UUID
    subject_name: str


class DraftView(Model):
    id: UUID
    class_id: UUID
    version_id: UUID
    status: Literal["draft", "archived", "published"]
    revision: str
    title: str
    instructions: str | None
    context: Context
    questions: list[Item]
    eligible: bool
    editable: bool
    requires_subject: bool


class DraftSummary(Model):
    id: UUID
    class_id: UUID
    status: Literal["draft", "archived", "published"]
    title: str
    context: Context
    question_count: int


class PublishInput(Model):
    confirm: Literal[True]
    bind_subject_id: UUID | None = None

    @field_validator("confirm", mode="before")
    @classmethod
    def deliberate_confirmation(cls, value):
        if value is not True:
            raise ValueError("Explicit publication confirmation required")
        return value


class PublishedView(Model):
    id: UUID
    class_id: UUID
    version_id: UUID
    title: str
    instructions: str | None
    context: Context
    published_at: str
    question_count: int
    methods: list[Method]
    status: Literal["published"] = "published"


T = TypeVar("T")


class Page(Model, Generic[T]):
    items: list[T]
    has_more: bool
    offset: int
    limit: int
