"""Strict structural authoring contracts; no executable lesson content or arbitrary JSON."""

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from typing_extensions import Annotated

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]
Code = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
]
Position = Annotated[int, Field(strict=True, ge=1, le=1000000)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class VersionFields(Strict):
    code: Code
    name: Name
    description: Description | None = None


class SubjectFields(Strict):
    code: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
    ]
    name: Name
    description: Description | None = None


class GradeFields(Strict):
    number: int = Field(strict=True, ge=1, le=12)


class SubjectLinkFields(Strict):
    subject_id: UUID


class QuarterFields(Strict):
    number: int = Field(strict=True, ge=1, le=4)
    name: Name


class OrderedFields(Strict):
    name: Name
    description: Description | None = None
    position: Position


class CompetencyFields(Strict):
    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)] | None = None
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
    position: Position


FIELDS = dict(
    zip(
        ["versions", "grades", "subjects", "quarters", "topics", "lessons", "competencies", "global-subjects"],
        [
            VersionFields,
            GradeFields,
            SubjectLinkFields,
            QuarterFields,
            OrderedFields,
            OrderedFields,
            CompetencyFields,
            SubjectFields,
        ],
        strict=True,
    )
)


class WriteRequest(Strict):
    values: dict[str, Any]
    parent_id: UUID | None = None
    target_revision: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")


class PublishRequest(Strict):
    confirmed: bool = Field(strict=True)
    source_reference: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    licensing_reference: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    review_note: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]

    @field_validator("confirmed")
    @classmethod
    def review_confirmed(cls, value):
        if not value:
            raise ValueError("Explicit review confirmation is required")
        return value


class ManageQuery(Strict):
    parent_id: UUID | None = None
    q: str = Field(default="", max_length=100)
    status: Literal["draft", "published", "archived"] | None = None
    limit: int = Field(default=25, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=100000)


class NodeView(Strict):
    id: UUID
    kind: str
    parent_id: UUID | None
    version_id: UUID | None
    revision: str
    frozen: bool
    values: dict[str, Any]


class ManagePage(Strict):
    items: list[NodeView]
    has_more: bool
    limit: int
    offset: int
