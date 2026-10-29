from uuid import UUID
from typing import Literal
from pydantic import Field, field_validator
from app.modules.assignments.schemas import Model, Item


class ResponseInput(Model):
    assignment_question_id: UUID
    answer: dict


class ProgressInput(Model):
    position: int = Field(strict=True, ge=1, le=200)
    responses: list[ResponseInput] = Field(max_length=200)


class SubmitInput(ProgressInput):
    confirm: Literal[True]

    @field_validator("confirm", mode="before")
    @classmethod
    def deliberate(cls, value):
        if value is not True:
            raise ValueError("Explicit submission confirmation required")
        return value


class CaptureItem(Item):
    assignment_question_id: UUID


class AttemptView(Model):
    id: UUID
    assignment_id: UUID
    class_id: UUID
    version_id: UUID
    title: str
    instructions: str | None
    status: Literal["in_progress", "submitted"]
    revision: str
    started_at: str
    submitted_at: str | None
    position: int
    question_count: int
    completed_count: int
    questions: list[CaptureItem]
    responses: list[ResponseInput]
    revealed_item_ids: list[UUID]


class BackView(Model):
    revision_id: UUID
    back: str
    attempt_revision: str
