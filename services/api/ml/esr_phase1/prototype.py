"""SIMULATED research heuristic, not FIFAKT inference or a registered scheduler.

The requested equation is preserved exactly. Calendar policies are explicit
scenario assumptions because a production weekday review dispatcher is absent.
"""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP, localcontext
from typing import Callable, Iterable
from zoneinfo import ZoneInfo

VERSION = "esr-phase1-interval-heuristic-v1"
ROUNDING = "decimal-half-up-calendar-days-v1"
MIN_DAYS, MAX_DAYS = 1, 36500


def number(value) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError("A finite numeric value is required")
    result = Decimal(str(value))
    if not result.is_finite():
        raise ValueError("A finite numeric value is required")
    return result


def probability(value) -> Decimal:
    result = number(value)
    if not Decimal(0) <= result <= Decimal(1):
        raise ValueError("Probability outside [0,1]")
    return result


def candidate(interval_days, p_k, p_f) -> tuple[Decimal, Decimal]:
    """Exact candidate: I * clip(1 + .5*(pK-pF), .75, 1.25). No rounding here."""
    interval = number(interval_days)
    if interval < 0:
        raise ValueError("Negative FSRS interval")
    k, f = probability(p_k), probability(p_f)
    with localcontext() as context:
        context.prec = 34
        factor = max(Decimal("0.75"), min(Decimal("1.25"), Decimal(1) + Decimal("0.5") * (k - f)))
        return factor, interval * factor


def calendar_days(interval_days) -> int:
    """Production FSRS day bounds/half-up convention, after the candidate step."""
    value = number(interval_days)
    if value < 0:
        raise ValueError("Negative interval")
    # Bound first so unusually large inputs cannot overflow datetime arithmetic.
    value = max(Decimal(MIN_DAYS), min(Decimal(MAX_DAYS), value))
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def aware(value: datetime) -> datetime:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Explicit aware timestamp required")
    return value


@dataclass(frozen=True)
class EventContext:
    event_id: str
    learner_code: str
    item_id: str
    prediction_at: datetime
    response_at: datetime
    history_sufficient: bool = True

    def __post_init__(self):
        if not all(isinstance(v, str) and v for v in (self.event_id, self.learner_code, self.item_id)):
            raise ValueError("Event, coded learner and item identities required")
        if aware(self.prediction_at) > aware(self.response_at):
            raise ValueError("Prediction cannot follow the observed response")


@dataclass(frozen=True)
class FrozenProbability:
    event_id: str
    learner_code: str
    item_id: str
    prediction_at: datetime
    latest_input_at: datetime
    value: object
    model_version: str
    simulated: bool = True


def frozen(context: EventContext, value, model_version="SIMULATED-pK-v1") -> FrozenProbability:
    """Test fixture constructor only: no learned probability is calculated."""
    return FrozenProbability(context.event_id, context.learner_code, context.item_id, context.prediction_at,
                             context.prediction_at - timedelta(microseconds=1), value, model_version)


def aligned(context: EventContext, prediction: FrozenProbability) -> Decimal:
    if (prediction.event_id, prediction.learner_code, prediction.item_id, aware(prediction.prediction_at)) != (
            context.event_id, context.learner_code, context.item_id, context.prediction_at):
        raise ValueError("Predictions must identify the same event, learner, item and as-of time")
    if aware(prediction.latest_input_at) >= context.prediction_at:
        raise ValueError("Current or future outcome may be present in model inputs")
    if not prediction.model_version:
        raise ValueError("Prediction provenance required")
    return probability(prediction.value)


@dataclass(frozen=True)
class BaseProposal:
    reviewed_at: datetime
    interval_days: int
    due_at: datetime
    engine: str = "fsrs-6-reference-v1"

    def __post_init__(self):
        if type(self.interval_days) is not int or not MIN_DAYS <= self.interval_days <= MAX_DAYS:
            raise ValueError("A valid bounded production FSRS proposal is required")
        if aware(self.due_at) != aware(self.reviewed_at) + timedelta(days=self.interval_days):
            raise ValueError("Base due time/interval mismatch")


@dataclass(frozen=True)
class Decision:
    base: BaseProposal
    factor: Decimal
    raw_interval_days: Decimal
    interval_days: int
    due_at: datetime
    fallback_reason: str | None
    p_k: Decimal | None
    p_f: Decimal | None
    simulated: bool = True


FAILURES = {"missing_prediction", "unsupported_vocabulary", "missing_features", "insufficient_history",
            "timeout", "exception", "missing_weights", "out_of_order_history"}


def decide(base: BaseProposal, context: EventContext, p_k: FrozenProbability | None,
           p_f: FrozenProbability | None, failure: str | None = None) -> Decision:
    """Fallback returns the same base object/due time; never edits FSRS memory state."""
    def fallback(reason):
        def available(prediction):
            try:
                return aligned(context, prediction) if prediction is not None else None
            except (ValueError, TypeError, AttributeError):
                return None
        return Decision(base, Decimal(1), Decimal(base.interval_days), base.interval_days, base.due_at,
                        reason, available(p_k), available(p_f))
    if base.reviewed_at != context.response_at:
        return fallback("event_time_mismatch")
    if failure:
        if failure not in FAILURES:
            raise ValueError("Unknown fallback reason")
        return fallback(failure)
    if not context.history_sufficient:
        return fallback("insufficient_history")
    if p_k is None or p_f is None:
        return fallback("missing_prediction")
    try:
        k, f = aligned(context, p_k), aligned(context, p_f)
    except (ValueError, TypeError, AttributeError):
        return fallback("invalid_or_misaligned_prediction")
    factor, raw = candidate(base.interval_days, k, f)
    days = calendar_days(raw)
    return Decision(base, factor, raw, days, base.reviewed_at + timedelta(days=days), None, k, f)


