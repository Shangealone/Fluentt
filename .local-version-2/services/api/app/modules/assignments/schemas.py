from uuid import UUID
from typing import Literal, Generic, TypeVar
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.modules.questions.schemas import Preview, Method
from app.modules.teacher_lessons.schemas import QuestionInput


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


class InstructorQuestionPublication(Model):
    lesson_id: UUID
    question: QuestionInput
    confirm: bool = Field(strict=True)

    @field_validator("confirm")
    @classmethod
    def explicit_confirmation(cls, value):
        if not value:
            raise ValueError("Explicit question publication confirmation is required")
        return value


class Query(Model):
    source: Literal["curriculum"] | None = None
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
    curriculum_version_id: UUID | None
    curriculum_name: str | None
    source: Literal["curriculum", "teacher"] = "curriculum"
    lesson_version: int | None = None
    teacher_lesson_id: UUID | None = None
    grade: int | None
    proficiency_level: Literal["beginner", "intermediate", "advanced"] | None = None
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
