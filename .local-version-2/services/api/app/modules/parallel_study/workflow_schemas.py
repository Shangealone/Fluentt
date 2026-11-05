"""Explicit synthetic policies, never approved scientific defaults."""
from datetime import date
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class WorkflowSetup(Input):
    pretest_date: date
    assessment_version: str = Field(min_length=1, max_length=80)
    assessment_format: Literal["multiple_choice", "typed_recall"]
    policy: Literal["development-objective-complete-v1"]
    approvals: dict[str, str] = Field(max_length=3)

    @model_validator(mode="after")
    def synthetic_evidence(self):
        if set(self.approvals) != {"protocol", "ethics", "site"} or any(
                not value.startswith("SYNTHETIC:") or not 11 <= len(value) <= 500 for value in self.approvals.values()):
            raise ValueError("All three explicitly SYNTHETIC: approval references are required for test workflows")
        return self


class Enrollment(Input):
    user_id: UUID
    eligibility_confirmed: Literal[True]
    consent_evidence: dict[str, str] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def synthetic_evidence(self):
        if any(not value.startswith("SYNTHETIC:") or not 11 <= len(value) <= 500 for value in self.consent_evidence.values()):
            raise ValueError("Only explicitly synthetic participation evidence may be used")
        return self


class Snapshot(Input):
    responses: dict[str, str] = Field(max_length=200)
    ratings: dict[str, Literal["again", "hard", "good", "easy"]] = Field(default_factory=dict, max_length=200)
    expected_revision: int = Field(ge=1)
    request_id: UUID

    @model_validator(mode="after")
    def bounded_text(self):
        if any(len(key) > 40 or len(value) > 2000 or "\x00" in value or any(0xD800 <= ord(c) <= 0xDFFF for c in value)
               for key, value in self.responses.items()):
            raise ValueError("Response text exceeds the declared Unicode contract")
        return self