def provider_decision(base, context, p_f, provider: Callable[[], FrozenProbability | None]) -> Decision:
    """Deterministic failure-injection harness; not a real inference timeout service.

    Production needs a killable bounded process/RPC. No arbitrary model is run here.
    """
    try:
        output = provider()
    except TimeoutError:
        return decide(base, context, None, p_f, "timeout")
    except FileNotFoundError:
        return decide(base, context, None, p_f, "missing_weights")
    except Exception:
        return decide(base, context, None, p_f, "exception")
    return decide(base, context, output, p_f)


@dataclass(frozen=True)
class PriorEvent:
    event_id: str
    at: datetime
    revision: int
    rating: str


def prior_events(events: Iterable[PriorEvent], as_of: datetime) -> tuple[PriorEvent, ...]:
    cutoff = aware(as_of)
    return tuple(sorted((event for event in events if aware(event.at) < cutoff),
                        key=lambda event: (event.at, event.revision, event.event_id)))


@dataclass(frozen=True)
class CalendarPolicy:
    version: str
    weekdays: tuple[int, ...]
    opens_at: datetime
    closes_at: datetime
    zone: str = "Asia/Manila"
    skipped_dates: tuple[date, ...] = ()

    def __post_init__(self):
        if not self.version or not self.weekdays or len(set(self.weekdays)) != len(self.weekdays):
            raise ValueError("Version and distinct allowed weekdays required")
        if any(type(v) is not int or not 0 <= v <= 6 for v in self.weekdays):
            raise ValueError("Weekday outside Python Monday=0..Sunday=6")
        if aware(self.opens_at) >= aware(self.closes_at):
            raise ValueError("Invalid half-open assignment/intervention window")
        ZoneInfo(self.zone)


def actionable(due_at: datetime, policy: CalendarPolicy) -> datetime | None:
    """ASSUMPTION: next open day, full-day access, preserving time on open days.

    Never moves a due timestamp earlier; window close is exclusive. No holiday,
    catch-up, instructor release or weekday dispatcher is implemented in production.
    """
    zone = ZoneInfo(policy.zone)
    candidate_time = max(aware(due_at), policy.opens_at).astimezone(zone)
    closing = policy.closes_at.astimezone(zone)
    # Bound the scenario projection; policies may not hide an unbounded scan.
    for _ in range(370):
        if candidate_time >= closing:
            return None
        if candidate_time.weekday() in policy.weekdays and candidate_time.date() not in policy.skipped_dates:
            return candidate_time
        candidate_time = datetime.combine(candidate_time.date()+timedelta(days=1), time.min, tzinfo=zone)
    raise ValueError("Calendar projection exceeds bounded 370-day scenario horizon")


def decision_log(context: EventContext, decision: Decision, policy: CalendarPolicy) -> dict:
    action = actionable(decision.due_at, policy)
    return {
        "evidence_type": "SYNTHETIC SIMULATION RESULTS", "simulated": True, "condition": "experimental_shadow",
        "learner_code": context.learner_code, "item_id": context.item_id, "event_id": context.event_id,
        "prediction_at": context.prediction_at.isoformat(), "response_at": context.response_at.isoformat(),
        "p_k": str(decision.p_k) if decision.p_k is not None else None,
        "p_f": str(decision.p_f) if decision.p_f is not None else None,
        "fsrs_interval_days": decision.base.interval_days, "factor": str(decision.factor),
        "raw_interval_days": str(decision.raw_interval_days), "interval_days": decision.interval_days,
        "base_due_at": decision.base.due_at.isoformat(), "due_at": decision.due_at.isoformat(),
        "actionable_at": action.isoformat() if action else None,
        "fallback_reason": decision.fallback_reason, "engine_version": decision.base.engine,
        "heuristic_version": VERSION, "rounding_version": ROUNDING,
        "p_k_model_version": "SIMULATED scenario probabilities, no trained FIFAKT",
        "p_f_model_version": decision.base.engine,
        "calendar": {"version": policy.version, "weekdays": list(policy.weekdays), "zone": policy.zone,
                     "opens_at": policy.opens_at.isoformat(), "closes_at": policy.closes_at.isoformat(),
                     "skipped_dates": [day.isoformat() for day in policy.skipped_dates]},
    }


def replay_log(log: dict) -> bool:
    """Reconstruct arithmetic/calendar from the minimal synthetic decision record."""
    raw = Decimal(log["fsrs_interval_days"]) * Decimal(log["factor"])
    days = log["fsrs_interval_days"] if log["fallback_reason"] else calendar_days(raw)
    due = datetime.fromisoformat(log["response_at"]) + timedelta(days=days)
    calendar = log["calendar"]
    policy = CalendarPolicy(calendar["version"], tuple(calendar["weekdays"]),
                            datetime.fromisoformat(calendar["opens_at"]), datetime.fromisoformat(calendar["closes_at"]),
                            calendar["zone"], tuple(date.fromisoformat(d) for d in calendar["skipped_dates"]))
    action = actionable(due, policy)
    expected_factor = Decimal(1) if log["fallback_reason"] else candidate(log["fsrs_interval_days"],
                            Decimal(log["p_k"]), Decimal(log["p_f"]))[0]
    return (raw == Decimal(log["raw_interval_days"]) and expected_factor == Decimal(log["factor"])
            and days == log["interval_days"] and due.isoformat() == log["due_at"]
            and (action.isoformat() if action else None) == log["actionable_at"])
