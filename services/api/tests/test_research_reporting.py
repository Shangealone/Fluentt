"""Synthetic readiness/denial QA, never fabricated approved questionnaires or observations."""

from types import SimpleNamespace
from uuid import uuid4
import pytest
from pydantic import ValidationError

from app.modules.identity.errors import IdentityError
from app.modules.research.reporting_schemas import ReportingReadiness, UnavailableMetric, METRICS
from app.modules.research.reporting_service import assert_legacy_reporting_allowed
from app.modules.research.analytics_service import (
    compute_study_participant_flow,
    compute_study_assessment_metrics,
    compute_study_engagement_metrics,
    export_participants_longitudinal_csv,
    export_assessment_results_csv,
    export_review_events_csv,
)


def test_readiness_never_substitutes_zero_target_size_or_predictions_for_observations():
    report = ReportingReadiness().model_dump()
    assert report["observed_results_available"] is False
    assert report["inferential_statistics_available"] is False
    assert report["questionnaire"] == {
        "publication_status": "UNPUBLISHED",
        "collection_available": False,
        "instrument_version": None,
        "response_count": None,
    }
    assert {row["key"] for row in report["metrics"]} == set(METRICS)
    for row in report["metrics"]:
        for name in (
            "value",
            "sample_size",
            "denominator",
            "observation_window",
            "instrument_version",
            "algorithm_version",
            "metric_version",
        ):
            assert row[name] is None


@pytest.mark.parametrize("field", ["value", "sample_size", "denominator", "observation_window", "metric_version"])
def test_unavailable_contract_rejects_invented_numbers_or_versions(field):
    with pytest.raises(ValidationError):
        UnavailableMetric(key="recall_accuracy", **{field: 0})


def test_no_approval_toggles_raw_voice_or_questionnaire_items_can_be_smuggled_into_status():
    for extra in ({"approved": True}, {"raw_voice": "private"}, {"questions": ["invented ISO question"]}):
        with pytest.raises(ValidationError):
            ReportingReadiness(**extra)


@pytest.mark.parametrize(
    "compute", [compute_study_participant_flow, compute_study_assessment_metrics, compute_study_engagement_metrics]
)
def test_managed_legacy_aggregate_refuses_before_any_observation_query(compute):
    class NoObservationDB:
        def scalars(self, *_):
            raise AssertionError("Unapproved observations must not be read")

    study = SimpleNamespace(conditions={"research_contract": "research-classrooms-v1"})
    with pytest.raises(IdentityError) as exc:
        compute(NoObservationDB(), study)
    assert exc.value.code == "research_reporting_blocked"


@pytest.mark.parametrize(
    "export", [export_participants_longitudinal_csv, export_assessment_results_csv, export_review_events_csv]
)
def test_managed_legacy_export_refuses_formula_payload_and_private_data_before_query(export):
    study = SimpleNamespace(
        conditions={"research_contract": "research-classrooms-v1"}, code='=HYPERLINK("synthetic-only")'
    )

    class NoObservationDB:
        def get(self, *_):
            return study

        def scalars(self, *_):
            raise AssertionError("No disclosure policy: do not read participant data")

    class AuthorizedSyntheticRepo:
        def resolve_session(self, _):
            return SimpleNamespace(id=uuid4())

        def require_permission(self, *_):
            pass

    with pytest.raises(IdentityError) as exc:
        export(NoObservationDB(), AuthorizedSyntheticRepo(), "synthetic", uuid4())
    assert exc.value.code == "research_reporting_blocked" and "HYPERLINK" not in str(exc.value)


def test_unmarked_legacy_study_is_not_reclassified_as_managed_research():
    assert assert_legacy_reporting_allowed(SimpleNamespace(conditions={})) is None
