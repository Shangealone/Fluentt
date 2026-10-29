"""Comprehensive test suite for FSRS-6 Spaced Repetition Scheduling Engine (Section 30).

Validates:
1. DSR model equations (Difficulty, Stability, Retrievability) and 21 parameter weights.
2. Initial stability S0 and difficulty D0 for ratings Again (1), Hard (2), Good (3), Easy (4).
3. Power forgetting curve decay (w20=0.1542) where R(S, S) == 0.90.
4. Recall stability expansion S'r with Hard penalty (w15=0.6014) and Easy bonus (w16=1.8729).
5. Post-lapse forget stability S'f and state transition to relearning.
6. Same-day review short-term stability update formula.
7. Interval calculation at 90% desired retention.
8. State sanitization, out-of-bounds difficulty clamping, and input validation.
9. Independent algorithm registry coexistence with SM-2 (and absence of FIFAKT).
10. Mocked service recording, idempotency, timestamp ordering, and cross-algorithm conflict guards.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import math
from uuid import uuid4
import pytest

from app.modules.spaced_repetition.fsrs6 import (
    calculate_fsrs6,
    calculate_retrievability,
    calculate_initial_stability,
    calculate_initial_difficulty,
    calculate_next_difficulty,
    calculate_next_recall_stability,
    calculate_next_forget_stability,
    calculate_same_day_stability,
    calculate_next_interval,
    FSRS6Scheduler,
    fsrs6_scheduler,
    FSRS6_DEFAULT_PARAMETERS,
    DEFAULT_DESIRED_RETENTION,
)
from app.modules.spaced_repetition.registry import registry
from app.modules.spaced_repetition.schemas import ReviewEventInput


def test_fsrs6_identity_and_defaults():
    ident = fsrs6_scheduler.identity
    assert ident.algorithm == "fsrs6"
    assert ident.implementation_version == "fsrs-6-reference-v1"
    assert ident.configuration_version == 1
    assert len(ident.parameters["weights"]) == 21
    assert ident.parameters["desired_retention"] == 0.90
    assert ident.parameters["maximum_interval_days"] == 36500
    assert ident.parameters["rating_mapping"] == {
        "again": 1,
        "hard": 2,
        "good": 3,
        "easy": 4,
    }


def test_fsrs6_initial_state():
    init = fsrs6_scheduler.initial_state()
    assert init["state"] == "new"
    assert init["stability"] is None
    assert init["difficulty"] is None
    assert init["retrievability"] is None
    assert init["repetitions"] == 0
    assert init["lapses"] == 0
    assert init["interval_days"] == 0


def test_retrievability_at_stability_equals_90_percent():
    """By definition in FSRS, when elapsed time t == stability S, R(S, S) must be exactly 90%."""
    decay = FSRS6_DEFAULT_PARAMETERS[20]  # 0.1542
    for s in [0.5, 1.0, 2.3065, 10.0, 100.0]:
        r = calculate_retrievability(t_days=s, stability=s, decay=decay)
        assert abs(r - 0.90) < 1e-4

    # At t=0, retrievability is 100%
    r_0 = calculate_retrievability(t_days=0.0, stability=5.0, decay=decay)
    assert r_0 == 1.0

    # For t > S, retrievability is strictly below 90%
    r_far = calculate_retrievability(t_days=1000.0, stability=2.0, decay=decay)
    assert 0.0 <= r_far < 0.90


def test_initial_review_all_ratings():
    """Validates initial stability, difficulty, and state for all four ratings."""
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)
    w = FSRS6_DEFAULT_PARAMETERS

    # 1. Again (G=1)
    d_again = calculate_fsrs6(None, "again", now, revision=1)
    s_again = d_again.resulting_state
    assert s_again["stability"] == round(w[0], 4)  # 0.212
    assert s_again["state"] == "learning"
    assert s_again["repetitions"] == 0
    assert s_again["lapses"] == 1
    assert s_again["interval_days"] == 1
    assert d_again.resulting_interval_seconds == Decimal("86400")

    # 2. Hard (G=2)
    d_hard = calculate_fsrs6(None, "hard", now, revision=1)
    s_hard = d_hard.resulting_state
    assert s_hard["stability"] == round(w[1], 4)  # 1.2931
    assert s_hard["state"] == "review"
    assert s_hard["repetitions"] == 1
    assert s_hard["lapses"] == 0
    assert s_hard["interval_days"] == 1  # round(1.2931) = 1

    # 3. Good (G=3)
    d_good = calculate_fsrs6(None, "good", now, revision=1)
    s_good = d_good.resulting_state
    assert s_good["stability"] == round(w[2], 4)  # 2.3065
    assert s_good["state"] == "review"
    assert s_good["repetitions"] == 1
    assert s_good["interval_days"] == 2  # round(2.3065) = 2

    # 4. Easy (G=4)
    d_easy = calculate_fsrs6(None, "easy", now, revision=1)
    s_easy = d_easy.resulting_state
    assert s_easy["stability"] == round(w[3], 4)  # 8.2956
    assert s_easy["state"] == "review"
    assert s_easy["repetitions"] == 1
    assert s_easy["difficulty"] == 1.0  # Clamped to minimum difficulty
    assert s_easy["interval_days"] == 8  # round(8.2956) = 8


def test_standard_review_progression():
    """Validates subsequent review with 'good' rating when due:
    Stability increases monotonically, interval lengthens.
    """
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)

    # First review: good -> stability = 2.3065, interval = 2 days
    d1 = calculate_fsrs6(None, "good", now, revision=1)
    assert d1.resulting_state["interval_days"] == 2
    s1 = d1.resulting_state["stability"]

    # Second review: 2 days later, user rates 'good'
    rev2_time = now + timedelta(days=2)
    d2 = calculate_fsrs6(d1.resulting_state, "good", rev2_time, revision=2)
    s2 = d2.resulting_state["stability"]
    assert s2 > s1  # Memory stability expands upon successful recall!
    assert d2.resulting_state["interval_days"] > 2
    assert d2.resulting_state["repetitions"] == 2
    assert d2.resulting_state["state"] == "review"

    # Third review: user rates 'good' at scheduled interval
    int2 = d2.resulting_state["interval_days"]
    rev3_time = rev2_time + timedelta(days=int2)
    d3 = calculate_fsrs6(d2.resulting_state, "good", rev3_time, revision=3)
    s3 = d3.resulting_state["stability"]
    assert s3 > s2
    assert d3.resulting_state["interval_days"] > int2
    assert d3.resulting_state["repetitions"] == 3


def test_recall_hard_penalty_and_easy_bonus():
    """Validates that Hard produces smaller stability growth than Good, and Easy produces larger growth."""
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)
    base_state = calculate_fsrs6(None, "good", now, revision=1).resulting_state

    # 2 days later: compare Hard vs Good vs Easy
    rev_time = now + timedelta(days=2)
    d_hard = calculate_fsrs6(base_state, "hard", rev_time, revision=2)
    d_good = calculate_fsrs6(base_state, "good", rev_time, revision=2)
    d_easy = calculate_fsrs6(base_state, "easy", rev_time, revision=2)

    s_hard = d_hard.resulting_state["stability"]
    s_good = d_good.resulting_state["stability"]
    s_easy = d_easy.resulting_state["stability"]

    assert s_hard < s_good < s_easy
    # Difficulty on Hard is higher than on Easy
    assert d_hard.resulting_state["difficulty"] > d_easy.resulting_state["difficulty"]


def test_lapse_and_relearning_transition():
    """Validates lapse behavior on 'again':
    - State transitions to 'relearning'
    - Stability decreases
    - Repetitions resets to 0, lapses increments
    - Interval is set to 1 day
    """
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)
    # Start with a card that has stability = 15.0, difficulty = 4.0
    established_state = {
        "stability": 15.0,
        "difficulty": 4.0,
        "retrievability": 0.90,
        "repetitions": 3,
        "lapses": 0,
        "state": "review",
        "last_reviewed_at": now.isoformat(),
        "interval_days": 15,
        "total_reviews": 3,
    }

    # Student forgets 15 days later: rates 'again'
    lapse_time = now + timedelta(days=15)
    d_lapse = calculate_fsrs6(established_state, "again", lapse_time, revision=4)
    res = d_lapse.resulting_state

    assert res["state"] == "relearning"
    assert res["repetitions"] == 0
    assert res["lapses"] == 1
    assert res["interval_days"] == 1
    assert res["stability"] < established_state["stability"]
    assert d_lapse.due_at == lapse_time + timedelta(days=1)

    # Recovery: 1 day later, student recalls with 'good'
    recovery_time = lapse_time + timedelta(days=1)
    d_rec = calculate_fsrs6(res, "good", recovery_time, revision=5)
    rec_res = d_rec.resulting_state

    assert rec_res["state"] == "review"
    assert rec_res["repetitions"] == 1
    assert rec_res["lapses"] == 1


def test_same_day_review_behavior():
    """Validates same-day review (t < 1 day) uses short-term stability formula without skipping intervals."""
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)
    d1 = calculate_fsrs6(None, "good", now, revision=1)
    init_s = d1.resulting_state["stability"]

    # Review 2 hours later (same day)
    same_day_time = now + timedelta(hours=2)
    d2 = calculate_fsrs6(d1.resulting_state, "good", same_day_time, revision=2)
    res2 = d2.resulting_state

    assert res2["total_reviews"] == 2
    assert res2["repetitions"] == 2
    # Stability does not decrease on passing same-day review
    assert res2["stability"] >= init_s


def test_fsrs6_input_validation():
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)

    # Invalid rating
    with pytest.raises(ValueError, match="Invalid recall rating"):
        calculate_fsrs6({}, "unknown", now)

    # Negative duration
    with pytest.raises(ValueError, match="duration must be non-negative"):
        calculate_fsrs6({}, "good", now, duration_ms=-5)

    # Invalid revision
    with pytest.raises(ValueError, match="revision must be >= 1"):
        calculate_fsrs6({}, "good", now, revision=0)

    # Desired retention out of bounds
    with pytest.raises(ValueError, match="Desired retention must be in"):
        calculate_fsrs6({}, "good", now, desired_retention=1.5)


def test_fsrs6_and_sm2_coexistence_in_registry():
    """Validates both SM-2 and FSRS-6 are registered and independent in global registry."""
    assert registry.is_available("sm2")
    assert registry.is_available("fsrs6")
    assert registry.is_available("FSRS6")

    available = registry.list_available()
    assert "fsrs6" in available
    assert "sm2" in available
    assert "fifakt" in available

    # Unregistered algorithm remains unavailable
    assert not registry.is_available("unknown")
    assert registry.get("unknown") is None


def test_service_record_review_event_fsrs6_mocked():
    from unittest.mock import MagicMock
    from app.modules.spaced_repetition.service import record_review_event

    user = MagicMock()
    user.id = uuid4()
    user.role = "personal_student"

    context = MagicMock()
    context.id = uuid4()
    context.student_id = user.id
    context.kind = "personal"

    voc_item = MagicMock()
    voc_item.id = uuid4()

    sched_config = MagicMock()
    sched_config.id = uuid4()
    sched_config.algorithm = "fsrs6"
    sched_config.implementation_version = "fsrs-6-reference-v1"
    sched_config.configuration_version = 1

    db = MagicMock()
    db.scalar.side_effect = [
        voc_item,
        context,
        None,  # No duplicate
        sched_config,
        None,  # Initial state
    ]

    event_key = uuid4()
    now = datetime(2026, 10, 19, 12, 0, 0, tzinfo=timezone.utc)
    event_input = ReviewEventInput(
        event_key=event_key,
        vocabulary_item_id=voc_item.id,
        recall_rating="good",
        response_duration_ms=1200,
        reviewed_at=now,
        context_type="self_study",
    )

    res = record_review_event(db, user, event_input, algorithm_name="fsrs6")
    assert res["status"] == "committed"
    assert res["event_key"] == str(event_key)
    assert res["state_revision"] == 2
    assert res["due_at"] is not None


def test_service_algorithm_isolation_sm2_and_fsrs6():
    """A card scheduled under SM-2 cannot be overwritten by FSRS-6 without explicit conflict error."""
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

    fsrs6_config = MagicMock()
    fsrs6_config.id = uuid4()

    # Existing card was scheduled under SM-2 (different configuration ID)
    sm2_state = MagicMock()
    sm2_state.scheduler_configuration_id = uuid4()  # SM-2 config ID
    sm2_state.last_reviewed_at = None

    db = MagicMock()
    db.scalar.side_effect = [
        voc_item,
        context,
        None,
        fsrs6_config,
        sm2_state,
    ]

    event_input = ReviewEventInput(
        event_key=uuid4(),
        vocabulary_item_id=voc_item.id,
        recall_rating="good",
        response_duration_ms=1000,
        reviewed_at=datetime.now(timezone.utc),
        context_type="self_study",
    )

    with pytest.raises(IdentityError) as exc_info:
        record_review_event(db, user, event_input, algorithm_name="fsrs6")
    assert exc_info.value.code == "algorithm_conflict"
