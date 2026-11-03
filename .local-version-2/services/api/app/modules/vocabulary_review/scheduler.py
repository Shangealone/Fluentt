"""Interval fusion keeps the baseline memory dynamics unchanged."""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import math
from zoneinfo import ZoneInfo

from app.modules.spaced_repetition.fsrs6 import calculate_fsrs6


@dataclass(frozen=True)
class ReviewDecision:
    memory_state: dict
    baseline_interval_days: int
    interval_days: int
    adjustment_factor: float
    prediction: float | None
    fallback_reason: str | None
    raw_due_at: datetime
    due_at: datetime
    baseline_due_at: datetime
    version: str = "fsrs6-interval-fusion-v1"


def calendar_due(value: datetime, configuration) -> datetime:
    local = value.astimezone(ZoneInfo(configuration.timezone))
    excluded = set(configuration.excluded_dates)
    # A bounded configuration can exclude many consecutive dates; fail explicitly.
    for _ in range(1100):
        if local.weekday() in configuration.allowed_weekdays and local.date() not in excluded:
            return local.astimezone(timezone.utc)
        local += timedelta(days=1)
    raise ValueError("No permitted review date within the configured calendar horizon.")


def schedule_review(state, rating: str, reviewed_at: datetime, condition: str, configuration, *,
                    prediction: float | None, fallback_reason: str | None = None) -> ReviewDecision:
    if condition not in ("fsrs6", "esr") or reviewed_at.tzinfo is None:
        raise ValueError("A valid condition and timezone-aware review time are required.")
    baseline = calculate_fsrs6(state, rating, reviewed_at, desired_retention=configuration.desired_retention,
                               max_interval_days=configuration.maximum_interval_days)
    days = int(baseline.resulting_interval_seconds / Decimal(86400))
    factor, reason, accepted = 1.0, None, None
    if condition == "esr":
        reason = fallback_reason
        if reason is None and prediction is None:
            reason = "prediction_unavailable"
        if reason is None and (isinstance(prediction, bool) or not isinstance(prediction, (int, float))
                               or not math.isfinite(prediction) or not 0 <= prediction <= 1):
            reason = "prediction_invalid"
        if reason is None:
            accepted = float(prediction)
            factor = max(configuration.minimum_factor, min(configuration.maximum_factor,
                         1 + configuration.sensitivity * (accepted - configuration.reference_probability)))
            if rating == "again":
                factor = min(1.0, factor)
    interval = max(1, min(configuration.maximum_interval_days,
                         int((Decimal(days) * Decimal(str(factor))).quantize(Decimal(1), rounding=ROUND_HALF_UP))))
    raw_due = reviewed_at + timedelta(days=interval)
    return ReviewDecision(dict(baseline.resulting_state), days, interval, factor, accepted, reason,
                          raw_due, calendar_due(raw_due, configuration), calendar_due(baseline.due_at, configuration))
