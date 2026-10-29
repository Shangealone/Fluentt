"""Configuration contracts only; no participant capture or treatment execution."""

import json
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator, StrictInt
from .reporting_schemas import ReportingReadiness

StudyState = Literal["DRAFT", "READY", "ACTIVE", "PAUSED", "COMPLETED"]
Condition = Literal["sm2_control", "esr_experimental"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class PolicyReference(Contract):
    version: str = Field(min_length=1, max_length=80)
    reference: str = Field(min_length=1, max_length=500)
    parameters: dict = Field(default_factory=dict)


class ConditionReference(Contract):
    condition: Condition
    scheduler_configuration_id: UUID


class AssessmentReference(Contract):
    assessment_id: UUID
    instrument_version: str = Field(min_length=1, max_length=80)
    opens_at: AwareDatetime | None = None
    closes_at: AwareDatetime | None = None
    timer_limit_seconds: StrictInt | None = Field(default=None, gt=0, le=2147483647)

    @model_validator(mode="after")
    def ordered(self):
        if self.opens_at and self.closes_at and self.opens_at >= self.closes_at:
            raise ValueError("Assessment closes_at must follow opens_at")
        return self


class SetupWindow(Contract):
    opens_at: AwareDatetime
    closes_at: AwareDatetime

    @model_validator(mode="after")
    def ordered(self):
        if self.opens_at >= self.closes_at:
            raise ValueError("Window end must follow its start")
        return self


class DailyAvailability(Contract):
    opens: str = Field(pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")
    closes: str = Field(pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")

    @model_validator(mode="after")
    def ordered(self):
        if self.opens >= self.closes:
            raise ValueError("Daily availability must be a same-day ordered window")
        return self


class AdministratorSetup(Contract):
    # Proposals only: no execution, default methodology or approval semantics.
    proposed_intervention_weeks: StrictInt | None = Field(default=None, gt=0, le=520)
    daily_availability: DailyAvailability | None = None
    phase_windows: dict[
        Literal["pre_test", "intervention", "post_test", "delayed_follow_up", "questionnaire"], SetupWindow
    ] = Field(default_factory=dict)
    review_policy: PolicyReference | None = None
    assessment_attempt_limit: StrictInt | None = Field(default=None, gt=0, le=2147483647)


AssessmentStage = Literal["pre_test", "immediate_post_test", "delayed_retention_test"]


class AssessmentStageDraft(Contract):
    # A reference to config.assessments, never copied questions, responses or keys.
    assessment_id: UUID | None = None
    maximum_attempts: StrictInt | None = Field(default=None, gt=0, le=2147483647)
    timeout_policy: PolicyReference | None = None
    feedback_policy: PolicyReference | None = None


class DelayedFollowUpDraft(Contract):
    policy: PolicyReference
    anchor: Literal["immediate_post_test_completion"]
    minimum_delay_seconds: StrictInt = Field(gt=0, le=2147483647)


class AssessmentDeliveryDraft(Contract):
    version: str = Field(min_length=1, max_length=80, pattern=r".*\S.*")
    # One shared plan for all conditions; no per-group content/difficulty/scoring overrides.
    blueprint_policy: PolicyReference | None = None
    difficulty_policy: PolicyReference | None = None
    scoring_policy: PolicyReference | None = None
    stages: dict[AssessmentStage, AssessmentStageDraft] = Field(default_factory=dict)
    delayed_follow_up: DelayedFollowUpDraft | None = None


class AssessmentPublication(Contract):
    status: Literal["BLOCKED"] = "BLOCKED"
    execution_available: Literal[False] = False
    blockers: list[str] = Field(default_factory=lambda: ["assessment_execution_workflow_unavailable"])


class ProtocolConfiguration(Contract):
    assessment_delivery_draft: AssessmentDeliveryDraft | None = None
    administrator_setup: AdministratorSetup | None = None
    protocol_reference: str | None = Field(default=None, min_length=1, max_length=500)
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=100)
    active_weekdays: list[StrictInt] | None = Field(default=None, min_length=1, max_length=7)
    due_date_policy: PolicyReference | None = None
    consent_document_version: str | None = Field(default=None, min_length=1, max_length=80)
    consent_requirements: list[Literal["consent", "guardian_consent", "assent"]] | None = Field(
        default=None, min_length=1, max_length=3
    )
    allocation_unit: Literal["participant", "classroom"] | None = None
    allocation_policy: PolicyReference | None = None
    conditions: list[ConditionReference] = Field(default_factory=list, max_length=10)
    assessments: list[AssessmentReference] = Field(default_factory=list, max_length=100)
    declared_evidence: dict[Literal["protocol", "ethics", "site_permission", "instruments", "conditions"], str] = Field(
        default_factory=dict
    )

    @field_validator("timezone")
    @classmethod
    def timezone_exists(cls, value):
        if value:
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError) as error:
                raise ValueError("Use a recognized IANA timezone") from error
        return value

    @field_validator("active_weekdays")
    @classmethod
    def weekdays(cls, values):
        if values is not None and (
            any(type(value) is not int or value < 1 or value > 7 for value in values) or len(set(values)) != len(values)
        ):
            raise ValueError("Use distinct ISO weekdays 1 (Monday) through 7 (Sunday)")
        return sorted(values) if values is not None else None

    @model_validator(mode="after")
    def consistent(self):
        if self.starts_at and self.ends_at and self.starts_at >= self.ends_at:
            raise ValueError("Study ends_at must follow starts_at")
        if self.administrator_setup:
            for window in self.administrator_setup.phase_windows.values():
                if (self.starts_at and window.opens_at < self.starts_at) or (
                    self.ends_at and window.closes_at > self.ends_at
                ):
                    raise ValueError("Phase windows must fit inside configured study dates")
        for assessment in self.assessments:
            for value in (assessment.opens_at, assessment.closes_at):
                if value and ((self.starts_at and value < self.starts_at) or (self.ends_at and value > self.ends_at)):
                    raise ValueError("Assessment windows must fit inside configured study dates")
        if self.assessment_delivery_draft:
            available = {item.assessment_id for item in self.assessments}
            references = [
                stage.assessment_id
                for stage in self.assessment_delivery_draft.stages.values()
                if stage.assessment_id is not None
            ]
            if len(references) != len(set(references)):
                raise ValueError("Each assessment stage needs a distinct instrument reference")
            if any(value not in available for value in references):
                raise ValueError("Stage instruments must reference this protocol's exact assessment list")
        for values in (
            [item.assessment_id for item in self.assessments],
            [item.condition for item in self.conditions],
            self.consent_requirements or [],
        ):
            if len(values) != len(set(values)):
                raise ValueError("Duplicate references are not allowed")
        data = self.model_dump(mode="json")
        if len(json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")) > 65536:
            raise ValueError("Configuration exceeds 64 KiB")
        if any(not value.strip() or len(value) > 500 for value in self.declared_evidence.values()):
            raise ValueError("Evidence references must contain 1–500 characters")
        return self


class CreateClassroomStudy(Contract):
    code: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$")
    title: str = Field(min_length=1, max_length=200)
    language: Literal["english", "tagalog"]
    protocol_version: str = Field(min_length=1, max_length=80)
    target_participants: StrictInt = Field(gt=0, le=2147483647)  # Explicit proposal, never a default/approved quota.
    configuration: ProtocolConfiguration = Field(default_factory=ProtocolConfiguration)


class BindClassroom(Contract):
    class_id: UUID


class TransitionStudy(Contract):
    status: StudyState


class StudyOverview(Contract):
    id: UUID
    study_id: UUID
    code: str
    title: str
    language: str
    protocol_version: str
    target_participants: int
    status: StudyState
    revision: str
    protocol_id: UUID
    configuration_version: int
    configuration_fingerprint: str
    configuration: ProtocolConfiguration
    activation_blockers: list[str]
    assessment_publication: AssessmentPublication = Field(default_factory=AssessmentPublication)
    reporting: ReportingReadiness = Field(default_factory=ReportingReadiness)


class StudyPage(Contract):
    items: list[StudyOverview]
    offset: int
    limit: int
    has_more: bool


class BindingOverview(Contract):
    id: UUID
    study_id: UUID
    scope_id: UUID
    class_id: UUID


class BindingPage(Contract):
    items: list[BindingOverview]
    offset: int
    limit: int
    has_more: bool


class ClassMode(Contract):
    class_id: UUID
    mode: Literal["normal", "research"]
    studies: list[dict]
    offset: int
    limit: int
    has_more: bool
    execution_available: Literal[False] = False  # No assessment/treatment delivery in Prompt 02.
