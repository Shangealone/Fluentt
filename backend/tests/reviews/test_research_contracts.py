"""D11B schemas validate evidence without executing either research engine."""

import copy
import importlib
from datetime import UTC, datetime, timedelta, timezone
from decimal import (
    ROUND_FLOOR,
    ROUND_UP,
    Decimal,
    Inexact,
    Rounded,
    getcontext,
    localcontext,
)

import pytest
from pydantic import ValidationError


def contracts():
    try:
        return importlib.import_module("app.scheduling.research_contracts")
    except ModuleNotFoundError:
        pytest.fail("D11B research contracts are not implemented")


def envelope(enhanced=False):
    return {
        "schema_version": 1,
        "scheduler_type": "enhanced_srs" if enhanced else "conventional_srs",
        "algorithm_version": (
            "fluentt-esr-fsrs6-binary-v1" if enhanced else "sm2-binary-v1"
        ),
        "config_version": (
            "fsrs6-binary-r90-config-v1" if enhanced else "sm2-binary-config-v1"
        ),
        "memory": (
            {"state": "Review", "step": None, "stability": 1.25, "difficulty": 5.0}
            if enhanced
            else {
                "repetition_count": 1,
                "ease_factor": 2.5,
                "interval_days": 1,
                "lapse_count": 0,
            }
        ),
    }


@pytest.mark.parametrize("enhanced", [False, True])
def test_supported_memory_round_trip_is_immutable_and_does_not_mutate_input(enhanced):
    raw = envelope(enhanced)
    before = copy.deepcopy(raw)
    decoded = contracts().decode_research_state(raw)
    assert decoded.model_dump(mode="json") == raw
    assert raw == before
    with pytest.raises(ValidationError):
        decoded.memory = {}


@pytest.mark.parametrize(
    "field,value",
    [
        ("schema_version", True),
        ("schema_version", 2),
        ("scheduler_type", "development"),
        ("algorithm_version", "unknown"),
        ("config_version", "unknown"),
        ("extra", 1),
    ],
)
def test_unknown_or_coercive_envelope_identity_is_rejected(field, value):
    raw = envelope()
    raw[field] = value
    with pytest.raises(ValidationError):
        contracts().decode_research_state(raw)


@pytest.mark.parametrize(
    "memory",
    [
        {
            "repetition_count": 4,
            "ease_factor": 2.5,
            "interval_days": 38,
            "lapse_count": 0,
        },
        {
            "repetition_count": 0,
            "ease_factor": 2.18,
            "interval_days": 1,
            "lapse_count": 1,
        },
        {
            "repetition_count": 3,
            "ease_factor": 2.18,
            "interval_days": 14,
            "lapse_count": 1,
        },
        {
            "repetition_count": 0,
            "ease_factor": 1.3,
            "interval_days": 1,
            "lapse_count": 4,
        },
        {
            "repetition_count": 1000000,
            "ease_factor": 2.5,
            "interval_days": 36500,
            "lapse_count": 0,
        },
    ],
)
def test_sm2_accepted_reachable_memory_is_validated_only(memory):
    raw = {**envelope(), "memory": memory}
    decoded = contracts().decode_research_state(raw)
    assert decoded.memory.ease_factor == Decimal(str(memory["ease_factor"]))


@pytest.mark.parametrize(
    "field,value",
    [
        ("repetition_count", True),
        ("repetition_count", -1),
        ("repetition_count", 1.0),
        ("lapse_count", True),
        ("lapse_count", -1),
        ("ease_factor", True),
        ("ease_factor", "2.5"),
        ("ease_factor", float("nan")),
        ("ease_factor", float("inf")),
        ("ease_factor", 1.29),
        ("ease_factor", 2.51),
        ("ease_factor", 2.18),
        ("interval_days", 0),
        ("interval_days", True),
        ("interval_days", 36501),
        ("interval_days", 6),
        ("lapse_count", 1),
        ("unexpected", 0),
    ],
)
def test_sm2_rejects_invalid_or_unreachable_memory(field, value):
    raw = envelope()
    raw["memory"][field] = value
    with pytest.raises(ValidationError):
        contracts().decode_research_state(raw)


@pytest.mark.parametrize(
    "field,value",
    [
        ("state", "Learning"),
        ("step", 0),
        ("stability", 0),
        ("stability", True),
        ("stability", float("nan")),
        ("difficulty", 0.99),
        ("difficulty", 10.01),
        ("difficulty", float("inf")),
        ("difficulty", "5"),
        ("last_review", "2026-01-01"),
        ("due", "2026-01-02"),
        ("card_id", 1),
    ],
)
def test_fsrs_rejects_invalid_or_third_party_state_fields(field, value):
    raw = envelope(True)
    raw["memory"][field] = value
    with pytest.raises(ValidationError):
        contracts().decode_research_state(raw)


