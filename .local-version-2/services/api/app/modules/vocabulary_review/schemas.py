from datetime import date
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, StrictInt, model_validator

Format = Literal["multiple_choice", "typed_recall"]
Rating = Literal["again", "hard", "good", "easy"]
Condition = Literal["fsrs6", "esr"]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True, allow_inf_nan=False)


class Option(Model):
    id: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    text: str = Field(min_length=1, max_length=300)


class CardDefinition(Model):
    vocabulary_item_id: UUID
    content_version: int = Field(ge=1)
    term: str = Field(min_length=1, max_length=200)
    meaning: str = Field(min_length=1, max_length=2000)
    typed_prompt: str = Field(min_length=1, max_length=2000)
    accepted_forms: list[str] = Field(min_length=1, max_length=20)
    choice_prompt: str = Field(min_length=1, max_length=2000)
    options: list[Option] = Field(min_length=2, max_length=8)
    correct_option_id: str

    @model_validator(mode="after")
    def valid_definition(self):
        from .policy import normalize_answer
        texts = [normalize_answer(row.text) for row in self.options]
        ids = [row.id for row in self.options]
        forms = [normalize_answer(value) for value in self.accepted_forms]
        if len(set(ids)) != len(ids) or len(set(texts)) != len(texts) or not all(texts):
            raise ValueError("Options need distinct IDs and distinct nonblank visible text.")
        if self.correct_option_id not in ids:
            raise ValueError("Choose one authored correct option.")
        if not all(forms) or any(len(value) > 200 for value in self.accepted_forms) or len(set(forms)) != len(forms):
            raise ValueError("Accepted forms must be distinct nonblank words or phrases of at most 200 characters.")
        if any(not value.strip() for value in (self.term, self.meaning, self.typed_prompt, self.choice_prompt)):
            raise ValueError("Vocabulary and prompts must not be blank.")
        return self


class HybridConfiguration(Model):
    reference_probability: float = Field(gt=0, lt=1)
    sensitivity: float = Field(gt=0, le=2)
    minimum_factor: float = Field(gt=0, le=1)
    maximum_factor: float = Field(ge=1, le=3)
    maximum_interval_days: int = Field(ge=1, le=36500)
    minimum_history: int = Field(ge=1, le=10000)
    timezone: str
    allowed_weekdays: list[Annotated[StrictInt, Field(ge=0, le=6)]] = Field(min_length=1, max_length=7)
    excluded_dates: list[date] = Field(default_factory=list, max_length=1000)
    desired_retention: float = Field(default=.9, gt=0, lt=1)

    @model_validator(mode="after")
    def calendar(self):
        try:
            ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError("Choose a supported IANA timezone.") from error
        if len(set(self.allowed_weekdays)) != len(self.allowed_weekdays):
            raise ValueError("Weekdays must be distinct.")
        return self


class PackInput(Model):
    lesson_id: UUID
    title: str = Field(min_length=1, max_length=200)
    language: Literal["english", "tagalog"]
    cards: list[CardDefinition] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def distinct_cards(self):
        from .policy import normalize_answer
        if len({row.vocabulary_item_id for row in self.cards}) != len(self.cards):
            raise ValueError("Each vocabulary item must occur once per pool.")
        if len({normalize_answer(row.term) for row in self.cards}) != len(self.cards):
            raise ValueError("Each pool must contain distinct vocabulary terms.")
        if not self.title.strip():
            raise ValueError("Enter a pool title.")
        return self


class ProtocolInput(Model):
    title: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    protocol_version: str = Field(min_length=1, max_length=80)
    class_id: UUID
    pack_a_id: UUID
    pack_b_id: UUID
    target_participants: int = Field(ge=2, le=1000)
    settings: HybridConfiguration
    required_consent_kinds: list[Literal["consent", "guardian_consent", "assent"]] = Field(min_length=1, max_length=3)
    model_artifact_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")

    @model_validator(mode="after")
    def valid_protocol(self):
        if not self.title.strip() or not self.protocol_version.strip():
            raise ValueError("Enter a study title and protocol version.")
        if len(set(self.required_consent_kinds)) != len(self.required_consent_kinds):
            raise ValueError("Participation permission kinds must be distinct.")
        return self


class AllocationInput(Model):
    participant_id: UUID
    confirm: Literal[True]


class StateInput(Model):
    status: Literal["active", "paused", "completed"]
    confirm: Literal[True]


class AnswerInput(Model):
    response: str = Field(min_length=1, max_length=2000)


class RatingInput(Model):
    rating: Rating
