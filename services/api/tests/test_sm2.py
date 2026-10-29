"""Comprehensive unit and integration tests for SM-2 Spaced Repetition Engine (Section 29).

Validates:
1. Canonical SuperMemo-2 formulas and progression (1, 6, round(I * EF)).
2. 4-point recall scale mapping ("again" -> 1, "hard" -> 3, "good" -> 4, "easy" -> 5).
3. Easiness factor progression, delta calculation, and EF floor (1.30).
4. Lapse handling (repetitions reset to 0, interval reset to 1 day, lapses count increments).
5. Safe recovery after lapse.
6. Deterministic interval rounding (ROUND_HALF_UP).
7. Missing/corrupted state sanitation and input validation.
8. Monotonic review timestamps and duplicate submission idempotency.
9. Cross-algorithm isolation (no overwriting FSRS-6 or FIFAKT states).
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4
import pytest

from app.modules.spaced_repetition.sm2 import (
    calculate_sm2,
    SM2Scheduler,
    sm2_scheduler,
    round_half_up,
    INITIAL_EASE_FACTOR,
    MINIMUM_EASE_FACTOR,
    INITIAL_INTERVAL_DAYS,
    SECOND_INTERVAL_DAYS,
)
from app.modules.spaced_repetition.registry import registry
from app.modules.spaced_repetition.schemas import ReviewEventInput


def test_round_half_up():
    assert round_half_up(15.0) == 15
    assert round_half_up(37.5) == 38
    assert round_half_up(14.16) == 14
    assert round_half_up(15.6) == 16
    assert round_half_up(33.04) == 33
    assert round_half_up(0.5) == 1
    assert round_half_up(0.4) == 0


def test_sm2_scheduler_identity():
    ident = sm2_scheduler.identity
    assert ident.algorithm == "sm2"
    assert ident.implementation_version == "sm2-classic-v1"
    assert ident.configuration_version == 1
    assert ident.parameters["initial_ease_factor"] == 2.5
    assert ident.parameters["minimum_ease_factor"] == 1.3
    assert ident.parameters["first_interval_days"] == 1
    assert ident.parameters["second_interval_days"] == 6


def test_sm2_initial_state():
    init = sm2_scheduler.initial_state()
    assert init["repetitions"] == 0
    assert init["interval_days"] == 1
    assert init["ease_factor"] == 2.5
    assert init["lapses"] == 0
    assert init["total_reviews"] == 0
    assert init["last_quality"] is None


def test_sm2_standard_good_progression():
    """Validates classic SM-2 sequence with repeated 'good' (q=4) ratings.
    EF remains unchanged at 2.50.
    Intervals: 1 -> 6 -> 15 -> 38 -> 95 days.
    """
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)
    state = sm2_scheduler.initial_state()

    # Review 1: good
    d1 = calculate_sm2(state, "good", now, revision=1)
    assert d1.resulting_state["repetitions"] == 1
    assert d1.resulting_state["interval_days"] == 1
    assert d1.resulting_state["ease_factor"] == 2.5
    assert d1.resulting_state["lapses"] == 0
    assert d1.resulting_state["total_reviews"] == 1
    assert d1.resulting_interval_seconds == Decimal("86400")
    assert d1.due_at == now + timedelta(days=1)

    # Review 2: good (reviewed 1 day later)
    now2 = now + timedelta(days=1)
    d2 = calculate_sm2(d1.resulting_state, "good", now2, revision=2)
    assert d2.resulting_state["repetitions"] == 2
    assert d2.resulting_state["interval_days"] == 6
    assert d2.resulting_state["ease_factor"] == 2.5
    assert d2.resulting_interval_seconds == Decimal("518400")
    assert d2.due_at == now2 + timedelta(days=6)

    # Review 3: good (reviewed 6 days later, 6 * 2.5 = 15)
    now3 = now2 + timedelta(days=6)
    d3 = calculate_sm2(d2.resulting_state, "good", now3, revision=3)
    assert d3.resulting_state["repetitions"] == 3
    assert d3.resulting_state["interval_days"] == 15
    assert d3.resulting_state["ease_factor"] == 2.5
    assert d3.due_at == now3 + timedelta(days=15)

    # Review 4: good (reviewed 15 days later, round(15 * 2.5 = 37.5) -> 38)
    now4 = now3 + timedelta(days=15)
    d4 = calculate_sm2(d3.resulting_state, "good", now4, revision=4)
    assert d4.resulting_state["repetitions"] == 4
    assert d4.resulting_state["interval_days"] == 38
    assert d4.resulting_state["ease_factor"] == 2.5
    assert d4.due_at == now4 + timedelta(days=38)

    # Review 5: good (reviewed 38 days later, 38 * 2.5 = 95)
    now5 = now4 + timedelta(days=38)
    d5 = calculate_sm2(d4.resulting_state, "good", now5, revision=5)
    assert d5.resulting_state["repetitions"] == 5
    assert d5.resulting_state["interval_days"] == 95
    assert d5.due_at == now5 + timedelta(days=95)


def test_sm2_easy_increases_ease_factor():
    """Validates 'easy' (q=5) increases EF by +0.10."""
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)
    state = sm2_scheduler.initial_state()

    # Review 1: easy (EF: 2.50 + 0.10 = 2.60)
    d1 = calculate_sm2(state, "easy", now, revision=1)
    assert d1.resulting_state["repetitions"] == 1
    assert d1.resulting_state["interval_days"] == 1
    assert d1.resulting_state["ease_factor"] == 2.60
    assert d1.resulting_state["last_quality"] == 5

    # Review 2: easy (EF: 2.60 + 0.10 = 2.70, interval: 6)
    d2 = calculate_sm2(d1.resulting_state, "easy", now, revision=2)
    assert d2.resulting_state["repetitions"] == 2
    assert d2.resulting_state["interval_days"] == 6
    assert d2.resulting_state["ease_factor"] == 2.70

    # Review 3: easy (EF: 2.70 + 0.10 = 2.80, interval: round(6 * 2.80 = 16.8) -> 17)
    d3 = calculate_sm2(d2.resulting_state, "easy", now, revision=3)
    assert d3.resulting_state["repetitions"] == 3
    assert d3.resulting_state["interval_days"] == 17
    assert d3.resulting_state["ease_factor"] == 2.80


def test_sm2_hard_decreases_ease_factor():
    """Validates 'hard' (q=3) decreases EF by -0.14 but still advances repetition."""
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)
    state = sm2_scheduler.initial_state()

    # Review 1: hard (EF: 2.50 - 0.14 = 2.36)
    d1 = calculate_sm2(state, "hard", now, revision=1)
    assert d1.resulting_state["repetitions"] == 1
    assert d1.resulting_state["interval_days"] == 1
    assert d1.resulting_state["ease_factor"] == 2.36
    assert d1.resulting_state["lapses"] == 0

    # Review 2: hard (EF: 2.36 - 0.14 = 2.22, interval: 6)
    d2 = calculate_sm2(d1.resulting_state, "hard", now, revision=2)
    assert d2.resulting_state["repetitions"] == 2
    assert d2.resulting_state["interval_days"] == 6
    assert d2.resulting_state["ease_factor"] == 2.22

    # Review 3: hard (EF: 2.22 - 0.14 = 2.08, interval: round(6 * 2.08 = 12.48) -> 12)
    d3 = calculate_sm2(d2.resulting_state, "hard", now, revision=3)
    assert d3.resulting_state["repetitions"] == 3
    assert d3.resulting_state["interval_days"] == 12
    assert d3.resulting_state["ease_factor"] == 2.08


def test_sm2_lapse_behavior_and_recovery():
    """Validates lapse on 'again' (q=1):
    - Repetitions resets to 0
    - Interval resets to 1 day
    - Lapses counter increments
    - EF drops by 0.54
    - Subsequent passing review restarts sequence from n=1, I=1.
    """
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)
    # Start with a card that has reached repetition 3 and interval 15
    state = {
        "repetitions": 3,
        "interval_days": 15,
        "ease_factor": 2.50,
        "lapses": 0,
        "total_reviews": 3,
    }

    # Student forgets: rating 'again'
    lapse_decision = calculate_sm2(state, "again", now, revision=4)
    res_state = lapse_decision.resulting_state
    assert res_state["repetitions"] == 0
    assert res_state["interval_days"] == 1
    assert res_state["lapses"] == 1
    assert res_state["total_reviews"] == 4
    # EF drops: 2.50 - 0.54 = 1.96
    assert res_state["ease_factor"] == 1.96
    assert lapse_decision.due_at == now + timedelta(days=1)

    # Next review after lapse: student recalls with 'good'
    recovery_1 = calculate_sm2(res_state, "good", now + timedelta(days=1), revision=5)
    assert recovery_1.resulting_state["repetitions"] == 1
    assert recovery_1.resulting_state["interval_days"] == 1
    assert recovery_1.resulting_state["ease_factor"] == 1.96

    # Next review: student recalls with 'good'
    recovery_2 = calculate_sm2(recovery_1.resulting_state, "good", now + timedelta(days=2), revision=6)
    assert recovery_2.resulting_state["repetitions"] == 2
    assert recovery_2.resulting_state["interval_days"] == 6
    assert recovery_2.resulting_state["ease_factor"] == 1.96

    # Third review after lapse: round(6 * 1.96 = 11.76) -> 12
    recovery_3 = calculate_sm2(recovery_2.resulting_state, "good", now + timedelta(days=8), revision=7)
    assert recovery_3.resulting_state["repetitions"] == 3
    assert recovery_3.resulting_state["interval_days"] == 12
    assert recovery_3.resulting_state["ease_factor"] == 1.96


def test_sm2_ease_factor_floor():
    """Validates that repeated lapses or hard ratings cannot drop EF below 1.30."""
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)
    state = sm2_scheduler.initial_state()

    # Apply 5 consecutive 'again' ratings:
    # 2.50 -> 1.96 -> 1.42 -> 1.30 (clamped) -> 1.30 -> 1.30
    for rev in range(1, 6):
        d = calculate_sm2(state, "again", now, revision=rev)
        state = d.resulting_state

    assert state["ease_factor"] == 1.30
    assert state["repetitions"] == 0
    assert state["interval_days"] == 1
    assert state["lapses"] == 5


def test_sm2_invalid_inputs_and_corrupted_state():
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)

    # Invalid rating
    with pytest.raises(ValueError, match="Invalid recall rating"):
        calculate_sm2({}, "perfect", now)

    # Negative duration
    with pytest.raises(ValueError, match="duration must be non-negative"):
        calculate_sm2({}, "good", now, duration_ms=-10)

    # Invalid revision
    with pytest.raises(ValueError, match="revision must be >= 1"):
        calculate_sm2({}, "good", now, revision=0)

    # Corrupted / legacy state with missing fields and bad numbers
    bad_state = {
        "repetitions": -5,
        "interval_days": 0,
        "ease_factor": 0.8,  # Below floor
        "lapses": "invalid",
    }
    decision = calculate_sm2(bad_state, "good", now, revision=1)
    clean_state = decision.resulting_state
    assert clean_state["ease_factor"] >= 1.30
    assert clean_state["repetitions"] == 1
    assert clean_state["interval_days"] == 1
    assert clean_state["lapses"] == 0


def test_registry_contains_sm2_and_excludes_unimplemented():
    assert registry.is_available("sm2")
    assert registry.is_available("SM2")
    assert "sm2" in registry.list_available()

    # FSRS-6 and FIFAKT are registered; unknown algorithms remain strictly unavailable
    assert registry.is_available("fsrs6")
    assert registry.is_available("fifakt")
    assert not registry.is_available("unknown")
    assert registry.get("unknown") is None


def test_service_record_review_event_mocked():
    from unittest.mock import MagicMock
    from app.modules.spaced_repetition.service import record_review_event
    from app.modules.identity.errors import IdentityError

    # User double
    user = MagicMock()
    user.id = uuid4()
    user.role = "personal_student"

    # Context double
    context = MagicMock()
    context.id = uuid4()
    context.student_id = user.id
    context.kind = "personal"

    # Vocabulary item double
    voc_item = MagicMock()
    voc_item.id = uuid4()
    voc_item.term = "bathala"
    voc_item.meaning = "diyos"
    voc_item.language = "tagalog"

    # Scheduler configuration double
    sched_config = MagicMock()
    sched_config.id = uuid4()
    sched_config.algorithm = "sm2"
    sched_config.implementation_version = "sm2-classic-v1"
    sched_config.configuration_version = 1

    # Mock DB
    db = MagicMock()
    # First call: voc_item, second: context, third: existing_event (None), fourth: sched_config, fifth: state_row (None)
    db.scalar.side_effect = [
        voc_item,      # voc_item lookup
        context,       # get_or_create_learning_context lookup
        None,          # existing_event lookup (no duplicate)
        sched_config,  # sched_config lookup
        None,          # state_row lookup (initial)
    ]

    event_key = uuid4()
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)
    event_input = ReviewEventInput(
        event_key=event_key,
        vocabulary_item_id=voc_item.id,
        recall_rating="good",
        response_duration_ms=1500,
        reviewed_at=now,
        context_type="self_study",
    )

    res = record_review_event(db, user, event_input, algorithm_name="sm2")
    assert res["status"] == "committed"
    assert res["event_key"] == str(event_key)
    assert res["state_revision"] == 2
    assert res["interval_seconds"] == 86400.0


def test_service_replay_idempotency_mocked():
    from unittest.mock import MagicMock
    from app.modules.spaced_repetition.service import record_review_event

    user = MagicMock()
    user.id = uuid4()
    user.role = "personal_student"

    context = MagicMock()
    context.id = uuid4()

    voc_item = MagicMock()
    voc_item.id = uuid4()

    event_key = uuid4()
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)

    existing_event = MagicMock()
    existing_event.event_key = event_key
    existing_event.state_revision = 2
    existing_event.reviewed_at = now

    db = MagicMock()
    db.scalar.side_effect = [
        voc_item,
        context,
        existing_event,  # Duplicate event found!
    ]

    event_input = ReviewEventInput(
        event_key=event_key,
        vocabulary_item_id=voc_item.id,
        recall_rating="good",
        response_duration_ms=1500,
        reviewed_at=now,
        context_type="self_study",
    )

    res = record_review_event(db, user, event_input, algorithm_name="sm2")
    assert res["status"] == "replayed"
    assert res["event_key"] == str(event_key)
    assert res["state_revision"] == 2


def test_service_out_of_order_timestamp_rejected():
    from unittest.mock import MagicMock
    from app.modules.spaced_repetition.service import record_review_event
    from app.modules.identity.errors import IdentityError

    user = MagicMock()
    user.id = uuid4()
    user.role = "personal_student"

    context = MagicMock()
    context.id = uuid4()

    voc_item = MagicMock()
    voc_item.id = uuid4()

    sched_config = MagicMock()
    sched_config.id = uuid4()

    existing_state = MagicMock()
    existing_state.scheduler_configuration_id = sched_config.id
    existing_state.last_reviewed_at = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)

    db = MagicMock()
    db.scalar.side_effect = [
        voc_item,
        context,
        None,
        sched_config,
        existing_state,
    ]

    # Submit an event with timestamp earlier than last_reviewed_at
    earlier = datetime(2026, 10, 19, 11, 0, 0, tzinfo=timezone.utc)
    event_input = ReviewEventInput(
        event_key=uuid4(),
        vocabulary_item_id=voc_item.id,
        recall_rating="good",
        response_duration_ms=1500,
        reviewed_at=earlier,
        context_type="self_study",
    )

    with pytest.raises(IdentityError) as exc_info:
        record_review_event(db, user, event_input, algorithm_name="sm2")
    assert exc_info.value.code == "out_of_order_review"


def test_service_algorithm_conflict_rejected():
    from unittest.mock import MagicMock
    from app.modules.spaced_repetition.service import record_review_event
    from app.modules.identity.errors import IdentityError

    user = MagicMock()
    user.id = uuid4()
    user.role = "personal_student"

    context = MagicMock()
    context.id = uuid4()

    voc_item = MagicMock()
    voc_item.id = uuid4()

    sm2_sched_config = MagicMock()
    sm2_sched_config.id = uuid4()

    existing_fsrs_state = MagicMock()
    existing_fsrs_state.scheduler_configuration_id = uuid4()  # Different config ID!
    existing_fsrs_state.last_reviewed_at = None

    db = MagicMock()
    db.scalar.side_effect = [
        voc_item,
        context,
        None,
        sm2_sched_config,
        existing_fsrs_state,
    ]

    event_input = ReviewEventInput(
        event_key=uuid4(),
        vocabulary_item_id=voc_item.id,
        recall_rating="good",
        response_duration_ms=1500,
        reviewed_at=datetime.now(timezone.utc),
        context_type="self_study",
    )

    with pytest.raises(IdentityError) as exc_info:
        record_review_event(db, user, event_input, algorithm_name="sm2")
    assert exc_info.value.code == "algorithm_conflict"