def test_input_pair_timezone_and_excluded_features():
    cls = contracts().ResearchSchedulerInput
    now = datetime(2026, 1, 1, tzinfo=timezone(timedelta(hours=8)))
    args = {
        "correct": True,
        "interaction_at_utc": now,
        "prior_state": None,
        "prior_interaction_at_utc": None,
    }
    first = cls(**args)
    assert first.interaction_at_utc == now.astimezone(UTC)
    assert set(cls.model_fields) == {
        "correct",
        "interaction_at_utc",
        "prior_state",
        "prior_interaction_at_utc",
    }
    for change in [
        {"correct": 1},
        {"interaction_at_utc": now.replace(tzinfo=None)},
        {"prior_state": envelope()},
        {"prior_interaction_at_utc": now},
        {"response_time_ms": 1200},
        {"item_difficulty": 2},
        {"pronunciation": 90},
        {"client_condition": "enhanced_srs"},
    ]:
        with pytest.raises(ValidationError):
            cls(**{**args, **change})
    second = cls(
        **{
            **args,
            "prior_state": envelope(),
            "prior_interaction_at_utc": now - timedelta(days=1),
        }
    )
    assert second.prior_state.memory.interval_days == 1


def test_result_validates_maximum_seconds_due_and_identity_before_persistence():
    c = contracts()
    now = datetime(2026, 1, 1, tzinfo=UTC)
    inputs = c.ResearchSchedulerInput(
        correct=True,
        interaction_at_utc=now,
        prior_state=None,
        prior_interaction_at_utc=None,
    )
    state = envelope(True)
    raw = {
        "scheduler_type": state["scheduler_type"],
        "algorithm_version": state["algorithm_version"],
        "state_schema_version": 1,
        "config_version": state["config_version"],
        "interval_days": 36500,
        "interval_seconds": 3153600000,
        "due_at": now + timedelta(days=36500),
        "scheduler_state": state,
    }
    result = c.validate_research_result(raw, inputs)
    assert result.interval_seconds == 3153600000
    assert set(type(result).model_fields) == set(raw)
    for change in [
        {"interval_seconds": 3153599999},
        {"interval_days": True},
        {"interval_days": 0},
        {"interval_days": 36501},
        {"due_at": now},
        {"config_version": "sm2-binary-config-v1"},
        {"extra": 1},
    ]:
        with pytest.raises(ValidationError):
            c.validate_research_result({**raw, **change}, inputs)


def test_numeric_and_due_overflow_are_validation_failures():
    c = contracts()
    raw = envelope(True)
    raw["memory"]["stability"] = 10**400
    with pytest.raises(ValidationError):
        c.decode_research_state(raw)


def test_due_overflow_is_a_validation_failure():
    c = contracts()
    inputs = c.ResearchSchedulerInput(
        correct=True,
        interaction_at_utc=datetime.max.replace(tzinfo=UTC),
        prior_state=None,
        prior_interaction_at_utc=None,
    )
    state = envelope(True)
    with pytest.raises(ValidationError):
        c.validate_research_result(
            {
                "scheduler_type": state["scheduler_type"],
                "algorithm_version": state["algorithm_version"],
                "state_schema_version": 1,
                "config_version": state["config_version"],
                "interval_days": 1,
                "interval_seconds": 86400,
                "due_at": datetime.max.replace(tzinfo=UTC),
                "scheduler_state": state,
            },
            inputs,
        )


def f2_context_snapshot(context=None):
    context = getcontext() if context is None else context
    return (
        context.prec,
        context.rounding,
        context.Emin,
        context.Emax,
        context.capitals,
        context.clamp,
        dict(context.traps),
        dict(context.flags),
    )


def f2_validation_probes(memory):
    """Prepare every contract layer before entering the caller's hostile context."""
    c = contracts()
    state = {**envelope(), "memory": copy.deepcopy(memory)}
    at = datetime(2026, 1, 1, tzinfo=UTC)
    inputs = c.ResearchSchedulerInput(
        correct=memory["repetition_count"] != 0,
        interaction_at_utc=at,
        prior_state=None,
        prior_interaction_at_utc=None,
    )
    raw = {
        "scheduler_type": state["scheduler_type"],
        "algorithm_version": state["algorithm_version"],
        "state_schema_version": 1,
        "config_version": state["config_version"],
        "interval_days": memory["interval_days"],
        "interval_seconds": memory["interval_days"] * 86400,
        "due_at": at + timedelta(days=memory["interval_days"]),
        "scheduler_state": state,
    }
    unchecked_memory = c.Sm2Memory.model_construct(**memory)
    unchecked_state = c.ConventionalState.model_construct(
        **{**state, "memory": unchecked_memory}
    )
    unchecked_result = c.ResearchSchedulerResult.model_construct(
        **{**raw, "scheduler_state": unchecked_state}
    )
    return (
        lambda: c.Sm2Memory.model_validate(memory),
        lambda: c.ConventionalState.model_validate(state),
        lambda: c.validate_research_result(raw, inputs),
        lambda: c.validate_research_result(unchecked_result, inputs),
    )


