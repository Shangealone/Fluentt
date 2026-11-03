import json
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.modules.questions.schemas import Method
from app.schemas.question_config import validate_definition, validate_prompt


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


def clean(value):
    if isinstance(value, str):
        if "\x00" in value:
            raise ValueError("Text cannot contain NUL characters")
        try:
            value.encode("utf-8")
        except UnicodeEncodeError as exc:
            raise ValueError("Text must be valid Unicode") from exc
        return value.strip()
    return value


class Section(Model):
    heading: str = Field(min_length=1, max_length=200, strict=True)
    body: str = Field(min_length=1, max_length=20000, strict=True)
    _text = field_validator("heading", "body", mode="before")(clean)


class QuestionInput(Model):
    method: Method
    prompt: str = Field(min_length=1, max_length=8000, strict=True)
    instructions: str | None = Field(default=None, max_length=8000, strict=True)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    content: dict
    answer_key: dict
    _text = field_validator("prompt", "instructions", mode="before")(clean)

    @model_validator(mode="after")
    def valid_question(self):
        try:
            encoded = json.dumps(self.model_dump(), ensure_ascii=False).encode("utf-8")
        except UnicodeEncodeError as exc:
            raise ValueError("Question must contain valid Unicode") from exc
        if len(encoded) > 65536 or b"\\u0000" in encoded:
            raise ValueError("Question is too large or contains unsupported characters")
        validate_definition(self.method, self.content, self.answer_key)
        validate_prompt(self.method, self.content, self.prompt)
        return self


class LessonInput(Model):
    title: str = Field(min_length=1, max_length=200, strict=True)
    introduction: str | None = Field(default=None, max_length=8000, strict=True)
    grade: int = Field(ge=1, le=12, strict=True)
    language: Literal["english", "tagalog"]
    subject_id: UUID
    sections: list[Section] = Field(default_factory=list, max_length=50)
    questions: list[QuestionInput] = Field(default_factory=list, max_length=200)
    _text = field_validator("title", "introduction", mode="before")(clean)

    @model_validator(mode="after")
    def budget(self):
        if len(json.dumps(self.model_dump(mode="json"), ensure_ascii=False).encode("utf-8")) > 1048576:
            raise ValueError("Lesson exceeds the 1 MiB request budget")
        return self


class Command(Model):
    action: Literal["save", "publish", "new_version", "archive", "share", "unshare"]
    version_id: UUID
    draft: LessonInput | None = None
    class_ids: list[UUID] = Field(default_factory=list, max_length=100)
    confirm: bool = Field(default=False, strict=True)
    bind_subject: bool = Field(default=False, strict=True)

    @model_validator(mode="after")
    def valid_command(self):
        if (self.action == "save") != (self.draft is not None):
            raise ValueError("Saving requires the exact draft body")
        if len(set(self.class_ids)) != len(self.class_ids):
            raise ValueError("Select each class once")
        if self.action in {"share", "unshare"}:
            if not self.class_ids:
                raise ValueError("Choose at least one class")
        elif self.class_ids or self.bind_subject:
            raise ValueError("Class choices apply only to sharing")
        if self.action != "save" and not self.confirm:
            raise ValueError("Explicit confirmation is required")
        return self
