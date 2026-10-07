import uuid

from pydantic import BaseModel, ConfigDict


class LanguageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    is_active: bool


class VocabularyItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content_revision_id: uuid.UUID | None = None
    content_release_id: uuid.UUID | None = None
    lesson_id: uuid.UUID
    term: str
    definition: str
    example_sentence: str
    difficulty: str
    category: str | None = None
    translation: str | None = None
    content_version: str
    sort_order: int
    is_active: bool


class LessonSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content_release_id: uuid.UUID | None = None
    language_code: str
    title: str
    description: str | None = None
    content_version: str
    sort_order: int
    item_count: int = 0
    is_active: bool


class LessonDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content_release_id: uuid.UUID | None = None
    language_code: str
    title: str
    description: str | None = None
    content_version: str
    sort_order: int
    vocabulary_items: list[VocabularyItemResponse]
    is_active: bool
