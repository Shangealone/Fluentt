from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4
import pytest
from pydantic import ValidationError
from app.modules.spaced_repetition.schemas import (
    ReviewEventInput,
    AlgorithmIdentity,
    CardSchedulingState,
    ScheduleDecision,
    DueReviewItem,
    DueReviewBatch,
)
from app.modules.spaced_repetition.registry import (
    BaseScheduler,
    AlgorithmRegistry,
    registry as global_registry,
)


def test_review_event_schemas():
    now = datetime.now(timezone.utc)
    event_key = uuid4()
    voc_id = uuid4()

    event = ReviewEventInput(
        event_key=event_key,
        vocabulary_item_id=voc_id,
        recall_rating="good",
        response_duration_ms=1250,
        reviewed_at=now,
        context_type="self_study",
    )
    assert event.event_key == event_key
    assert event.recall_rating == "good"
    assert event.response_duration_ms == 1250


def test_review_event_rejects_invalid_ratings():
    with pytest.raises(ValidationError):
        ReviewEventInput(
            event_key=uuid4(),
            vocabulary_item_id=uuid4(),
            recall_rating="perfect",  # Invalid rating! Must be again, hard, good, easy
            response_duration_ms=1000,
            reviewed_at=datetime.now(timezone.utc),
        )


def test_algorithm_registry_isolation():
    class DummyScheduler(BaseScheduler):
        @property
        def identity(self) -> AlgorithmIdentity:
            return AlgorithmIdentity(
                algorithm="sm2",
                implementation_version="sm2-base-v1",
                configuration_version=1,
            )

        def initial_state(self):
            return {"repetitions": 0, "interval_days": 1, "ease_factor": 2.5}

        def compute_next_review(self, current_state, rating, reviewed_at, duration_ms, revision):
            return ScheduleDecision(
                algorithm="sm2",
                implementation_version="sm2-base-v1",
                configuration_version=1,
                previous_state=current_state,
                resulting_state=current_state,
                previous_interval_seconds=Decimal("86400"),
                resulting_interval_seconds=Decimal("172800"),
                due_at=reviewed_at,
                state_revision=revision + 1,
            )

    local_reg = AlgorithmRegistry()
    assert not local_reg.is_available("sm2")
    assert local_reg.get("sm2") is None

    local_reg.register("sm2", DummyScheduler())
    assert local_reg.is_available("sm2")
    assert local_reg.is_available("SM2")  # Case-insensitive
    assert local_reg.get("sm2") is not None
    assert not local_reg.is_available("fsrs6")
    assert not local_reg.is_available("fifakt")


def test_due_review_batch_schema():
    now = datetime.now(timezone.utc)
    batch = DueReviewBatch(
        items=[
            DueReviewItem(
                review_state_id=uuid4(),
                vocabulary_item_id=uuid4(),
                term="bathala",
                meaning="diyos",
                language="tagalog",
                due_at=now,
                last_reviewed_at=None,
                overdue_seconds=0.0,
            )
        ],
        total_due=1,
        algorithm="sm2",
        as_of=now,
    )
    assert batch.total_due == 1
    assert len(batch.items) == 1
    assert batch.algorithm == "sm2"
