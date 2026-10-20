"""Free Spaced Repetition Scheduler - Version 6 (FSRS-6) Engine.

Deterministic, pure-calculation engine and BaseScheduler adapter implementing the
approved open-spaced-repetition FSRS-6 specification (DSR model with 21 parameters).

Specifications & Reference Alignment:
1. Ratings:
   - "again": Grade 1 (complete failure / lapse)
   - "hard":  Grade 2 (recalled with serious difficulty)
   - "good":  Grade 3 (successful recall after hesitation)
   - "easy":  Grade 4 (effortless / immediate recall)

2. Model Weights (21 parameters w[0]..w[20]):
   - w[0]..w[3]:   Initial stability S0 for grades 1..4 (0.212, 1.2931, 2.3065, 8.2956)
   - w[4]..w[5]:   Initial difficulty D0 baseline and scale (6.4133, 0.8334)
   - w[6]..w[7]:   Difficulty delta damping and mean-reversion toward D0(4) (3.0194, 0.001)
   - w[8]..w[10]:  Recall stability expansion scaling and retrievability factor (1.8722, 0.1666, 0.796)
   - w[11]..w[14]: Post-lapse forget stability penalty scaling (1.4835, 0.0614, 0.2629, 1.6483)
   - w[15]..w[16]: Hard penalty and Easy bonus multipliers (0.6014, 1.8729)
   - w[17]..w[19]: Same-day review short-term stability update parameters (0.5425, 0.0912, 0.0658)
   - w[20]:        Forgetting curve decay parameter (0.1542)

3. Forgetting Curve:
   R(t, S) = (1 + factor * (t / S))^(-w[20]), where factor = 0.9^(-1 / w[20]) - 1

4. Next Interval:
   I(r, S) = (S / factor) * (r^(-1 / w[20]) - 1). For r = 0.90, I = S.

5. State Representation:
   {
       "stability": float,
       "difficulty": float,
       "retrievability": float,
       "repetitions": int,
       "lapses": int,
       "state": str,  # "new", "learning", "review", "relearning"
       "last_reviewed_at": str | None,
       "interval_days": int,
       "total_reviews": int,
       "last_rating": str | None
   }
"""

import math
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from app.modules.spaced_repetition.registry import BaseScheduler
from app.modules.spaced_repetition.schemas import (
    AlgorithmIdentity,
    ScheduleDecision,
)

# Canonical 21-element FSRS-6 default parameters
FSRS6_DEFAULT_PARAMETERS: tuple[float, ...] = (
    0.212,
    1.2931,
    2.3065,
    8.2956,
    6.4133,
    0.8334,
    3.0194,
    0.001,
    1.8722,
    0.1666,
    0.796,
    1.4835,
    0.0614,
    0.2629,
    1.6483,
    0.6014,
    1.8729,
    0.5425,
    0.0912,
    0.0658,
    0.1542,
)

DEFAULT_DESIRED_RETENTION = 0.90
DEFAULT_MAXIMUM_INTERVAL_DAYS = 36500
STABILITY_MIN = 0.001
MIN_DIFFICULTY = 1.0
MAX_DIFFICULTY = 10.0
SECONDS_PER_DAY = 86400

RATING_MAP: dict[str, int] = {
    "again": 1,
    "hard": 2,
    "good": 3,
    "easy": 4,
}


