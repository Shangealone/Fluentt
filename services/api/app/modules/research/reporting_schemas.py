"""Honest unavailable reporting until approved collection/disclosure contracts exist."""

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

METRICS = (
    "participant_flow",
    "assignment_adherence",
    "review_adherence",
    "pre_test_completion",
    "immediate_post_test_completion",
    "delayed_retention_completion",
    "assessment_results",
    "recall_accuracy",
    "review_count",
    "workload",
    "active_study_duration",
    "study_duration",
    "pronunciation_score",
    "questionnaire_responses",
    "questionnaire_distributions",
    "missing_data",
    "learning_gain",
    "retention",
)
BLOCKERS = (
    "approved_questionnaire_missing",
    "participant_authorization_workflow_missing",
    "approved_statistical_and_comparability_plan_missing",
    "approved_disclosure_and_withdrawal_policy_missing",
    "verified_assessment_and_treatment_collection_unavailable",
)


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class UnavailableMetric(Contract):
    key: str
    status: Literal["UNAVAILABLE"] = "UNAVAILABLE"
    value: None = None
    sample_size: None = None
    denominator: None = None
    observation_window: None = None
    instrument_version: None = None
    algorithm_version: None = None
    metric_version: None = None
    reason: Literal["authorized_measurement_unavailable"] = "authorized_measurement_unavailable"


class QuestionnaireAvailability(Contract):
    publication_status: Literal["UNPUBLISHED"] = "UNPUBLISHED"
    collection_available: Literal[False] = False
    instrument_version: None = None
    response_count: None = None


class ReportingReadiness(Contract):
    contract_version: Literal["research-reporting-readiness-v1"] = "research-reporting-readiness-v1"
    observed_results_available: Literal[False] = False
    inferential_statistics_available: Literal[False] = False
    questionnaire: QuestionnaireAvailability = Field(default_factory=QuestionnaireAvailability)
    export_status: Literal["BLOCKED"] = "BLOCKED"
    blockers: list[str] = Field(default_factory=lambda: list(BLOCKERS))
    metrics: list[UnavailableMetric] = Field(default_factory=lambda: [UnavailableMetric(key=key) for key in METRICS])
