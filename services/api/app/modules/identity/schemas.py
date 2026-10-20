from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.usernames import validate_new_username

MobileRole = Literal["personal_student", "school_student", "instructor"]
MOBILE_ROLES = frozenset({"personal_student", "school_student", "instructor"})
LearningExperience = Literal["starting_fresh", "some_words", "simple_conversations", "comfortable"]


class CreateUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    username: str = Field(
        strict=True,
        min_length=3,
        max_length=24,
        description="ASCII letters, digits, underscores and internal spaces; no surrounding whitespace.",
    )
    role: MobileRole
    password: str | None = Field(
        default=None,
        min_length=6,
        max_length=128,
        description="Optional password (minimum 6 characters) to protect the account.",
    )

    @field_validator("username")
    @classmethod
    def username_policy(cls, value: str) -> str:
        validate_new_username(value)
        return value


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    username: str = Field(
        strict=True,
        min_length=1,
        max_length=128,
        description="Account username",
    )
    password: str = Field(
        strict=True,
        min_length=1,
        max_length=128,
        description="Account password",
    )


class UsernameAvailability(BaseModel):
    username: str
    available: bool
    message: str


class LearningFocus(BaseModel):
    """Learner-written requests, not delivered curriculum or inferred proficiency."""

    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    topics: list[str] = Field(default_factory=list, max_length=10)
    lessons: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("topics", "lessons")
    @classmethod
    def bounded_labels(cls, values):
        cleaned = [value.strip() for value in values]
        if any(not value or len(value) > 120 for value in cleaned) or len(set(cleaned)) != len(cleaned):
            raise ValueError("Use distinct nonblank requests of at most 120 characters.")
        return cleaned

    @model_validator(mode="after")
    def has_focus(self):
        if not self.topics and not self.lessons:
            raise ValueError("Enter at least one topic or lesson request.")
        return self


class MobileProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    username: str
    canonical_username: str
    role: MobileRole
    profile_status: Literal["onboarding", "active"]
    onboarding_step: str | None
    created_at: datetime
    updated_at: datetime
    grade: int | None = None
    language: Literal["english", "tagalog"] | None = None
    learning_focus: LearningFocus | None = None
    experience: LearningExperience | None = None


class IssuedSession(BaseModel):
    credential: str = Field(repr=False)
    token_type: Literal["Bearer"] = "Bearer"
    expires_at: datetime
    absolute_expires_at: datetime


class CreatedUser(BaseModel):
    user: MobileProfile
    session: IssuedSession


class PreferenceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    grade: int | None = Field(default=None, strict=True, ge=1, le=12)
    language: Literal["english", "tagalog"] | None = None
    learning_focus: LearningFocus | None = None
    experience: LearningExperience | None = None

    @field_validator("grade", "language", "learning_focus", "experience")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("A supplied preference cannot be null.")
        return value
