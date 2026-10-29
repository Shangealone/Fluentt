"""Draft validation and explicit unavailable delivery; not evidence of live timers."""

from uuid import uuid4
import pytest
from pydantic import ValidationError

from app.modules.research.assessment_draft_service import publication_status
from app.modules.research.classroom_schemas import ProtocolConfiguration
from app.modules.research.classroom_service import configuration_data, fingerprint


@pytest.mark.parametrize(
    "plan",
    [
        {"version": " "},
        {"version": "v1", "approved": True},
        {"version": "v1", "stages": {"questionnaire": {}}},
        {"version": "v1", "stages": {"pre_test": {"maximum_attempts": 0}}},
        {"version": "v1", "stages": {"pre_test": {"maximum_attempts": True}}},
        {"version": "v1", "stages": {"pre_test": {"maximum_attempts": 1.5}}},
        {"version": "v1", "stages": {"pre_test": {"answers": {"key": "private"}}}},
        {"version": "v1", "sm2_control": {"scoring_policy": {}}},
        {
            "version": "v1",
            "delayed_follow_up": {
                "policy": {"version": "v1", "reference": "synthetic"},
                "anchor": "immediate_post_test_completion",
                "minimum_delay_seconds": 0,
            },
        },
        {
            "version": "v1",
            "delayed_follow_up": {
                "policy": {"version": "v1", "reference": "synthetic"},
                "anchor": "client_clock",
                "minimum_delay_seconds": 5,
            },
        },
    ],
)
def test_no_unapproved_execution_keys_invalid_caps_or_immediate_delayed_test(plan):
    with pytest.raises(ValidationError):
        ProtocolConfiguration(assessment_delivery_draft=plan)


def test_reference_must_be_pinned_in_this_protocol_and_stages_are_distinct():
    instrument_id = str(uuid4())
    plan = {"version": "synthetic-v1", "stages": {"pre_test": {"assessment_id": instrument_id}}}
    with pytest.raises(ValidationError):
        ProtocolConfiguration(assessment_delivery_draft=plan)
    reference = {"assessment_id": instrument_id, "instrument_version": "synthetic-v1"}
    config = ProtocolConfiguration(assessments=[reference], assessment_delivery_draft=plan)
    assert "assessment_stage_window_or_timer_missing:pre_test" in publication_status(config)["blockers"]
    plan["stages"]["immediate_post_test"] = {"assessment_id": instrument_id}
    with pytest.raises(ValidationError):
        ProtocolConfiguration(assessments=[reference], assessment_delivery_draft=plan)


def test_draft_has_no_assumed_timer_attempt_limit_interval_or_algorithm():
    config = ProtocolConfiguration(assessment_delivery_draft={"version": "synthetic-v1", "stages": {"pre_test": {}}})
    draft = config.assessment_delivery_draft
    assert draft.delayed_follow_up is None and draft.stages["pre_test"].maximum_attempts is None
    assert draft.stages["pre_test"].timeout_policy is None and config.assessments == []
    result = publication_status(config)
    assert result["status"] == "BLOCKED" and result["execution_available"] is False
    assert "participant_authorization_workflow_unavailable" in result["blockers"]


def test_absent_additive_plan_preserves_pre_prompt05_request_digest():
    config = ProtocolConfiguration()
    original = config.model_dump(mode="json")
    original.pop("administrator_setup")
    original.pop("assessment_delivery_draft")
    assert fingerprint("revise", "scope", original) == fingerprint("revise", "scope", configuration_data(config))
