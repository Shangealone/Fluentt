from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class Send(Model):
    content: str = Field(min_length=1, max_length=4000, strict=True)

    @field_validator("content")
    @classmethod
    def plain_text(cls, value):
        if not value.strip() or "\x00" in value:
            raise ValueError("Enter 1–4,000 characters of plain text.")
        try:
            value.encode("utf-8")
        except UnicodeEncodeError:
            raise ValueError("Enter valid Unicode text.") from None
        return value


class Query(Model):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=100000)
    q: str = Field(default="", max_length=200)
    # Freeze a history page's upper bound while paging; newer sends require refresh.
    before: datetime | None = None

    @field_validator("before")
    @classmethod
    def aware(cls, value):
        if value and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("Use a timezone-aware timestamp.")
        return value


class Person(Model):
    id: UUID
    username: str


class Classroom(Model):
    id: UUID
    class_name: str


class Context(Model):
    classroom: Classroom
    instructor: Person
    viewer: Person
    peer: Person | None = None
    role: Literal["school_student", "instructor"]


class MessageView(Model):
    id: UUID
    class_id: UUID
    kind: Literal["direct", "announcement"]
    sender: Person
    recipient_id: UUID | None
    content: str
    sent_at: datetime
    read: bool


class Page[T](Model):
    items: list[T]
    limit: int
    offset: int
    has_more: bool
    as_of: datetime
