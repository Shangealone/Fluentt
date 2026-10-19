from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CodeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    code: str = Field(strict=True, min_length=6, max_length=6, pattern=r"^[0-9]{6}$")


class Confirmation(CodeRequest):
    class_version: str = Field(strict=True, min_length=64, max_length=64, pattern=r"^[0-9a-f]{64}$")


class StudentClass(BaseModel):
    class_name: str
    grade_level: int
    language: Literal["english", "tagalog"]
    instructor_display_name: str | None


class ClassPreview(StudentClass):
    class_version: str


class MembershipDetails(StudentClass):
    id: UUID
    class_id: UUID
    joined_at: datetime
    status: Literal["active"] = "active"
