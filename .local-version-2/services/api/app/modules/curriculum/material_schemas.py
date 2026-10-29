from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class MaterialView(Model):
    id: UUID
    lesson_id: UUID
    title: str
    description: str | None = None
    resource_type: Literal["reading", "reference_guide", "vocabulary_list", "activity_sheet", "audio_transcript"]
    content_text: str | None = None
    reference_url: str | None = None
    media_url: str | None = None
    is_required: bool = False
    source_metadata: dict = Field(default_factory=dict)


class MaterialPage(Model):
    items: list[MaterialView]
    lesson_id: UUID
    lesson_name: str
    total_count: int
    as_of: datetime


class NotificationItem(Model):
    id: UUID
    event_type: Literal["assignment_published", "class_announcement", "learning_material_available", "general"]
    title: str
    message: str
    related_resource_type: str | None = None
    related_resource_id: UUID | None = None
    read_at: datetime | None = None
    created_at: datetime


class NotificationPage(Model):
    items: list[NotificationItem]
    limit: int
    offset: int
    has_more: bool
    unread_count: int
    as_of: datetime
