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
    lesson_id: uuid.UUID
    term: str
    definition: str
    example_sentence: str
    difficulty: str
    category: str | None = None
    translation: str | None = None
    content_version: str
    sort_order: int


class LessonSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    language_code: str
    title: str
    description: str | None = None
    content_version: str
    sort_order: int
    item_count: int = 0


class LessonDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    language_code: str
    title: str
    description: str | None = None
    content_version: str
    sort_order: int
    vocabulary_items: list[VocabularyItemResponse]
