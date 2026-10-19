"""FSRS engine presence does not activate research acceptance."""

from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.auth.models import User
from app.reviews.schemas import ReviewAttemptCreate
from app.reviews.service import record_review_attempt
from app.scheduling.research_contracts import ResearchSchedulerInput
from app.sync.service import sync_review_events
from tests.content.test_provenance import attempt
from tests.reviews.test_d11b_acceptance import counts
from tests.reviews.test_d11b_persistence import graph


@pytest.mark.parametrize("via_sync", [False, True])
def test_pure_enhanced_calculation_does_not_enable_new_online_or_sync_research(
    db_session, client, via_sync
):
    from app.scheduling.fsrs6 import EnhancedFsrsScheduler, FsrsReconstructionContext

    owner, detail, *_ = graph(db_session, client)
    word = detail["vocabulary_items"][0]
    result = EnhancedFsrsScheduler().schedule(
        ResearchSchedulerInput(
            correct=True,
            interaction_at_utc=datetime(2026, 1, 1, tzinfo=UTC),
            prior_state=None,
            prior_interaction_at_utc=None,
        ),
        FsrsReconstructionContext(
            user_id=owner, vocabulary_item_id=UUID(word["id"]), prior_due_at_utc=None
        ),
    )
    assert result.scheduler_type == "enhanced_srs"
    before = counts(db_session)
    inputs = ReviewAttemptCreate(**attempt(word))
    user = db_session.get(User, owner)
    with pytest.raises(HTTPException) as error:
        if via_sync:
            sync_review_events(db_session, user, [inputs])
        else:
            record_review_attempt(db_session, user, inputs)
    assert (error.value.status_code, error.value.detail) == (
        503,
        "D11_CLOCK_POLICY_UNAVAILABLE",
    )
    assert counts(db_session) == before == (0, 0, 0, 0, 0)
