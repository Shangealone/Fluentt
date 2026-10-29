"""Pydantic schemas and DTOs for research participant lifecycle management and consent."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

StudyStatus = Literal["draft", "approved", "active", "completed", "archived"]
EnrollmentStatus = Literal["pending", "enrolled", "withdrawn", "completed"]
EligibilityStatus = Literal["pending", "eligible", "ineligible"]
ConsentKind = Literal["consent", "guardian_consent", "assent"]
ConsentStatus = Literal["granted", "withdrawn"]
WithdrawalReasonCategory = Literal[
    "voluntary_withdrawal",
    "scheduling_conflict",
    "privacy_concerns",
    "technical_issues",
    "administrative_removal",
    "other",
]

ETHICS_DISCLAIMER = (
    "NOTICE: Software consent recording captures technical participant affirmation under the specified protocol "
    "version and does NOT constitute independent Institutional Review Board (IRB) or Research Ethics Committee (REC) "
    "approval. Formal institutional ethics clearance must be obtained independently by the research institution."
)

RETENTION_POLICY_NOTICE = (
    "In accordance with research integrity standards and the approved thesis data retention policy (research-retention-v1), "
    "historical pre-withdrawal audit records, pseudonymized study events, and completed interactions are permanently "
    "retained in tamper-evident storage and are not destroyed upon participant withdrawal. Withdrawal strictly prevents "
    "any future research sessions or data collection."
)


class ResearchStudyDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    code: str
    title: str
    status: StudyStatus
    target_language: str
    protocol_version: str
    target_participants: int
    enrolled_count: int = 0
    withdrawn_count: int = 0
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    conditions: dict = Field(default_factory=dict)
    locked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AvailableStudiesResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    studies: list[ResearchStudyDTO]
    count: int
    ethics_disclaimer: str = ETHICS_DISCLAIMER


class ConsentDocumentDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    study_id: UUID
    study_code: str
    study_title: str
    target_language: str
    protocol_version: str
    consent_document_version: str
    purpose: str
    procedures: str
    voluntary_nature: str
    confidentiality_and_pseudonymization: str
    data_retention_policy: str
    withdrawal_rights: str
    ethics_statement: str
    required_affirmation: str
    retention_notice: str = RETENTION_POLICY_NOTICE


class ParticipantEligibilityDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    study_id: UUID
    study_code: str
    eligible: bool
    reasons: list[str]
    current_status: EnrollmentStatus | None = None
    target_language_match: bool
    recruitment_open: bool
    quota_available: bool
    protocol_version: str


class EnrollmentRequestDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    protocol_version: str = Field(..., min_length=1, max_length=80, description="Must match the active study protocol version")
    consent_kind: ConsentKind = Field(default="consent", description="Legal/procedural classification of consent")
    consent_decision: Literal["granted"] = Field(default="granted", description="Affirmative agreement required")
    affirmation_confirmed: bool = Field(..., description="Explicit checkbox/affirmation confirmation")
    evidence_summary: str | None = Field(default=None, max_length=500, description="Optional client evidence metadata")


class EnrollmentReceiptDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    participant_id: UUID
    participant_code: str
    study_id: UUID
    study_code: str
    protocol_version: str
    enrollment_status: EnrollmentStatus
    enrolled_at: datetime
    ethics_disclaimer: str = ETHICS_DISCLAIMER
    retention_notice: str = RETENTION_POLICY_NOTICE


class WithdrawalRequestDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason_category: WithdrawalReasonCategory = Field(default="voluntary_withdrawal")
    notes: str | None = Field(default=None, max_length=1000)


class WithdrawalReceiptDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    participant_id: UUID
    study_code: str
    enrollment_status: EnrollmentStatus
    withdrawn_at: datetime
    retention_notice: str = RETENTION_POLICY_NOTICE


class ParticipantStatusDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    participant_id: UUID
    participant_code: str
    study_id: UUID
    study_code: str
    study_title: str
    target_language: str
    protocol_version: str
    enrollment_status: EnrollmentStatus
    eligibility_status: EligibilityStatus
    enrolled_at: datetime | None = None
    withdrawn_at: datetime | None = None
    ethics_disclaimer: str = ETHICS_DISCLAIMER
    retention_notice: str = RETENTION_POLICY_NOTICE


class AdminParticipantViewDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    participant_id: UUID
    study_id: UUID
    study_code: str
    participant_code: str
    enrollment_status: EnrollmentStatus
    eligibility_status: EligibilityStatus
    enrolled_at: datetime | None = None
    withdrawn_at: datetime | None = None
    consent_kind: ConsentKind | None = None
    consent_status: ConsentStatus | None = None


class AdminIdentityRevealDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    participant_id: UUID
    participant_code: str
    study_id: UUID
    study_code: str
    user_id: UUID
    username: str
    canonical_username: str
    linked_at: datetime
    audit_warning: str = (
        "CONFIDENTIAL RESEARCH IDENTITY RECORD: Access to this identity mapping is strictly audited under "
        "permission 'research.manage'. Revealing this link is logged with high priority for research integrity oversight."
    )


class CreateStudyRequestDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(..., min_length=3, max_length=80)
    title: str = Field(..., min_length=3, max_length=200)
    target_language: Literal["english", "tagalog"]
    protocol_version: str = Field(..., min_length=1, max_length=80)
    target_participants: int = Field(default=30, gt=0, le=1000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    conditions: dict = Field(default_factory=dict)


# =========================================================================
# SECTION 37: CONTROLLED EXPERIMENT & ASSESSMENT SCHEMAS
# =========================================================================

ExperimentCondition = Literal["sm2_control", "esr_experimental"]
AssessmentKind = Literal["pre_test", "learning_level", "post_test", "delayed_retention", "pronunciation"]
AssessmentAttemptStatus = Literal["not_started", "in_progress", "completed", "invalidated"]


class BlindedExperimentStatusDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    study_id: UUID
    study_code: str
    study_title: str
    target_language: str
    protocol_version: str
    participant_id: UUID
    participant_code: str
    is_enrolled: bool
    is_allocated: bool
    is_withdrawn: bool
    condition_blinded: str = "standard_research_track"
    current_level_number: int = 1
    next_activity: str
    pre_test_completed: bool = False
    levels_completed: list[int] = Field(default_factory=list)
    post_test_completed: bool = False
    delayed_retention_completed: bool = False
    pronunciation_completed: bool = False
    ethics_disclaimer: str = ETHICS_DISCLAIMER


class AllocateParticipantRequestDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    participant_id: UUID | None = Field(default=None, description="Optional target participant ID for admin allocation")
    preferred_seed: int | None = Field(default=None, description="Optional seed for deterministic reproducibility in testing")


class GroupAllocationReceiptDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assignment_id: UUID
    participant_id: UUID
    participant_code: str
    study_id: UUID
    assignment_number: int
    assigned_at: datetime
    allocation_method: str
    condition_blinded: str = "standard_research_track"
    condition_unblinded: str | None = None
    reproducibility_seed: int | None = None
    target_group_size: int = 15
    ethics_disclaimer: str = ETHICS_DISCLAIMER


class AdminReassignGroupRequestDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    participant_id: UUID
    new_condition: ExperimentCondition
    deviation_reason: str = Field(..., min_length=10, max_length=1000, description="Mandatory protocol deviation justification")
    justification_notes: str | None = Field(default=None, max_length=1000)


class ResearchGroupSummaryDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    group_id: UUID
    study_id: UUID
    condition: ExperimentCondition
    target_size: int
    current_enrolled_count: int
    scheduler_algorithm: str
    scheduler_version: str


class ResearchLevelDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    study_id: UUID
    number: int
    title: str
    content_snapshot: dict = Field(default_factory=dict)
    locked_at: datetime | None = None


class ResearchAssessmentListItemDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assessment_id: UUID
    study_id: UUID
    kind: AssessmentKind
    level_id: UUID | None = None
    level_number: int | None = None
    title: str
    instrument_version: str
    time_limit_seconds: int | None = None
    total_points: float
    is_unlocked: bool
    attempt_status: AssessmentAttemptStatus
    score: float | None = None
    maximum_score: float | None = None
    completed_at: datetime | None = None


class ResearchAssessmentItemDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_id: str
    prompt: str
    item_type: Literal["multiple_choice", "identification", "true_false", "pronunciation_read"]
    options: list[str] | None = None
    points: float = 1.0
    audio_prompt_url: str | None = None


class ResearchAssessmentDetailDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assessment_id: UUID
    study_id: UUID
    kind: AssessmentKind
    instrument_version: str
    title: str
    instructions: str
    time_limit_seconds: int | None = None
    items: list[ResearchAssessmentItemDTO]
    total_points: float
    attempt_status: AssessmentAttemptStatus
    attempt_id: UUID | None = None


class StartAssessmentReceiptDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attempt_id: UUID
    assessment_id: UUID
    participant_id: UUID
    attempt_number: int
    started_at: datetime
    time_limit_seconds: int | None = None
    status: Literal["in_progress"] = "in_progress"


class SubmitAssessmentRequestDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attempt_id: UUID
    responses: dict[str, str] = Field(default_factory=dict, description="Map of item_id -> participant answer")
    response_duration_ms: int = Field(ge=0, le=7200000, description="Duration in milliseconds taken to complete")
    audio_submission_reference: str | None = Field(default=None, description="Optional audio file identifier for pronunciation assessments")


class SubmitAssessmentReceiptDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    result_id: UUID
    assessment_id: UUID
    participant_id: UUID
    participant_code: str
    attempt_number: int
    status: Literal["completed", "invalidated"]
    score: float
    maximum_score: float
    percentage: float
    response_duration_ms: int
    completed_at: datetime
    pronunciation_breakdown: dict | None = None


class AdminAssessmentResultRowDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    result_id: UUID
    study_id: UUID
    study_code: str
    assessment_id: UUID
    assessment_kind: AssessmentKind
    instrument_version: str
    participant_id: UUID
    participant_code: str
    condition: ExperimentCondition
    attempt_number: int
    status: str
    score: float | None = None
    maximum_score: float | None = None
    duration_ms: int | None = None
    started_at: datetime
    completed_at: datetime | None = None
    responses: dict = Field(default_factory=dict)


class CreateAssessmentInstrumentRequestDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: AssessmentKind
    level_id: UUID | None = None
    instrument_version: str = Field(..., min_length=1, max_length=80)
    title: str = Field(..., min_length=1, max_length=200)
    instructions: str = Field(..., min_length=1, max_length=2000)
    time_limit_seconds: int | None = Field(default=None, ge=30, le=7200)
    items: list[dict] = Field(..., min_length=1)
    conditions: dict = Field(default_factory=dict)


# =========================================================================
# SECTION 38: RESEARCH ANALYTICS AND EXPORT SCHEMAS
# =========================================================================

class ParticipantFlowDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_participants: int
    total_enrolled: int
    allocated_control: int
    allocated_experimental: int
    active_in_progress: int
    completed_study: int
    total_withdrawn: int
    withdrawn_by_reason: dict[str, int]
    completion_rate_pct: float
    dropout_rate_pct: float


class DescriptiveMetricDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    count: int
    mean: float | None = None
    median: float | None = None
    std_dev: float | None = None
    min_value: float | None = None
    max_value: float | None = None
    mean_percentage: float | None = None
    is_small_cell: bool = False


class AssessmentComparisonDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assessment_id: UUID
    kind: str
    title: str
    instrument_version: str
    maximum_possible: float
    control_stats: DescriptiveMetricDTO
    experimental_stats: DescriptiveMetricDTO
    overall_stats: DescriptiveMetricDTO


class PairedComparisonsDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    absolute_gain_control: DescriptiveMetricDTO
    absolute_gain_experimental: DescriptiveMetricDTO
    normalized_gain_control: DescriptiveMetricDTO
    normalized_gain_experimental: DescriptiveMetricDTO
    retention_loss_control: DescriptiveMetricDTO
    retention_loss_experimental: DescriptiveMetricDTO


class EngagementSummaryDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_review_events: int
    active_learners: int
    mean_reviews_per_learner: float
    retention_accuracy_pct: float
    mean_duration_ms: int
    total_lapses: int
    rating_counts: dict[str, int]


class StudyAnalyticsSummaryDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    study_id: UUID
    study_code: str
    study_title: str
    target_language: str
    protocol_version: str
    flow: ParticipantFlowDTO
    assessments: list[AssessmentComparisonDTO]
    paired: PairedComparisonsDTO
    engagement_control: EngagementSummaryDTO
    engagement_experimental: EngagementSummaryDTO
    ethics_disclaimer: str = ETHICS_DISCLAIMER
    data_integrity_notice: str

