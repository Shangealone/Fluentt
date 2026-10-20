"""SuperMemo 2 (SM-2) Spaced Repetition Scheduling Engine.

Deterministic, pure-calculation engine and BaseScheduler adapter implementing Dr. Piotr Wozniak's
classic SM-2 algorithm (1987) for vocabulary recall practice.

Algorithm Specifications:
1. Review Quality Scale (0-5) mapped from approved application recall ratings:
   - "again": q = 1 (complete failure / lapse, repetition count resets to 0, interval resets to 1 day)
   - "hard":  q = 3 (correct response recalled with serious difficulty, EF decreases by 0.14)
   - "good":  q = 4 (correct response after a hesitation, EF unchanged)
   - "easy":  q = 5 (perfect response / immediate recall, EF increases by 0.10)

2. Easiness Factor (EF):
   - Initial value: EF_0 = 2.50
   - Update formula:
       EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
   - Floor:
       EF' = max(1.30, EF')

3. Repetition & Interval Progression:
   - If q < 3 ("again"):
       repetitions = 0
       interval_days = 1
       lapses += 1
   - If q >= 3 ("hard", "good", "easy"):
       If repetitions == 0:
           repetitions = 1
           interval_days = 1
       Elif repetitions == 1:
           repetitions = 2
           interval_days = 6
       Else (repetitions >= 2):
           repetitions = repetitions + 1
           interval_days = max(1, round_half_up(interval_days * EF'))

4. Interval Rounding:
   - Uses exact Decimal ROUND_HALF_UP integer conversion for platform-independent research reproducibility.
   - Seconds conversion: 1 day = 86,400 seconds.

5. State Representation:
   - {"repetitions": int, "interval_days": int, "ease_factor": float, "lapses": int, "total_reviews": int, "last_quality": int}
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from app.modules.spaced_repetition.registry import BaseScheduler
from app.modules.spaced_repetition.schemas import (
    AlgorithmIdentity,
    ScheduleDecision,
)

# Canonical 4-rating to 6-point SM-2 quality mapping
RATING_QUALITY_MAP: dict[str, int] = {
    "again": 1,
    "hard": 3,
    "good": 4,
    "easy": 5,
}

INITIAL_EASE_FACTOR = 2.50
MINIMUM_EASE_FACTOR = 1.30
INITIAL_INTERVAL_DAYS = 1
SECOND_INTERVAL_DAYS = 6
SECONDS_PER_DAY = 86400


def round_half_up(value: float | Decimal) -> int:
    d = Decimal(str(value))
    return int(d.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def calculate_sm2(
    current_state: dict[str, Any] | None,
    rating: str,
    reviewed_at: datetime,
    duration_ms: int = 0,
    revision: int = 1,
) -> ScheduleDecision:
    """Pure calculation function for SM-2 scheduling step.

    Guarantees deterministic execution independent of database or network access.
    """
    if rating not in RATING_QUALITY_MAP:
        raise ValueError(
            f"Invalid recall rating '{rating}'. Must be one of: {list(RATING_QUALITY_MAP.keys())}"
        )

    if duration_ms < 0:
        raise ValueError(f"Response duration must be non-negative, got {duration_ms} ms")

    if revision < 1:
        raise ValueError(f"State revision must be >= 1, got {revision}")

    # Ensure timezone-aware reviewed_at
    if reviewed_at.tzinfo is None:
        reviewed_at = reviewed_at.replace(tzinfo=timezone.utc)

    # Sanitize and extract state with safe defaults for missing or corrupted state
    state = current_state or {}
    try:
        raw_ef = float(state.get("ease_factor", INITIAL_EASE_FACTOR))
    except (ValueError, TypeError):
        raw_ef = INITIAL_EASE_FACTOR
    ease_factor = max(MINIMUM_EASE_FACTOR, raw_ef)

    try:
        repetitions = max(0, int(state.get("repetitions", 0)))
    except (ValueError, TypeError):
        repetitions = 0

    try:
        interval_days = max(1, int(state.get("interval_days", INITIAL_INTERVAL_DAYS)))
    except (ValueError, TypeError):
        interval_days = INITIAL_INTERVAL_DAYS

    try:
        lapses = max(0, int(state.get("lapses", 0)))
    except (ValueError, TypeError):
        lapses = 0

    try:
        total_reviews = max(0, int(state.get("total_reviews", 0)))
    except (ValueError, TypeError):
        total_reviews = 0

    # 1. Quality score
    q = RATING_QUALITY_MAP[rating]

    # 2. Update Easiness Factor (EF)
    # EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    delta_ef = 0.10 - (5 - q) * (0.08 + (5 - q) * 0.02)
    new_ease_factor = round(ease_factor + delta_ef, 4)
    if new_ease_factor < MINIMUM_EASE_FACTOR:
        new_ease_factor = MINIMUM_EASE_FACTOR

    # 3. Update Repetitions & Interval
    if q < 3:
        # Lapse: item failed
        new_repetitions = 0
        new_interval_days = INITIAL_INTERVAL_DAYS
        new_lapses = lapses + 1
    else:
        # Successful recall
        new_lapses = lapses
        if repetitions == 0:
            new_repetitions = 1
            new_interval_days = INITIAL_INTERVAL_DAYS
        elif repetitions == 1:
            new_repetitions = 2
            new_interval_days = SECOND_INTERVAL_DAYS
        else:
            new_repetitions = repetitions + 1
            calculated_interval = interval_days * new_ease_factor
            new_interval_days = max(1, round_half_up(calculated_interval))

    # 4. Due Date
    due_at = reviewed_at + timedelta(days=new_interval_days)

    # 5. Intervals in seconds (1 day = 86400 seconds)
    prev_interval_seconds = Decimal(str(interval_days * SECONDS_PER_DAY))
    resulting_interval_seconds = Decimal(str(new_interval_days * SECONDS_PER_DAY))

    resulting_state = {
        "repetitions": new_repetitions,
        "interval_days": new_interval_days,
        "ease_factor": float(new_ease_factor),
        "lapses": new_lapses,
        "total_reviews": total_reviews + 1,
        "last_quality": q,
    }

    return ScheduleDecision(
        algorithm="sm2",
        implementation_version="sm2-classic-v1",
        configuration_version=1,
        previous_state=state,
        resulting_state=resulting_state,
        previous_interval_seconds=prev_interval_seconds,
        resulting_interval_seconds=resulting_interval_seconds,
        due_at=due_at,
        state_revision=revision + 1,
    )


class SM2Scheduler(BaseScheduler):
    @property
    def identity(self) -> AlgorithmIdentity:
        return AlgorithmIdentity(
            algorithm="sm2",
            implementation_version="sm2-classic-v1",
            configuration_version=1,
            parameters={
                "initial_ease_factor": INITIAL_EASE_FACTOR,
                "minimum_ease_factor": MINIMUM_EASE_FACTOR,
                "first_interval_days": INITIAL_INTERVAL_DAYS,
                "second_interval_days": SECOND_INTERVAL_DAYS,
                "rating_quality_map": RATING_QUALITY_MAP,
            },
        )

    def initial_state(self) -> dict[str, Any]:
        return {
            "repetitions": 0,
            "interval_days": INITIAL_INTERVAL_DAYS,
            "ease_factor": INITIAL_EASE_FACTOR,
            "lapses": 0,
            "total_reviews": 0,
            "last_quality": None,
        }

    def compute_next_review(
        self,
        current_state: dict[str, Any],
        rating: str,
        reviewed_at: datetime,
        duration_ms: int,
        revision: int,
    ) -> ScheduleDecision:
        return calculate_sm2(
            current_state=current_state,
            rating=rating,
            reviewed_at=reviewed_at,
            duration_ms=duration_ms,
            revision=revision,
        )


sm2_scheduler = SM2Scheduler()
