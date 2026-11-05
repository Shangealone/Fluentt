"""Pure calendar/randomization rules. Never writes schedules or enrolls users."""
import calendar
from datetime import datetime, time, timedelta, timezone
import hashlib
import hmac
from zoneinfo import ZoneInfo

from app.modules.spaced_repetition.fsrs6 import calculate_fsrs6

CONTRACT = "esr-parallel-foundation-v1"
CONTROL = "FSRS6_CONTROL"
EXPERIMENTAL = "FSRS6_FIFAKT_EXPERIMENTAL"
METHOD = "hmac-sha256-ranked-slots-v1"


def month_end(start):
    year, month = (start.year+1, 1) if start.month == 12 else (start.year, start.month+1)
    return start.replace(year=year, month=month, day=min(start.day, calendar.monthrange(year, month)[1]))


def windows(start, zone):
    """Month-end clamp is explicit policy metadata, never a fixed 30-day assumption."""
    tz = ZoneInfo(zone)
    end, day, rows = month_end(start), start, []
    while day < end:
        if day.weekday() < 5:
            opens = datetime.combine(day, time.min, tzinfo=tz).astimezone(timezone.utc)
            closes = datetime.combine(day+timedelta(days=1), time.min, tzinfo=tz).astimezone(timezone.utc)
            rows.append((day, opens, closes))
        day += timedelta(days=1)
    return rows


def allocation_sequence(seed):
    if not isinstance(seed, bytes) or len(seed) != 32:
        raise ValueError("A private 256-bit randomization seed is required")
    slots = [CONTROL]*15 + [EXPERIMENTAL]*15
    order = sorted(range(30), key=lambda i: hmac.digest(seed, str(i).encode(), hashlib.sha256))
    return [slots[i] for i in order]


def activity_status(at, opens, closes, *, completed_at=None, operational=False):
    if any(value.tzinfo is None for value in (at, opens, closes)) or closes <= opens:
        raise ValueError("Timezone-aware valid window required")
    if completed_at is not None:
        if completed_at.tzinfo is None or not opens <= completed_at < closes or completed_at > at:
            raise ValueError("Completion must have occurred inside the retained window")
        return "completed"
    if not operational:
        return "blocked"
    return "upcoming" if at < opens else "missed" if at >= closes else "available"


def select_schedule(condition, state, rating, at, *, context, live=False, **kwargs):
    if context != "parallel_classroom" or condition not in (CONTROL, EXPERIMENTAL):
        raise ValueError("Only an explicitly assigned parallel classroom context is permitted")
    if live:
        return {"status": "blocked", "reason": "parallel_participation_workflow_unavailable", "applied": False}
    if condition == EXPERIMENTAL:
        return {"status": "blocked", "reason": "validated_fifakt_unavailable", "applied": False}
    return {"status": "offline_control", "applied": False,
            "decision": calculate_fsrs6(state, rating, at, **kwargs)}
