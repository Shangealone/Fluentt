from datetime import UTC, datetime, timedelta

import pytest

from app.scheduling.base import Scheduler
from app.scheduling.development import DevelopmentScheduler
from app.scheduling.types import ReviewContext, SchedulingResult


def test_development_scheduler_identifies_version() -> None:
    now = datetime.now(UTC)
    context = ReviewContext(
        correct=True,
        response_time_ms=1500,
        item_difficulty=1.0,
        interaction_at=now,
    )
    scheduler: Scheduler = DevelopmentScheduler()
    result: SchedulingResult = scheduler.schedule(context)

    assert result.scheduler_type == "development"
    assert result.algorithm_version == "dev-0.1"
    assert result.next_interval_seconds == 86400
    assert result.next_due_at == now + timedelta(seconds=86400)
    assert isinstance(result.state, dict)
    assert result.state.get("is_development_only") is True


def test_development_scheduler_incorrect_interval() -> None:
    now = datetime.now(UTC)
    context = ReviewContext(
        correct=False,
        response_time_ms=4200,
        item_difficulty=1.5,
        interaction_at=now,
    )
    scheduler = DevelopmentScheduler()
    result = scheduler.schedule(context)

    assert result.scheduler_type == "development"
    assert result.algorithm_version == "dev-0.1"
    assert result.next_interval_seconds == 600
    assert result.next_due_at == now + timedelta(seconds=600)


from dataclasses import FrozenInstanceError


def test_review_context_is_frozen() -> None:
    now = datetime.now(UTC)
    context = ReviewContext(
        correct=True,
        response_time_ms=1200,
        item_difficulty=1.0,
        interaction_at=now,
    )
    with pytest.raises(FrozenInstanceError):
        context.correct = False  # type: ignore[misc]