@pytest.mark.parametrize(
    "context_name",
    [
        "ordinary",
        "precision2",
        "precision1",
        "rounding",
        "emax0",
        "inexact_trap",
        "rounded_trap",
        "combination",
    ],
)
def test_f2_sm2_reachability_is_independent_of_decimal_context(context_name):
    # Literal D11A vectors; neither expected intervals nor EF use engine helpers.
    correct_days = [1, 6, 15, 38, 95, 238, 595, 1488, 3720, 9300, 23250, 36500, 36500]
    valid = [
        {
            "repetition_count": rep,
            "ease_factor": Decimal("2.5"),
            "interval_days": days,
            "lapse_count": 0,
        }
        for rep, days in enumerate(correct_days, 1)
    ]
    lapse_vectors = [
        (1, "2.18", 14),
        (2, "1.86", 12),
        (3, "1.54", 10),
        (4, "1.3", 8),
        (5, "1.3", 8),
    ]
    for lapses, ease, third_days in lapse_vectors:
        valid.extend(
            {
                "repetition_count": rep,
                "ease_factor": Decimal(ease),
                "interval_days": days,
                "lapse_count": lapses,
            }
            for rep, days in [(0, 1), (1, 1), (2, 6), (3, third_days)]
        )
    # Retain insignificant decimal digits without quantization or float conversion.
    valid.extend(
        {
            "repetition_count": 3,
            "ease_factor": Decimal(ease + "0" * 1000),
            "interval_days": third_days,
            "lapse_count": lapses,
        }
        for lapses, ease, third_days in lapse_vectors[:4]
    )
    valid.append(
        {
            "repetition_count": 1000000,
            "ease_factor": Decimal("2.5"),
            "interval_days": 36500,
            "lapse_count": 0,
        }
    )
    invalid = []
    for memory in valid:
        for days in [memory["interval_days"] - 1, memory["interval_days"] + 1]:
            if 1 <= days <= 36500:
                invalid.append({**memory, "interval_days": days})
        if memory["lapse_count"]:
            invalid.append({**memory, "ease_factor": Decimal("2.5")})
    invalid.extend(
        [
            {
                "repetition_count": 6,
                "ease_factor": Decimal("2.5"),
                "interval_days": 240,
                "lapse_count": 0,
            },
            {
                "repetition_count": 0,
                "ease_factor": Decimal("2.5"),
                "interval_days": 1,
                "lapse_count": 0,
            },
        ]
    )
    candidates = [(True, memory, f2_validation_probes(memory)) for memory in valid]
    candidates += [(False, memory, f2_validation_probes(memory)) for memory in invalid]
    original = copy.deepcopy([memory for _, memory, _ in candidates])
    outer_context = getcontext()
    outer_before = f2_context_snapshot()
    with localcontext() as caller:
        if context_name in ("precision2", "precision1"):
            caller.prec = 2 if context_name == "precision2" else 1
        elif context_name == "rounding":
            caller.rounding = ROUND_UP
        elif context_name == "emax0":
            caller.Emax = 0
        elif context_name == "inexact_trap":
            caller.traps[Inexact] = True
        elif context_name == "rounded_trap":
            caller.traps[Rounded] = True
        elif context_name == "combination":
            caller.prec, caller.rounding = 1, ROUND_FLOOR
            caller.Emin = caller.Emax = 0
            caller.capitals, caller.clamp = 0, 1
            for signal in caller.traps:
                caller.traps[signal] = True
        for signal in caller.flags:
            caller.flags[signal] = context_name == "combination" or (
                context_name == "ordinary" and signal is Rounded
            )
        before = f2_context_snapshot()
        for accepted, memory, probes in candidates:
            for validate in probes:
                if accepted:
                    result = validate()
                    checked_memory = (
                        result
                        if isinstance(result, contracts().Sm2Memory)
                        else result.memory
                        if isinstance(result, contracts().ConventionalState)
                        else result.scheduler_state.memory
                    )
                    assert checked_memory.interval_days == memory["interval_days"]
                    assert (
                        checked_memory.ease_factor.as_tuple()
                        == memory["ease_factor"].as_tuple()
                    )
                else:
                    with pytest.raises(ValidationError):
                        validate()
                assert getcontext() is caller
                assert f2_context_snapshot() == before
    assert getcontext() is outer_context
    assert f2_context_snapshot() == outer_before
    assert [memory for _, memory, _ in candidates] == original
