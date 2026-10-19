"""Engine availability must never activate research acceptance."""

import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import text

from app.auth.models import User
from app.reviews.schemas import ReviewAttemptCreate
from app.reviews.service import record_review_attempt
from app.scheduling.research_contracts import (
    ResearchSchedulerInput,
    decode_research_state,
)
from app.sync.service import sync_review_events
from tests.content.test_provenance import attempt
from tests.reviews.test_d11b_acceptance import counts
from tests.reviews.test_d11b_persistence import graph


@pytest.mark.parametrize("via_sync", [False, True])
def test_explicit_pure_engine_execution_does_not_enable_allocated_owner_acceptance(
    db_session, client, via_sync
):
    from app.scheduling.sm2 import BinarySm2Scheduler

    result = BinarySm2Scheduler().schedule(
        ResearchSchedulerInput(
            correct=True,
            interaction_at_utc=datetime(2026, 10, 17, tzinfo=UTC),
            prior_state=None,
            prior_interaction_at_utc=None,
        )
    )
    assert result.scheduler_type == "conventional_srs"
    owner, detail, *_ = graph(db_session, client)
    value = ReviewAttemptCreate(**attempt(detail["vocabulary_items"][1]))
    user = db_session.get(User, owner)
    before = counts(db_session)
    with pytest.raises(HTTPException) as error:
        if via_sync:
            sync_review_events(db_session, user, [value])
        else:
            record_review_attempt(db_session, user, value)
    assert (error.value.status_code, error.value.detail) == (
        503,
        "D11_CLOCK_POLICY_UNAVAILABLE",
    )
    assert counts(db_session) == before == (0, 0, 0, 0, 0)


@pytest.mark.parametrize(
    "lapses,ease", [(0, "2.5"), (1, "2.18"), (2, "1.86"), (3, "1.54"), (4, "1.3")]
)
def test_fastapi_postgresql_json_round_trip_preserves_sm2_memory_without_writes(
    db_session, lapses, ease
):
    from app.scheduling.sm2 import BinarySm2Scheduler

    scheduler = BinarySm2Scheduler()
    prior = None
    prior_at = None
    at = datetime(2026, 10, 17, 11, 23, 45, tzinfo=UTC)
    for index in range(max(1, lapses)):
        result = scheduler.schedule(
            ResearchSchedulerInput(
                correct=lapses == 0,
                interaction_at_utc=at + timedelta(seconds=index),
                prior_state=prior,
                prior_interaction_at_utc=prior_at,
            )
        )
        prior = result.scheduler_state
        prior_at = at + timedelta(seconds=index)
    encoded = jsonable_encoder(result.scheduler_state)
    stored = db_session.scalar(
        text("SELECT CAST(:state AS JSON)"), {"state": json.dumps(encoded)}
    )
    assert isinstance(stored["memory"]["ease_factor"], (int, float))
    reconstructed = decode_research_state(stored)
    assert reconstructed == result.scheduler_state
    assert reconstructed.memory.ease_factor == Decimal(ease)
    original_input = ResearchSchedulerInput(
        correct=True,
        interaction_at_utc=at + timedelta(days=1),
        prior_state=result.scheduler_state,
        prior_interaction_at_utc=prior_at,
    )
    assert scheduler.schedule(original_input) == scheduler.schedule(
        original_input.model_copy(update={"prior_state": reconstructed})
    )
    assert counts(db_session) == (0, 0, 0, 0, 0)
