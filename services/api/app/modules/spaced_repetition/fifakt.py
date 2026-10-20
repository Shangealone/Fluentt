"""Enhanced Spaced Repetition (ESR) with FIFAKT Knowledge Tracing.

Integrates FSRS-6 memory stability foundations with FIFAKT feature-informed
knowledge tracing to form the Enhanced Spaced Repetition (ESR) scheduling engine.

Scientific Architecture & Constraints:
1. Base Foundation: FSRS-6 provides the baseline Difficulty and Stability dynamics.
2. Knowledge Tracing: FIFAKT analyzes the interaction sequence (response latency,
   repetition patterns, elapsed intervals) to predict current retrievability p_hat.
3. Fusion Rule:
   - Discrepancy: Delta = p_hat - R_fsrs
   - Multiplier: alpha = clamp(0.80, 1.25, 1.0 + kappa * Delta), where kappa = 0.50
   - Lapse Invariant: If rating == 'again', alpha is capped at 1.0 (stability never expands on lapse).
   - Stability: S_esr = clamp(0.001, 36500.0, S_base * alpha)
4. Fallback: If FIFAKT inference fails, execution safely reverts to base FSRS-6 with
   telemetry indicating fallback.
5. Simulated Flag: Explicitly marked as simulated=True per repository instructions.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from app.modules.spaced_repetition.registry import BaseScheduler
from app.modules.spaced_repetition.schemas import (
    AlgorithmIdentity,
    ScheduleDecision,
)
from app.modules.spaced_repetition.fsrs6 import (
    FSRS6_DEFAULT_PARAMETERS,
    DEFAULT_DESIRED_RETENTION,
    DEFAULT_MAXIMUM_INTERVAL_DAYS,
    STABILITY_MIN,
    MIN_DIFFICULTY,
    MAX_DIFFICULTY,
    SECONDS_PER_DAY,
    RATING_MAP,
    calculate_initial_stability,
    calculate_initial_difficulty,
    calculate_next_difficulty,
    calculate_next_recall_stability,
    calculate_next_forget_stability,
    calculate_same_day_stability,
    calculate_retrievability,
    calculate_next_interval,
)
from app.modules.spaced_repetition.fifakt_features import (
    FIFAKTFeatureVector,
    extract_features_from_state,
)
from app.modules.spaced_repetition.fifakt_model import (
    FIFAKTModelInterface,
    SimulatedFIFAKTModel,
)

DEFAULT_FUSION_SENSITIVITY = 0.50
DEFAULT_ADJUSTMENT_MIN = 0.80
DEFAULT_ADJUSTMENT_MAX = 1.25


def calculate_fifakt_esr(
    current_state: dict[str, Any] | None,
    rating: str,
    reviewed_at: datetime,
    duration_ms: int = 0,
    revision: int = 1,
    vocabulary_item_id: UUID | None = None,
    content_version: int = 1,
    parameters: tuple[float, ...] = FSRS6_DEFAULT_PARAMETERS,
    desired_retention: float = DEFAULT_DESIRED_RETENTION,
    max_interval_days: int = DEFAULT_MAXIMUM_INTERVAL_DAYS,
    fusion_sensitivity: float = DEFAULT_FUSION_SENSITIVITY,
    adjustment_min: float = DEFAULT_ADJUSTMENT_MIN,
    adjustment_max: float = DEFAULT_ADJUSTMENT_MAX,
    model: FIFAKTModelInterface | None = None,
) -> ScheduleDecision:
    """Pure, deterministic Enhanced Spaced Repetition (ESR) calculation step."""
    if rating not in RATING_MAP:
        raise ValueError(
            f"Invalid recall rating '{rating}'. Must be one of: {list(RATING_MAP.keys())}"
        )

    if duration_ms < 0:
        raise ValueError(f"Response duration must be non-negative, got {duration_ms} ms")

    if revision < 1:
        raise ValueError(f"State revision must be >= 1, got {revision}")

    if not 0.0001 <= desired_retention <= 0.9999:
        raise ValueError(f"Desired retention must be in (0, 1), got {desired_retention}")

    if reviewed_at.tzinfo is None:
        reviewed_at = reviewed_at.replace(tzinfo=timezone.utc)

    item_id = vocabulary_item_id or uuid4()
    w = parameters
    decay = w[20]
    grade = RATING_MAP[rating]

    state = current_state or {}
    prev_s = state.get("stability")
    prev_d = state.get("difficulty")
    prev_state_str = str(state.get("state", "new"))
    repetitions = max(0, int(state.get("repetitions", 0)))
    lapses = max(0, int(state.get("lapses", 0)))
    consecutive_successes = max(0, int(state.get("consecutive_successes", 0)))
    total_reviews = max(0, int(state.get("total_reviews", 0)))
    total_duration_ms = max(0, int(state.get("total_duration_ms", 0)))
    prev_interval_days = max(0, int(state.get("interval_days", 0)))

    last_rev_str = state.get("last_reviewed_at")
    last_reviewed_at: datetime | None = None
    if last_rev_str:
        try:
            last_reviewed_at = datetime.fromisoformat(last_rev_str)
            if last_reviewed_at.tzinfo is None:
                last_reviewed_at = last_reviewed_at.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            last_reviewed_at = None

    is_new = prev_s is None or prev_d is None or prev_state_str == "new"

    # 1. Base FSRS-6 calculation
    if is_new:
        base_s = calculate_initial_stability(grade, w)
        base_d = calculate_initial_difficulty(grade, w)
        r_fsrs = 1.0

        if grade == 1:
            next_state_str = "learning"
            new_repetitions = 0
            new_lapses = lapses + 1
            new_consecutive_successes = 0
        else:
            next_state_str = "review"
            new_repetitions = 1
            new_lapses = lapses
            new_consecutive_successes = 1
    else:
        s = max(STABILITY_MIN, float(prev_s))
        d = max(MIN_DIFFICULTY, min(MAX_DIFFICULTY, float(prev_d)))

        if last_reviewed_at:
            delta_seconds = max(0.0, (reviewed_at - last_reviewed_at).total_seconds())
            t_days = delta_seconds / SECONDS_PER_DAY
        else:
            t_days = float(prev_interval_days)

        r_fsrs = calculate_retrievability(t_days, s, decay)
        base_d = calculate_next_difficulty(d, grade, w)

        if t_days < 1.0:
            base_s = calculate_same_day_stability(s, grade, w)
            if grade == 1:
                next_state_str = "relearning"
                new_repetitions = 0
                new_lapses = lapses + 1
                new_consecutive_successes = 0
            else:
                next_state_str = "review"
                new_repetitions = repetitions + 1
                new_lapses = lapses
                new_consecutive_successes = consecutive_successes + 1
        else:
            if grade == 1:
                base_s = calculate_next_forget_stability(d, s, r_fsrs, w)
                next_state_str = "relearning"
                new_repetitions = 0
                new_lapses = lapses + 1
                new_consecutive_successes = 0
            else:
                base_s = calculate_next_recall_stability(d, s, r_fsrs, grade, w)
                next_state_str = "review"
                new_repetitions = repetitions + 1
                new_lapses = lapses
                new_consecutive_successes = consecutive_successes + 1

    # 2. Extract FIFAKT feature vector
    features = extract_features_from_state(
        current_state=state,
        current_rating=rating,
        reviewed_at=reviewed_at,
        current_duration_ms=duration_ms,
        vocabulary_item_id=item_id,
        content_version=content_version,
        base_difficulty=base_d,
        base_stability=base_s,
    )

    # 3. Model Inference (FIFAKT)
    active_model = model or SimulatedFIFAKTModel()
    fallback_to_base = False
    try:
        inference = active_model.predict(features)
        hat_p = inference.predicted_retrievability
        mastery = inference.mastery_level
    except Exception:
        # Safe fallback: preserve system stability on unexpected inference failure
        hat_p = r_fsrs if r_fsrs is not None else desired_retention
        mastery = 0.50
        fallback_to_base = True

    # 4. ESR Fusion Logic
    ref_r = r_fsrs if r_fsrs is not None else desired_retention
    delta = hat_p - ref_r
    raw_alpha = 1.0 + fusion_sensitivity * delta
    alpha_clamped = max(adjustment_min, min(adjustment_max, raw_alpha))

    # LAPSE INVARIANT: If lapsed (grade == 1, 'again'), stability must never expand
    if grade == 1:
        alpha_eff = min(1.0, alpha_clamped)
        esr_s = max(STABILITY_MIN, base_s * alpha_eff)
        interval_days = 1
    else:
        alpha_eff = alpha_clamped
        esr_s = max(STABILITY_MIN, min(float(max_interval_days), base_s * alpha_eff))
        interval_days = calculate_next_interval(
            esr_s, desired_retention, decay, max_interval_days
        )

    due_at = reviewed_at + timedelta(days=interval_days)
    prev_interval_seconds = Decimal(str(prev_interval_days * int(SECONDS_PER_DAY)))
    resulting_interval_seconds = Decimal(str(interval_days * int(SECONDS_PER_DAY)))

    resulting_state = {
        "stability": round(esr_s, 4),
        "difficulty": round(base_d, 4),
        "retrievability": round(hat_p, 4),
        "repetitions": new_repetitions,
        "lapses": new_lapses,
        "consecutive_successes": new_consecutive_successes,
        "state": next_state_str,
        "last_reviewed_at": reviewed_at.isoformat(),
        "interval_days": interval_days,
        "total_reviews": total_reviews + 1,
        "total_duration_ms": total_duration_ms + duration_ms,
        "last_rating": rating,
        "fifakt_predicted_retrievability": round(hat_p, 4),
        "fifakt_mastery_level": round(mastery, 4),
        "fifakt_adjustment_factor": round(float(alpha_clamped), 4),
        "fallback_to_base": fallback_to_base,
        "simulated": True,
    }

    return ScheduleDecision(
        algorithm="fifakt",
        implementation_version="fifakt-esr-v1",
        configuration_version=1,
        previous_state=state,
        resulting_state=resulting_state,
        previous_interval_seconds=prev_interval_seconds,
        resulting_interval_seconds=resulting_interval_seconds,
        due_at=due_at,
        state_revision=revision + 1,
    )


class ESRScheduler(BaseScheduler):
    """Enhanced Spaced Repetition (ESR) BaseScheduler adapter combining FSRS-6 with FIFAKT."""

    def __init__(
        self,
        parameters: tuple[float, ...] = FSRS6_DEFAULT_PARAMETERS,
        desired_retention: float = DEFAULT_DESIRED_RETENTION,
        max_interval_days: int = DEFAULT_MAXIMUM_INTERVAL_DAYS,
        fusion_sensitivity: float = DEFAULT_FUSION_SENSITIVITY,
        adjustment_min: float = DEFAULT_ADJUSTMENT_MIN,
        adjustment_max: float = DEFAULT_ADJUSTMENT_MAX,
        model: FIFAKTModelInterface | None = None,
    ):
        self._parameters = parameters
        self._desired_retention = desired_retention
        self._max_interval_days = max_interval_days
        self._fusion_sensitivity = fusion_sensitivity
        self._adjustment_min = adjustment_min
        self._adjustment_max = adjustment_max
        self._model = model or SimulatedFIFAKTModel()

    @property
    def identity(self) -> AlgorithmIdentity:
        return AlgorithmIdentity(
            algorithm="fifakt",
            implementation_version="fifakt-esr-v1",
            configuration_version=1,
            parameters={
                "base_algorithm": "fsrs6",
                "model_name": self._model.model_name,
                "model_version": self._model.model_version,
                "fusion_sensitivity": self._fusion_sensitivity,
                "adjustment_min": self._adjustment_min,
                "adjustment_max": self._adjustment_max,
                "desired_retention": self._desired_retention,
                "max_interval_days": self._max_interval_days,
                "simulated": True,
            },
        )

    @property
    def is_simulated(self) -> bool:
        return True

    def initial_state(self) -> dict[str, Any]:
        """Provides initial state for an unstudied card under ESR."""
        return {
            "stability": None,
            "difficulty": None,
            "retrievability": None,
            "repetitions": 0,
            "lapses": 0,
            "consecutive_successes": 0,
            "state": "new",
            "last_reviewed_at": None,
            "interval_days": 0,
            "total_reviews": 0,
            "total_duration_ms": 0,
            "last_rating": None,
            "fifakt_predicted_retrievability": None,
            "fifakt_mastery_level": None,
            "fifakt_adjustment_factor": 1.0,
            "simulated": True,
        }

    def compute_next_review(
        self,
        current_state: dict[str, Any],
        rating: str,
        reviewed_at: datetime,
        duration_ms: int,
        revision: int,
    ) -> ScheduleDecision:
        return calculate_fifakt_esr(
            current_state=current_state,
            rating=rating,
            reviewed_at=reviewed_at,
            duration_ms=duration_ms,
            revision=revision,
            parameters=self._parameters,
            desired_retention=self._desired_retention,
            max_interval_days=self._max_interval_days,
            fusion_sensitivity=self._fusion_sensitivity,
            adjustment_min=self._adjustment_min,
            adjustment_max=self._adjustment_max,
            model=self._model,
        )


fifakt_esr_scheduler = ESRScheduler()
