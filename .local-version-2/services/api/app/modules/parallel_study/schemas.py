from datetime import date
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Draft(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    class_id: UUID
    pack_id: UUID
    title: str = Field(min_length=1, max_length=200)
    protocol_version: str = Field(min_length=1, max_length=80)
    start_date: date
    timezone: str = "Asia/Manila"
    posttest_date: date
    required_consent_kinds: list[Literal["consent", "guardian_consent", "assent"]] = Field(min_length=1, max_length=3)
    assessment_configuration: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_policy(self):
        from .policy import month_end
        ZoneInfo(self.timezone)
        if not self.title.strip() or not self.protocol_version.strip():
            raise ValueError("Nonblank title/version required")
        if self.posttest_date < month_end(self.start_date):
            raise ValueError("Posttest must not precede the intervention end")
        if len(set(self.required_consent_kinds)) != len(self.required_consent_kinds):
            raise ValueError("Consent kinds must be distinct")
        if self.assessment_configuration:
            raise ValueError("Assessment instruments/scoring need an approved versioned policy; leave unconfigured")
        return self


class AllocationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    participant_id: UUID
