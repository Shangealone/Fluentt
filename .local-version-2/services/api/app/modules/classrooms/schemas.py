from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator

Language = Literal["english", "tagalog"]


class ClassCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    class_name: str = Field(strict=True, min_length=1, max_length=150)
    grade_level: int = Field(strict=True, ge=1, le=12)
    language: Language
    description: str | None = Field(default=None, strict=True, max_length=500)

    @field_validator("class_name", "description", mode="before")
    @classmethod
    def trim_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if any(ord(char) < 32 and char not in "\n\t" for char in value):
                raise ValueError("Text contains unsupported control characters.")
            return value
        return value


class ClassUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    class_name: str | None = Field(default=None, strict=True, min_length=1, max_length=150)
    grade_level: int | None = Field(default=None, strict=True, ge=1, le=12)
    language: Language | None = None
    description: str | None = Field(default=None, strict=True, max_length=500)

    @field_validator("class_name", "description", mode="before")
    @classmethod
    def trim_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if any(ord(char) < 32 and char not in "\n\t" for char in value):
                raise ValueError("Text contains unsupported control characters.")
        return value

    @field_validator("class_name", "grade_level", "language")
    @classmethod
    def non_null(cls, value):
        if value is None:
            raise ValueError("Supplied required class fields cannot be null.")
        return value


class ClassDetails(BaseModel):
    id: UUID
    class_name: str
    grade_level: int
    language: Language
    description: str | None
    join_code: str | None = Field(pattern=r"^[0-9]{6}$")
    status: Literal["active", "archived"]
    created_at: datetime
    updated_at: datetime
