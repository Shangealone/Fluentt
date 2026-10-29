"""Administrator draft settings only; no scheduling or methodology is inferred."""

import pytest
from pydantic import ValidationError
from app.modules.research.classroom_schemas import ProtocolConfiguration


@pytest.mark.parametrize(
    "setup",
    [
        {"proposed_intervention_weeks": 0},
        {"proposed_intervention_weeks": True},
        {"assessment_attempt_limit": -1},
        {"assessment_attempt_limit": 1.5},
        {"daily_availability": {"opens": "24:00", "closes": "25:00"}},
        {"daily_availability": {"opens": "18:00", "closes": "08:00"}},
        {"phase_windows": {"questionnaire": {"opens_at": "2027-01-01T00:00:00", "closes_at": "2027-01-02T00:00:00Z"}}},
        {"phase_windows": {"pre_test": {"opens_at": "2027-01-02T00:00:00Z", "closes_at": "2027-01-01T00:00:00Z"}}},
        {"phase_windows": {"invented_phase": {}}},
        {"ethics_approved": True},
    ],
)
def test_invalid_proposals_rejected(setup):
    with pytest.raises(ValidationError):
        ProtocolConfiguration(administrator_setup=setup)


def test_proposals_are_optional_and_within_study_dates():
    assert ProtocolConfiguration().administrator_setup is None
    config = ProtocolConfiguration(administrator_setup={"proposed_intervention_weeks": 3})
    assert config.active_weekdays is None
    assert config.administrator_setup.assessment_attempt_limit is None
    with pytest.raises(ValidationError):
        ProtocolConfiguration(
            starts_at="2027-01-02T00:00:00Z",
            administrator_setup={
                "phase_windows": {
                    "intervention": {"opens_at": "2027-01-01T00:00:00Z", "closes_at": "2027-01-03T00:00:00Z"}
                }
            },
        )


def test_absent_additive_proposals_preserve_prior_replay_identity():
    from app.modules.research.classroom_service import configuration_data, fingerprint

    config = ProtocolConfiguration()
    original = config.model_dump(mode="json")
    original.pop("administrator_setup")
    original.pop("assessment_delivery_draft")
    assert configuration_data(config) == original
    assert fingerprint("revise", "scope", configuration_data(config)) == fingerprint("revise", "scope", original)
    assert configuration_data(ProtocolConfiguration(administrator_setup={"proposed_intervention_weeks": 3})) != original
