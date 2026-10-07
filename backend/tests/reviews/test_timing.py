"""D8 timing is evidence, never an analytical exclusion policy."""

import copy
import uuid

import pytest
from sqlalchemy import inspect

from app.research_logging.models import ResearchEvent
from app.reviews.models import ReviewAttempt, ReviewSchedule
from tests.content.test_provenance import attempt
from tests.reviews.test_due_review import make_review_context


@pytest.fixture
def review_context(db_session, client):
    return make_review_context(db_session, client)


EVIDENCE = {
    "version": 1,
    "clock_source": "date_now_fallback",
    "start_boundary": "prompt_layout_frame",
    "interruption_count": 3,
    "interruption_reasons": ["app_inactive", "app_background", "screen_blur"],
}


def test_interrupted_fallback_timing_is_stored_and_replay_never_rewrites_facts(
    db_session, client, review_context
):
    _, headers, detail = review_context
    payload = {**attempt(detail["vocabulary_items"][0]), "response_time_ms": 1234,
               "client_interaction_at": "2025-01-01T11:22:33.456Z", "timing_evidence": EVIDENCE}
    first = client.post("/reviews/attempts", json=payload, headers=headers)
    assert first.status_code == 200
    assert first.json()["timing_evidence"] == EVIDENCE
    stored = db_session.get(ReviewAttempt, uuid.UUID(first.json()["id"]))
    assert stored.timing_evidence == EVIDENCE
    assert stored.response_time_ms == 1234
    mutated = {**payload, "timing_evidence": None, "response_time_ms": 9999,
               "client_interaction_at": "2030-01-01T00:00:00Z"}
    replay = client.post("/sync/review-events", json={"events": [mutated]}, headers=headers)
    assert replay.status_code == 200
    assert replay.json()["accepted_events"] == [first.json()]
    assert db_session.query(ReviewAttempt).count() == 1
    assert db_session.query(ReviewSchedule).count() == 1
    assert db_session.query(ResearchEvent).count() == 2


@pytest.mark.parametrize("duration", [0, 3_600_000])
def test_sanity_bounds_accept_interrupted_unusual_durations(client, review_context, duration):
    _, headers, detail = review_context
    payload = {**attempt(detail["vocabulary_items"][0]), "response_time_ms": duration,
               "timing_evidence": EVIDENCE}
    result = client.post("/sync/review-events", json={"events": [payload]}, headers=headers)
    assert result.status_code == 200
    assert result.json()["accepted_events"][0]["timing_evidence"] == EVIDENCE


@pytest.mark.parametrize("duration", [-1, 3_600_001])
def test_existing_software_sanity_range_is_retained(client, review_context, duration):
    _, headers, detail = review_context
    payload = {**attempt(detail["vocabulary_items"][0]), "response_time_ms": duration}
    assert client.post("/reviews/attempts", json=payload, headers=headers).status_code == 422


def test_legacy_absence_stays_null(client, db_session, review_context):
    _, headers, detail = review_context
    payload = attempt(detail["vocabulary_items"][0])
    result = client.post("/reviews/attempts", json=payload, headers=headers)
    assert result.status_code == 200
    assert result.json()["timing_evidence"] is None
    assert db_session.get(ReviewAttempt, uuid.UUID(result.json()["id"])).timing_evidence is None
    assert any(c["name"] == "timing_evidence" and c["nullable"] for c in inspect(db_session.bind).get_columns("review_attempts"))


@pytest.mark.parametrize("source", ["native_performance_now", "performance_now", "date_now_fallback"])
def test_uninterrupted_measurement_source_is_explicit_without_quality_imputation(client, review_context, source):
    _, headers, detail = review_context
    evidence = {**EVIDENCE, "clock_source": source, "interruption_count": 0, "interruption_reasons": []}
    payload = {**attempt(detail["vocabulary_items"][0]), "timing_evidence": {**evidence, "access_token": "secret"}}
    result = client.post("/reviews/attempts", json=payload, headers=headers)
    assert result.status_code == 200
    assert result.json()["timing_evidence"] == evidence


@pytest.mark.parametrize("change", [
    {"version": 2}, {"clock_source": "unknown"}, {"start_boundary": "item_assignment"},
    {"interruption_count": -1}, {"interruption_count": 0}, {"interruption_count": 1.5},
    {"interruption_reasons": []}, {"interruption_reasons": ["device_lock_guessed"]},
    {"interruption_reasons": ["screen_blur", "screen_blur"]},
])
def test_malformed_timing_evidence_rejected_structurally(client, review_context, change):
    _, headers, detail = review_context
    payload = {**attempt(detail["vocabulary_items"][0]), "timing_evidence": {**copy.deepcopy(EVIDENCE), **change}}
    assert client.post("/reviews/attempts", json=payload, headers=headers).status_code == 422
