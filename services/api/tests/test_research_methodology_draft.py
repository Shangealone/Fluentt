"""Proposal validation only: these tests do not authorize a live study."""

from datetime import datetime

import pytest
from pydantic import ValidationError

from app.modules.research.classroom_schemas import MethodologyDraft, ProtocolConfiguration, calendar_month_boundary


def proposal(**changes):
    return dict(
        version="synthetic-proposal-v1",
        target_participants=30,
        control_target=15,
        experimental_target=15,
        intervention_calendar_months=1,
        practice_min_seconds=300,
        practice_max_seconds=600,
        delayed_retention_calendar_days=7,
        **changes,
    )


def test_proposal_identity_and_legacy_compatibility():
    value = MethodologyDraft.model_validate(proposal())
    assert value.control == "fsrs6" and value.experimental == "fsrs6_fifakt_proposed"
    assert value.scope == "research_classroom_only"
    assert ProtocolConfiguration().methodology_draft is None
    assert ProtocolConfiguration(methodology_draft=value, active_weekdays=[1, 2, 3, 4, 5]).methodology_draft == value
    from app.modules.research.classroom_service import configuration_data

    assert "methodology_draft" not in configuration_data(ProtocolConfiguration())


@pytest.mark.parametrize(
    "changes",
    [
        {"control_target": 14},
        {"target_participants": 31},
        {"practice_min_seconds": 601},
        {"target_participants": True},
        {"control": "sm2"},
        {"intervention_calendar_months": 0},
        {"delayed_retention_calendar_days": 0},
    ],
)
def test_invalid_proposal(changes):
    with pytest.raises(ValidationError):
        MethodologyDraft.model_validate(proposal() | changes)


def test_weekdays_are_validated_only_for_opt_in_proposal():
    assert ProtocolConfiguration(active_weekdays=[6]).active_weekdays == [6]
    with pytest.raises(ValidationError):
        ProtocolConfiguration(methodology_draft=proposal(), active_weekdays=[6])


@pytest.mark.parametrize(
    "start,zone,expected",
    [
        ("2027-01-31T16:00:00+00:00", "Asia/Manila", "2027-03-01T00:00:00+08:00"),
        ("2028-01-31T00:00:00+00:00", "UTC", "2028-02-29T00:00:00+00:00"),
        ("2027-02-15T05:00:00+00:00", "America/New_York", "2027-03-15T00:00:00-04:00"),
    ],
)
def test_calendar_month_is_local_not_thirty_days(start, zone, expected):
    assert calendar_month_boundary(datetime.fromisoformat(start), 1, zone).isoformat() == expected


def test_calendar_month_window_must_match_configuration():
    config = dict(
        methodology_draft=proposal(),
        timezone="UTC",
        administrator_setup={
            "phase_windows": {"intervention": {"opens_at": "2027-01-01T00:00:00Z", "closes_at": "2027-02-01T00:00:00Z"}}
        },
    )
    assert ProtocolConfiguration.model_validate(config).timezone == "UTC"
    config["administrator_setup"]["phase_windows"]["intervention"]["closes_at"] = "2027-01-31T00:00:00Z"
    with pytest.raises(ValidationError):
        ProtocolConfiguration.model_validate(config)
