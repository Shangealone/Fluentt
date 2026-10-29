"""Section 31: FIFAKT Knowledge Tracing and Enhanced Spaced Repetition (ESR) Tests.

Comprehensive validation covering:
1. Feature extraction pipeline (state-based and historical stream).
2. Strict future-data leakage prevention and chronological sorting.
3. Missing-data resilience and boundary validation.
4. FIFAKT model contract, simulated reference adapter, and uncertainty estimation.
5. ESR stability fusion rules, bounded adjustment factors, and lapse invariants.
6. Safe fallback to base FSRS-6 when model inference fails.
7. Algorithm registry integration, case insensitivity, and coexistence with SM-2/FSRS-6.
8. Service-level persistence, ModelVersion/ModelConfiguration creation, and state isolation.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import UUID, uuid4
import pytest

from app.modules.spaced_repetition.fifakt_features import (
    FIFAKTFeatureVector,
    extract_features_from_state,
    extract_features_from_event_history,
)
from app.modules.spaced_repetition.fifakt_model import (
    FIFAKTInferenceOutput,
    FIFAKTModelInterface,
    SimulatedFIFAKTModel,
)
from app.modules.spaced_repetition.fifakt import (
    calculate_fifakt_esr,
    ESRScheduler,
    fifakt_esr_scheduler,
    DEFAULT_FUSION_SENSITIVITY,
    DEFAULT_ADJUSTMENT_MIN,
    DEFAULT_ADJUSTMENT_MAX,
)
from app.modules.spaced_repetition.registry import registry
from app.modules.spaced_repetition.schemas import ReviewEventInput
from app.modules.spaced_repetition.service import record_review_event, get_due_reviews
from app.modules.identity.errors import IdentityError


# ---------------------------------------------------------------------------
# 1. Feature Extraction Pipeline & Leakage Prevention Tests
# ---------------------------------------------------------------------------


def test_fifakt_feature_vector_validation():
    card_id = uuid4()
    fv = FIFAKTFeatureVector(
        vocabulary_item_id=card_id,
        content_version=1,
        total_reviews=3,
        total_lapses=1,
        consecutive_successes=2,
        prior_success_rate=0.6667,
        elapsed_seconds=86400.0,
        avg_response_duration_ms=2500.0,
        current_response_duration_ms=1800,
        last_rating="good",
        current_rating="easy",
        card_difficulty=5.2,
        card_stability=4.5,
    )
    assert fv.vocabulary_item_id == card_id
    assert fv.total_reviews == 3
    assert fv.total_lapses == 1
    assert fv.consecutive_successes == 2
    assert fv.current_rating == "easy"
    assert fv.last_rating == "good"


def test_extract_features_from_state_new_card():
    card_id = uuid4()
    now = datetime(2026, 10, 19, 10, 0, 0, tzinfo=timezone.utc)
    fv = extract_features_from_state(
        current_state=None,
        current_rating="good",
        reviewed_at=now,
        current_duration_ms=2100,
        vocabulary_item_id=card_id,
    )
    assert fv.vocabulary_item_id == card_id
    assert fv.total_reviews == 0
    assert fv.total_lapses == 0
    assert fv.consecutive_successes == 0
    assert fv.prior_success_rate == 0.0
    assert fv.elapsed_seconds == 0.0
    assert fv.avg_response_duration_ms == 2100.0
    assert fv.last_rating is None
    assert fv.current_rating == "good"


def test_extract_features_from_state_subsequent_review():
    card_id = uuid4()
    last_rev = datetime(2026, 10, 17, 10, 0, 0, tzinfo=timezone.utc)
    now = datetime(2026, 10, 19, 10, 0, 0, tzinfo=timezone.utc)
    state = {
        "stability": 4.5,
        "difficulty": 6.0,
        "repetitions": 2,
        "lapses": 1,
        "consecutive_successes": 2,
        "total_reviews": 3,
        "total_duration_ms": 7500,
        "last_reviewed_at": last_rev.isoformat(),
        "last_rating": "good",
    }
    fv = extract_features_from_state(
        current_state=state,
        current_rating="hard",
        reviewed_at=now,
        current_duration_ms=3200,
        vocabulary_item_id=card_id,
    )
    assert fv.total_reviews == 3
    assert fv.total_lapses == 1
    assert fv.consecutive_successes == 2
    assert abs(fv.prior_success_rate - (2 / 3.0)) < 1e-4
    assert fv.elapsed_seconds == 172800.0  # 2 days
    assert fv.avg_response_duration_ms == 2500.0
    assert fv.last_rating == "good"
    assert fv.current_rating == "hard"
    assert fv.card_difficulty == 6.0
    assert fv.card_stability == 4.5


def test_leakage_prevention_in_event_history():
    """Validates that historical feature extraction strictly excludes future and simultaneous events."""
    card_id = uuid4()
    t1 = datetime(2026, 10, 10, 12, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 10, 12, 12, 0, 0, tzinfo=timezone.utc)
    t3 = datetime(2026, 10, 15, 12, 0, 0, tzinfo=timezone.utc)  # target evaluation time
    t4 = datetime(2026, 10, 18, 12, 0, 0, tzinfo=timezone.utc)  # FUTURE event relative to t3

    events = [
        {"reviewed_at": t4, "recall_rating": "easy", "response_duration_ms": 1000, "state_revision": 4},
        {"reviewed_at": t1, "recall_rating": "again", "response_duration_ms": 4000, "state_revision": 1},
        {"reviewed_at": t3, "recall_rating": "good", "response_duration_ms": 2000, "state_revision": 3},  # simultaneous with target
        {"reviewed_at": t2, "recall_rating": "good", "response_duration_ms": 2500, "state_revision": 2},
    ]

    # Extract as of t3: only t1 and t2 should be included!
    fv = extract_features_from_event_history(
        events=events,
        as_of=t3,
        vocabulary_item_id=card_id,
        current_rating="good",
        current_duration_ms=2200,
    )

    assert fv.total_reviews == 2  # t1 and t2 only
    assert fv.total_lapses == 1  # t1 was 'again'
    assert fv.consecutive_successes == 1  # t2 was 'good'
    assert fv.prior_success_rate == 0.5
    assert fv.last_rating == "good"  # t2 rating
    assert fv.elapsed_seconds == (t3 - t2).total_seconds()  # 3 days = 259200s
    assert fv.avg_response_duration_ms == (4000 + 2500) / 2.0


def test_chronological_ordering_and_deterministic_reproducibility():
    card_id = uuid4()
    t1 = datetime(2026, 10, 1, 10, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 10, 3, 10, 0, 0, tzinfo=timezone.utc)
    t3 = datetime(2026, 10, 7, 10, 0, 0, tzinfo=timezone.utc)
    as_of = datetime(2026, 10, 10, 10, 0, 0, tzinfo=timezone.utc)

    events_forward = [
        {"reviewed_at": t1, "recall_rating": "good", "response_duration_ms": 2000, "state_revision": 1},
        {"reviewed_at": t2, "recall_rating": "hard", "response_duration_ms": 3000, "state_revision": 2},
        {"reviewed_at": t3, "recall_rating": "easy", "response_duration_ms": 1500, "state_revision": 3},
    ]
    events_shuffled = [events_forward[2], events_forward[0], events_forward[1]]

    fv1 = extract_features_from_event_history(
        events_forward, as_of, card_id, "good", 1800
    )
    fv2 = extract_features_from_event_history(
        events_shuffled, as_of, card_id, "good", 1800
    )

    assert fv1 == fv2
    assert fv1.total_reviews == 3
    assert fv1.consecutive_successes == 3
    assert fv1.last_rating == "easy"


# ---------------------------------------------------------------------------
# 2. FIFAKT Model Contract & Simulated Reference Adapter Tests
# ---------------------------------------------------------------------------


def test_simulated_fifakt_model_contract():
    model = SimulatedFIFAKTModel()
    assert model.model_name == "fifakt"
    assert model.model_version == "fifakt-simulated-v1"
    assert model.is_simulated is True

    card_id = uuid4()
    fv = FIFAKTFeatureVector(
        vocabulary_item_id=card_id,
        content_version=1,
        total_reviews=5,
        total_lapses=0,
        consecutive_successes=5,
        prior_success_rate=1.0,
        elapsed_seconds=86400.0,
        avg_response_duration_ms=2000.0,
        current_response_duration_ms=1500,
        last_rating="good",
        current_rating="good",
        card_difficulty=4.0,
        card_stability=6.0,
    )

    out = model.predict(fv)
    assert isinstance(out, FIFAKTInferenceOutput)
    assert out.simulated is True
    assert out.model_name == "fifakt"
    assert out.model_version == "fifakt-simulated-v1"
    assert 0.01 <= out.predicted_retrievability <= 0.99
    assert 0.01 <= out.mastery_level <= 0.99
    assert 0.01 <= out.uncertainty <= 1.0
    assert out.fallback_to_base is False
    assert out.metadata["uncalibrated"] is True


def test_simulated_model_rating_differentiation():
    model = SimulatedFIFAKTModel()
    card_id = uuid4()

    def make_fv(rating: str, duration_ms: int = 2000):
        return FIFAKTFeatureVector(
            vocabulary_item_id=card_id,
            total_reviews=2,
            total_lapses=0,
            consecutive_successes=2,
            prior_success_rate=1.0,
            elapsed_seconds=86400.0,
            avg_response_duration_ms=2000.0,
            current_response_duration_ms=duration_ms,
            current_rating=rating,  # type: ignore[arg-type]
            card_difficulty=5.0,
            card_stability=3.0,
        )

    out_again = model.predict(make_fv("again"))
    out_hard = model.predict(make_fv("hard"))
    out_good = model.predict(make_fv("good"))
    out_easy = model.predict(make_fv("easy"))

    # Lapse rating 'again' must produce lower retrievability than 'easy'
    assert out_again.predicted_retrievability < out_hard.predicted_retrievability
    assert out_hard.predicted_retrievability < out_good.predicted_retrievability
    assert out_good.predicted_retrievability <= out_easy.predicted_retrievability


def test_simulated_model_latency_effect():
    model = SimulatedFIFAKTModel()
    card_id = uuid4()

    fv_fluent = FIFAKTFeatureVector(
        vocabulary_item_id=card_id,
        total_reviews=4,
        total_lapses=0,
        consecutive_successes=4,
        prior_success_rate=1.0,
        elapsed_seconds=86400.0,
        avg_response_duration_ms=1800.0,
        current_response_duration_ms=1200,  # fast fluent recall
        current_rating="good",
        card_difficulty=4.0,
        card_stability=5.0,
    )
    fv_hesitant = FIFAKTFeatureVector(
        vocabulary_item_id=card_id,
        total_reviews=4,
        total_lapses=0,
        consecutive_successes=4,
        prior_success_rate=1.0,
        elapsed_seconds=86400.0,
        avg_response_duration_ms=1800.0,
        current_response_duration_ms=12000,  # hesitant recall (> 8s)
        current_rating="good",
        card_difficulty=4.0,
        card_stability=5.0,
    )

    out_fluent = model.predict(fv_fluent)
    out_hesitant = model.predict(fv_hesitant)

    assert out_fluent.predicted_retrievability > out_hesitant.predicted_retrievability


# ---------------------------------------------------------------------------
# 3. Enhanced Spaced Repetition (ESR) Fusion Logic Tests
# ---------------------------------------------------------------------------


def test_esr_initial_review_good():
    now = datetime(2026, 10, 19, 10, 0, 0, tzinfo=timezone.utc)
    decision = calculate_fifakt_esr(
        current_state=None,
        rating="good",
        reviewed_at=now,
        duration_ms=2000,
        revision=1,
    )
    assert decision.algorithm == "fifakt"
    assert decision.implementation_version == "fifakt-esr-v1"
    assert decision.configuration_version == 1

    res = decision.resulting_state
    assert res["state"] == "review"
    assert res["repetitions"] == 1
    assert res["lapses"] == 0
    assert res["consecutive_successes"] == 1
    assert res["total_reviews"] == 1
    assert res["simulated"] is True
    assert res["fifakt_predicted_retrievability"] is not None
    assert res["fifakt_mastery_level"] is not None
    assert DEFAULT_ADJUSTMENT_MIN <= res["fifakt_adjustment_factor"] <= DEFAULT_ADJUSTMENT_MAX
    assert res["interval_days"] >= 1
    assert decision.due_at == now + timedelta(days=res["interval_days"])


def test_esr_lapse_invariants():
    """On rating 'again', stability must never expand (alpha_eff <= 1.0) and interval must be 1 day."""
    now = datetime(2026, 10, 19, 10, 0, 0, tzinfo=timezone.utc)
    state = {
        "stability": 8.0,
        "difficulty": 5.0,
        "repetitions": 3,
        "lapses": 0,
        "consecutive_successes": 3,
        "state": "review",
        "last_reviewed_at": (now - timedelta(days=8)).isoformat(),
        "interval_days": 8,
        "total_reviews": 3,
        "total_duration_ms": 6000,
        "last_rating": "good",
    }

    decision = calculate_fifakt_esr(
        current_state=state,
        rating="again",
        reviewed_at=now,
        duration_ms=3000,
        revision=4,
    )
    res = decision.resulting_state
    assert res["state"] == "relearning"
    assert res["repetitions"] == 0
    assert res["lapses"] == 1
    assert res["consecutive_successes"] == 0
    assert res["interval_days"] == 1  # Lapses always reset to 1 day
    # Stability after lapse must be lower than prior stability
    assert res["stability"] < 8.0


def test_esr_adjustment_bounds():
    """Verify that stability adjustment factor strictly respects [adjustment_min, adjustment_max]."""
    now = datetime(2026, 10, 19, 10, 0, 0, tzinfo=timezone.utc)
    state = {
        "stability": 5.0,
        "difficulty": 4.0,
        "repetitions": 2,
        "lapses": 0,
        "consecutive_successes": 2,
        "state": "review",
        "last_reviewed_at": (now - timedelta(days=5)).isoformat(),
        "interval_days": 5,
        "total_reviews": 2,
        "total_duration_ms": 4000,
        "last_rating": "good",
    }

    # Test with custom mock model returning extreme high retention (1.0)
    class HighRetrievabilityModel(FIFAKTModelInterface):
        @property
        def model_name(self) -> str:
            return "high-mock"

        @property
        def model_version(self) -> str:
            return "v1"

        @property
        def is_simulated(self) -> bool:
            return True

        def predict(self, features: FIFAKTFeatureVector) -> FIFAKTInferenceOutput:
            return FIFAKTInferenceOutput(
                predicted_retrievability=0.99,
                mastery_level=0.99,
                uncertainty=0.05,
                model_name=self.model_name,
                model_version=self.model_version,
                simulated=True,
            )

    decision_high = calculate_fifakt_esr(
        current_state=state,
        rating="easy",
        reviewed_at=now,
        duration_ms=1000,
        revision=3,
        model=HighRetrievabilityModel(),
    )
    # Adjustment factor clamped at 1.25 maximum
    assert decision_high.resulting_state["fifakt_adjustment_factor"] <= 1.25

    # Test with custom mock model returning extreme low retention (0.01)
    class LowRetrievabilityModel(FIFAKTModelInterface):
        @property
        def model_name(self) -> str:
            return "low-mock"

        @property
        def model_version(self) -> str:
            return "v1"

        @property
        def is_simulated(self) -> bool:
            return True

        def predict(self, features: FIFAKTFeatureVector) -> FIFAKTInferenceOutput:
            return FIFAKTInferenceOutput(
                predicted_retrievability=0.01,
                mastery_level=0.10,
                uncertainty=0.90,
                model_name=self.model_name,
                model_version=self.model_version,
                simulated=True,
            )

    decision_low = calculate_fifakt_esr(
        current_state=state,
        rating="hard",
        reviewed_at=now,
        duration_ms=4000,
        revision=3,
        model=LowRetrievabilityModel(),
    )
    # Adjustment factor clamped at 0.80 minimum
    assert decision_low.resulting_state["fifakt_adjustment_factor"] >= 0.80


def test_esr_safe_fallback_on_model_exception():
    """Verify that if FIFAKT inference fails, ESR safely falls back to base FSRS-6 without crashing."""
    now = datetime(2026, 10, 19, 10, 0, 0, tzinfo=timezone.utc)
    state = {
        "stability": 4.0,
        "difficulty": 5.0,
        "repetitions": 1,
        "lapses": 0,
        "consecutive_successes": 1,
        "state": "review",
        "last_reviewed_at": (now - timedelta(days=4)).isoformat(),
        "interval_days": 4,
        "total_reviews": 1,
        "total_duration_ms": 2000,
        "last_rating": "good",
    }

    class FailingModel(FIFAKTModelInterface):
        @property
        def model_name(self) -> str:
            return "failing"

        @property
        def model_version(self) -> str:
            return "v1"

        @property
        def is_simulated(self) -> bool:
            return True

        def predict(self, features: FIFAKTFeatureVector) -> FIFAKTInferenceOutput:
            raise RuntimeError("Inference backend unavailable")

    decision = calculate_fifakt_esr(
        current_state=state,
        rating="good",
        reviewed_at=now,
        duration_ms=2000,
        revision=2,
        model=FailingModel(),
    )
    res = decision.resulting_state
    assert res["fallback_to_base"] is True
    assert res["state"] == "review"
    assert res["repetitions"] == 2
    assert res["interval_days"] >= 4


def test_esr_input_validation():
    now = datetime.now(timezone.utc)
    with pytest.raises(ValueError, match="Invalid recall rating"):
        calculate_fifakt_esr(None, "unsupported_rating", now)

    with pytest.raises(ValueError, match="Response duration must be non-negative"):
        calculate_fifakt_esr(None, "good", now, duration_ms=-10)

    with pytest.raises(ValueError, match="State revision must be >= 1"):
        calculate_fifakt_esr(None, "good", now, revision=0)

    with pytest.raises(ValueError, match="Desired retention must be in"):
        calculate_fifakt_esr(None, "good", now, desired_retention=1.2)


# ---------------------------------------------------------------------------
# 4. Registry Integration & Coexistence Tests
# ---------------------------------------------------------------------------


def test_fifakt_in_registry():
    assert registry.is_available("fifakt")
    assert registry.is_available("FIFAKT")
    assert registry.is_available("sm2")
    assert registry.is_available("fsrs6")

    available = registry.list_available()
    assert available == ["fifakt", "fsrs6", "sm2"]

    fifakt_sched = registry.get("fifakt")
    assert isinstance(fifakt_sched, ESRScheduler)
    assert fifakt_sched.identity.algorithm == "fifakt"
    assert fifakt_sched.identity.implementation_version == "fifakt-esr-v1"
    assert fifakt_sched.is_simulated is True


# ---------------------------------------------------------------------------
# 5. Service & State Isolation Tests (Mocked DB)
# ---------------------------------------------------------------------------


def test_service_record_review_event_fifakt_mocked():
    user = MagicMock()
    user.id = uuid4()
    user.role = "student"

    voc_id = uuid4()
    now = datetime(2026, 10, 19, 10, 0, 0, tzinfo=timezone.utc)
    event_input = ReviewEventInput(
        event_key=uuid4(),
        vocabulary_item_id=voc_id,
        recall_rating="good",
        response_duration_ms=1800,
        reviewed_at=now,
        context_type="self_study",
    )

    voc_item = MagicMock()
    voc_item.id = voc_id

    context = MagicMock()
    context.id = uuid4()

    db = MagicMock()

    # Query dispatch
    def mock_scalar(query):
        sql = str(query)
        if "learning_contexts" in sql:
            return context
        if "vocabulary_review_events" in sql and "event_key" in sql:
            return None  # No existing duplicate event
        if "vocabulary_items" in sql:
            return voc_item
        if "model_versions" in sql:
            return None  # Will create ModelVersion
        if "model_configurations" in sql:
            return None  # Will create ModelConfiguration
        if "scheduler_configurations" in sql:
            return None  # Will create SchedulerConfiguration
        if "vocabulary_review_states" in sql:
            return None  # Will create initial state
        return None

    db.scalar.side_effect = mock_scalar

    res = record_review_event(db, user, event_input, algorithm_name="fifakt")
    assert res["status"] == "committed"
    assert res["event_key"] == str(event_input.event_key)
    assert res["state_revision"] == 2
    assert "due_at" in res
    assert "interval_seconds" in res


def test_service_algorithm_isolation_sm2_fsrs6_fifakt():
    """Verify that a card initialized under SM-2 or FSRS-6 cannot be updated under FIFAKT."""
    user = MagicMock()
    user.id = uuid4()
    user.role = "student"

    voc_id = uuid4()
    now = datetime(2026, 10, 19, 10, 0, 0, tzinfo=timezone.utc)
    event_input = ReviewEventInput(
        event_key=uuid4(),
        vocabulary_item_id=voc_id,
        recall_rating="good",
        response_duration_ms=1500,
        reviewed_at=now,
    )

    context = MagicMock()
    context.id = uuid4()

    sm2_config = MagicMock()
    sm2_config.id = uuid4()
    sm2_config.algorithm = "sm2"

    fifakt_config = MagicMock()
    fifakt_config.id = uuid4()
    fifakt_config.algorithm = "fifakt"

    existing_state = MagicMock()
    existing_state.scheduler_configuration_id = sm2_config.id  # Card bound to SM-2
    existing_state.state = {"repetitions": 1}
    existing_state.revision = 2
    existing_state.last_reviewed_at = now - timedelta(days=1)

    db = MagicMock()

    def mock_scalar(query):
        sql = str(query)
        if "learning_contexts" in sql:
            return context
        if "vocabulary_items" in sql:
            return MagicMock()
        if "scheduler_configurations" in sql:
            return fifakt_config
        if "vocabulary_review_events" in sql:
            return None
        if "vocabulary_review_states" in sql:
            return existing_state
        return None

    db.scalar.side_effect = mock_scalar

    # Attempting to submit review with 'fifakt' on SM-2 card must raise 409 algorithm_conflict
    with pytest.raises(IdentityError) as exc_info:
        record_review_event(db, user, event_input, algorithm_name="fifakt")

    assert exc_info.value.status == 409
    assert exc_info.value.code == "algorithm_conflict"