def round_half_up(value: float | Decimal) -> int:
    d = Decimal(str(value))
    return int(d.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def compute_factor(decay: float) -> float:
    return math.pow(0.9, -1.0 / decay) - 1.0


def calculate_retrievability(t_days: float, stability: float, decay: float) -> float:
    """Calculates retrievability R(t, S) via power forgetting curve."""
    if stability <= 0.0:
        return 0.0
    if t_days <= 0.0:
        return 1.0
    factor = compute_factor(decay)
    r = math.pow(1.0 + factor * (t_days / stability), -decay)
    return max(0.0, min(1.0, r))


def calculate_initial_stability(grade: int, w: tuple[float, ...]) -> float:
    """S0(G) = w[G-1]."""
    return max(STABILITY_MIN, float(w[grade - 1]))


def calculate_initial_difficulty(grade: int, w: tuple[float, ...]) -> float:
    """D0(G) = w[4] - exp(w[5] * (G - 1)) + 1."""
    d0 = w[4] - math.exp(w[5] * (grade - 1)) + 1.0
    return max(MIN_DIFFICULTY, min(MAX_DIFFICULTY, d0))


def calculate_next_difficulty(d: float, grade: int, w: tuple[float, ...]) -> float:
    """Updates difficulty with linear damping and mean reversion toward D0(4)."""
    delta_d = -w[6] * (grade - 3)
    d_prime = d + delta_d * (10.0 - d) / 9.0
    d0_4 = w[4] - math.exp(w[5] * 3.0) + 1.0
    d_next = w[7] * d0_4 + (1.0 - w[7]) * d_prime
    return max(MIN_DIFFICULTY, min(MAX_DIFFICULTY, d_next))


def calculate_next_recall_stability(
    d: float,
    s: float,
    r: float,
    grade: int,
    w: tuple[float, ...],
) -> float:
    """S'r = S * SInc after successful recall (grade >= 2)."""
    hard_factor = w[15] if grade == 2 else 1.0
    easy_factor = w[16] if grade == 4 else 1.0
    s_inc = (
        1.0
        + math.exp(w[8])
        * (11.0 - d)
        * math.pow(s, -w[9])
        * (math.exp(w[10] * (1.0 - r)) - 1.0)
        * hard_factor
        * easy_factor
    )
    s_next = s * s_inc
    return max(s, s_next)


def calculate_next_forget_stability(
    d: float,
    s: float,
    r: float,
    w: tuple[float, ...],
) -> float:
    """S'f after lapse (grade == 1)."""
    s_f = (
        w[11]
        * math.pow(d, -w[12])
        * (math.pow(s + 1.0, w[13]) - 1.0)
        * math.exp(w[14] * (1.0 - r))
    )
    return max(STABILITY_MIN, min(s, s_f))


def calculate_same_day_stability(
    s: float,
    grade: int,
    w: tuple[float, ...],
) -> float:
    """S'(S, G) = S * exp(w[17] * (G - 3 + w[18])) * S^(-w[19])."""
    s_inc = math.exp(w[17] * (grade - 3.0 + w[18])) * math.pow(s, -w[19])
    if grade >= 2:
        return max(s, s * s_inc)
    return max(STABILITY_MIN, min(s, s * s_inc))


def calculate_next_interval(
    stability: float,
    desired_retention: float,
    decay: float,
    max_interval: int = DEFAULT_MAXIMUM_INTERVAL_DAYS,
) -> int:
    """I(r, S) = (S / factor) * (r^(-1 / decay) - 1)."""
    if stability <= 0.0:
        return 1
    factor = compute_factor(decay)
    raw_interval = (stability / factor) * (math.pow(desired_retention, -1.0 / decay) - 1.0)
    int_days = max(1, round_half_up(raw_interval))
    return min(max_interval, int_days)


def calculate_fsrs6(
    current_state: dict[str, Any] | None,
    rating: str,
    reviewed_at: datetime,
    duration_ms: int = 0,
    revision: int = 1,
    parameters: tuple[float, ...] = FSRS6_DEFAULT_PARAMETERS,
    desired_retention: float = DEFAULT_DESIRED_RETENTION,
    max_interval_days: int = DEFAULT_MAXIMUM_INTERVAL_DAYS,
) -> ScheduleDecision:
    """Pure, deterministic FSRS-6 calculation step."""
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

    w = parameters
    decay = w[20]
    grade = RATING_MAP[rating]

    state = current_state or {}
    prev_s = state.get("stability")
    prev_d = state.get("difficulty")
    prev_state_str = str(state.get("state", "new"))
    repetitions = max(0, int(state.get("repetitions", 0)))
    lapses = max(0, int(state.get("lapses", 0)))
    total_reviews = max(0, int(state.get("total_reviews", 0)))
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

    if is_new:
        # First encounter with this card
        new_s = calculate_initial_stability(grade, w)
        new_d = calculate_initial_difficulty(grade, w)
        cur_r = 1.0

        if grade == 1:
            next_state_str = "learning"
            new_repetitions = 0
            new_lapses = lapses + 1
            interval_days = 1
        else:
            next_state_str = "review"
            new_repetitions = 1
            new_lapses = lapses
            interval_days = calculate_next_interval(
                new_s, desired_retention, decay, max_interval_days
            )

    else:
        s = max(STABILITY_MIN, float(prev_s))
        d = max(MIN_DIFFICULTY, min(MAX_DIFFICULTY, float(prev_d)))

        # Calculate elapsed days
        if last_reviewed_at:
            delta_seconds = max(0.0, (reviewed_at - last_reviewed_at).total_seconds())
            t_days = delta_seconds / SECONDS_PER_DAY
        else:
            t_days = float(prev_interval_days)

        cur_r = calculate_retrievability(t_days, s, decay)
        new_d = calculate_next_difficulty(d, grade, w)

        # Same-day review check (< 1 day elapsed)
        if t_days < 1.0:
            new_s = calculate_same_day_stability(s, grade, w)
            if grade == 1:
                next_state_str = "relearning"
                new_repetitions = 0
                new_lapses = lapses + 1
                interval_days = 1
            else:
                next_state_str = "review"
                new_repetitions = repetitions + 1
                new_lapses = lapses
                interval_days = calculate_next_interval(
                    new_s, desired_retention, decay, max_interval_days
                )
        else:
            # Standard review
            if grade == 1:
                new_s = calculate_next_forget_stability(d, s, cur_r, w)
                next_state_str = "relearning"
                new_repetitions = 0
                new_lapses = lapses + 1
                interval_days = 1
            else:
                new_s = calculate_next_recall_stability(d, s, cur_r, grade, w)
                next_state_str = "review"
                new_repetitions = repetitions + 1
                new_lapses = lapses
                interval_days = calculate_next_interval(
                    new_s, desired_retention, decay, max_interval_days
                )

    due_at = reviewed_at + timedelta(days=interval_days)
    prev_interval_seconds = Decimal(str(prev_interval_days * SECONDS_PER_DAY))
    resulting_interval_seconds = Decimal(str(interval_days * SECONDS_PER_DAY))

    resulting_state = {
        "stability": round(new_s, 4),
        "difficulty": round(new_d, 4),
        "retrievability": round(cur_r, 4),
        "repetitions": new_repetitions,
        "lapses": new_lapses,
        "state": next_state_str,
        "last_reviewed_at": reviewed_at.isoformat(),
        "interval_days": interval_days,
        "total_reviews": total_reviews + 1,
        "last_rating": rating,
    }

    return ScheduleDecision(
        algorithm="fsrs6",
        implementation_version="fsrs-6-reference-v1",
        configuration_version=1,
        previous_state=state,
        resulting_state=resulting_state,
        previous_interval_seconds=prev_interval_seconds,
        resulting_interval_seconds=resulting_interval_seconds,
        due_at=due_at,
        state_revision=revision + 1,
    )


class FSRS6Scheduler(BaseScheduler):
    @property
    def identity(self) -> AlgorithmIdentity:
        return AlgorithmIdentity(
            algorithm="fsrs6",
            implementation_version="fsrs-6-reference-v1",
            configuration_version=1,
            parameters={
                "weights": list(FSRS6_DEFAULT_PARAMETERS),
                "desired_retention": DEFAULT_DESIRED_RETENTION,
                "maximum_interval_days": DEFAULT_MAXIMUM_INTERVAL_DAYS,
                "rating_mapping": RATING_MAP,
            },
        )

    def initial_state(self) -> dict[str, Any]:
        return {
            "stability": None,
            "difficulty": None,
            "retrievability": None,
            "repetitions": 0,
            "lapses": 0,
            "state": "new",
            "last_reviewed_at": None,
            "interval_days": 0,
            "total_reviews": 0,
            "last_rating": None,
        }

    def compute_next_review(
        self,
        current_state: dict[str, Any],
        rating: str,
        reviewed_at: datetime,
        duration_ms: int,
        revision: int,
    ) -> ScheduleDecision:
        return calculate_fsrs6(
            current_state=current_state,
            rating=rating,
            reviewed_at=reviewed_at,
            duration_ms=duration_ms,
            revision=revision,
            parameters=FSRS6_DEFAULT_PARAMETERS,
            desired_retention=DEFAULT_DESIRED_RETENTION,
            max_interval_days=DEFAULT_MAXIMUM_INTERVAL_DAYS,
        )


fsrs6_scheduler = FSRS6Scheduler()
