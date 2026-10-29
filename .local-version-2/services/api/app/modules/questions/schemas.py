"""Typed V1 contracts reuse the frozen method identifiers and storage semantics."""

import json
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, create_model, model_validator

from app.schemas.question_config import CONFIG_MODELS, RESPONSE_MODELS, validate_definition, validate_prompt

Method = Literal[
    "multiple_choice",
    "true_false",
    "identification",
    "fill_in_the_blank",
    "multiple_select",
    "flashcards",
    "error_identification",
    "word_arrangement",
    "sentence_arrangement",
    "matching_type",
]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8000, strict=True)]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class PublicFields(Model):
    lesson_id: UUID
    language: Literal["english", "tagalog"]
    prompt: Text
    instructions: Text | None = None
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    points: Decimal = Field(default=Decimal("1"), ge=0, max_digits=10, decimal_places=2, allow_inf_nan=False)
    schema_version: int = Field(default=1, strict=True, ge=1, le=1)


class AuthorFields(PublicFields):
    competency_ids: list[UUID] = Field(default_factory=list, max_length=200)
    grading_version: Literal["ungraded-v1"] = "ungraded-v1"
    explanation: Text | None = None

    @model_validator(mode="after")
    def valid_definition(self):
        if len(set(self.competency_ids)) != len(self.competency_ids):
            raise ValueError("Duplicate competency identifiers")
        validate_definition(self.method, self.content.model_dump(), self.answer_key.model_dump())
        validate_prompt(self.method, self.content.model_dump(), self.prompt)
        # An operational payload budget, not an educational item/lesson count policy.
        if len(json.dumps(self.model_dump(mode="json"), ensure_ascii=False).encode()) > 65536:
            raise ValueError("Definition exceeds 64 KiB")
        return self


AUTHOR_MODELS, PUBLIC_MODELS, ANSWER_MODELS = {}, {}, {}
for method, (content, key) in CONFIG_MODELS.items():
    name = "".join(word.title() for word in method.split("_"))
    PUBLIC_MODELS[method] = create_model(
        name + "Preview",
        __base__=PublicFields,
        method=(Literal[method], ...),
        content=(content, ...),
    )
    AUTHOR_MODELS[method] = create_model(
        name + "Definition",
        __base__=AuthorFields,
        method=(Literal[method], ...),
        content=(content, ...),
        answer_key=(key, ...),
    )
    ANSWER_MODELS[method] = create_model(
        name + "Response",
        __base__=Model,
        method=(Literal[method], ...),
        answer=(RESPONSE_MODELS[method], ...),
    )

Definition = Annotated[Union[tuple(AUTHOR_MODELS.values())], Field(discriminator="method")]
Preview = Annotated[Union[tuple(PUBLIC_MODELS.values())], Field(discriminator="method")]
# A future submission contract, not a response-submission endpoint or a correctness claim.
Response = Annotated[Union[tuple(ANSWER_MODELS.values())], Field(discriminator="method")]


class Query(Model):
    lesson_id: UUID | None = None
    method: Method | None = None
    language: Literal["english", "tagalog"] | None = None
    status: Literal["draft", "published", "archived"] | None = None
    q: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None
    offset: int = Field(default=0, ge=0, le=100000)
    limit: int = Field(default=20, ge=1, le=100)


class RevisionView(Model):
    id: UUID
    question_id: UUID
    version: int
    status: Literal["draft", "published", "archived"]  # Whole-item availability.
    locked_at: datetime | None
    revision: str  # Whole-item optimistic token; never a credential.
    competency_ids: list[UUID]
    definition: Preview


class KeyView(Model):
    id: UUID
    question_id: UUID
    version: int
    revision: str
    definition: Definition


class ItemView(Model):
    id: UUID
    author_id: UUID | None
    status: Literal["draft", "published", "archived"]
    archived_at: datetime | None
    revision: str
    latest_revision_id: UUID | None
    latest_version: int | None
    method: Method | None
    language: Literal["english", "tagalog"] | None
    prompt: str | None


class Page(Model):
    items: list[ItemView]
    offset: int
    limit: int
    has_more: bool


class RevisionPage(Model):
    items: list[RevisionView]
    offset: int
    limit: int
    has_more: bool
