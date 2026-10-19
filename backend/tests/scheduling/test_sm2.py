"""Pure Binary SM-2 adaptation fixtures: no database fixture is needed."""

import copy
import decimal
import importlib
import json
from datetime import UTC, datetime, timedelta, timezone
from decimal import ROUND_DOWN, Decimal, localcontext
from fractions import Fraction
from hashlib import sha256

import pytest
from pydantic import ValidationError

from app.research_authority.config_v1 import CONFIGURATIONS
from app.scheduling.research_contracts import (
    ConventionalState,
    ResearchSchedulerInput,
    decode_research_state,
)

ANCHOR = datetime(2026, 10, 17, 11, 23, 45, 678901, tzinfo=UTC)


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Override the parent database setup for this pure test module only."""


@pytest.fixture(autouse=True)
def isolate_test_database():
    """Override parent database cleanup: these tests create no stored evidence."""


def engine():
    try:
        module = importlib.import_module("app.scheduling.sm2")
    except ModuleNotFoundError:
        pytest.fail("D11C Binary SM-2 adaptation engine is not implemented")
    return module.BinarySm2Scheduler()


def inputs(correct=True, prior=None, at=ANCHOR):
    return ResearchSchedulerInput(
        correct=correct,
        interaction_at_utc=at,
        prior_state=prior,
        prior_interaction_at_utc=None if prior is None else at - timedelta(seconds=1),
    )


def sequence(answers):
    scheduler = engine()
    prior = None
    results = []
    for index, correct in enumerate(answers):
        result = scheduler.schedule(
            inputs(correct, prior, ANCHOR + timedelta(days=index))
        )
        results.append(result)
        prior = result.scheduler_state
    return results


@pytest.mark.parametrize(
    "answers,rep,ease,days,lapses",
    [
        ([True], 1, "2.5", 1, 0),
        ([True, True], 2, "2.5", 6, 0),
        ([True, True, True], 3, "2.5", 15, 0),
        ([True, True, True, True], 4, "2.5", 38, 0),
        ([False], 0, "2.18", 1, 1),
        ([False, False], 0, "1.86", 1, 2),
        ([False, False, False], 0, "1.54", 1, 3),
        ([False, False, False, False], 0, "1.3", 1, 4),
        ([False, False, False, False, False], 0, "1.3", 1, 5),
        ([False, True], 1, "2.18", 1, 1),
        ([False, True, True], 2, "2.18", 6, 1),
        ([False, True, True, True], 3, "2.18", 14, 1),
    ],
)
def test_locked_answer_vectors(answers, rep, ease, days, lapses):
    result = sequence(answers)[-1]
    assert result.scheduler_state.memory.model_dump() == {
        "repetition_count": rep,
        "ease_factor": Decimal(ease),
        "interval_days": days,
        "lapse_count": lapses,
    }
    assert result.interval_days == days
    assert result.interval_seconds == days * 86400
    assert result.due_at == ANCHOR + timedelta(days=len(answers) - 1 + days)


def test_correct_ceiling_then_cap_and_saturation():
    results = sequence([True] * 13)
    assert [r.interval_days for r in results] == [
        1,
        6,
        15,
        38,
        95,
        238,
        595,
        1488,
        3720,
        9300,
        23250,
        36500,
        36500,
    ]
    assert results[-1].interval_seconds == 3153600000
    assert results[-1].scheduler_state.memory.repetition_count == 13


def test_incorrect_after_cap_resets_repetitions_and_updates_ease():
    result = sequence([True] * 12 + [False])[-1]
    assert result.scheduler_state.memory.model_dump() == {
        "repetition_count": 0,
        "ease_factor": Decimal("2.18"),
        "interval_days": 1,
        "lapse_count": 1,
    }


def test_correct_after_floor_lapses_uses_ceiling_and_keeps_lapses():
    result = sequence([False] * 5 + [True] * 3)[-1]
    assert result.scheduler_state.memory.model_dump() == {
        "repetition_count": 3,
        "ease_factor": Decimal("1.3"),
        "interval_days": 8,
        "lapse_count": 5,
    }


def test_large_repetition_and_lapse_counts_need_one_transition():
    prior = ConventionalState.model_validate(
        {
            "schema_version": 1,
            "scheduler_type": "conventional_srs",
            "algorithm_version": "sm2-binary-v1",
            "config_version": "sm2-binary-config-v1",
            "memory": {
                "repetition_count": 10**1000,
                "ease_factor": Decimal("1.3"),
                "interval_days": 36500,
                "lapse_count": 10**1000,
            },
        }
    )
    correct = engine().schedule(inputs(True, prior))
    incorrect = engine().schedule(inputs(False, prior))
    assert correct.interval_days == 36500
    assert correct.scheduler_state.memory.repetition_count == 10**1000 + 1
    assert incorrect.scheduler_state.memory.lapse_count == 10**1000 + 1
    assert incorrect.scheduler_state.memory.repetition_count == 0
    assert incorrect.interval_days == 1


def test_non_midnight_offset_anchor_uses_elapsed_seconds_not_local_days():
    at = datetime(2026, 3, 8, 1, 59, 59, 123456, tzinfo=timezone(timedelta(hours=-5)))
    result = engine().schedule(inputs(at=at))
    assert result.due_at == datetime(2026, 3, 9, 6, 59, 59, 123456, tzinfo=UTC)
    assert result.due_at.tzinfo is UTC


def test_due_overflow_fails_with_existing_result_validation():
    with pytest.raises(ValidationError) as error:
        engine().schedule(inputs(at=datetime.max.replace(tzinfo=UTC)))
    assert error.value.errors()[0]["type"] == "due_anchor"


def test_predecessor_and_input_are_immutable_and_calls_are_deterministic():
    scheduler = engine()
    prior = sequence([False, True, True])[-1].scheduler_state
    value = inputs(True, prior)
    before = copy.deepcopy(value.model_dump())
    first = scheduler.schedule(value)
    scheduler.schedule(inputs(False))
    second = scheduler.schedule(value)
    assert first == second
    assert value.model_dump() == before
    assert first.scheduler_state is not prior
    assert first.scheduler_state.memory is not prior.memory
    with pytest.raises(ValidationError):
        first.scheduler_state.memory.interval_days = 999


def test_arithmetic_is_independent_of_callers_decimal_context():
    scheduler = engine()
    value = inputs(prior=sequence([False, False] + [True] * 3)[-1].scheduler_state)
    expected = scheduler.schedule(value)
    with localcontext() as context:
        context.prec = 2
        context.rounding = ROUND_DOWN
        flags = context.flags.copy()
        actual = scheduler.schedule(value)
        assert context.prec == 2
        assert context.rounding == ROUND_DOWN
        assert context.flags == flags
    assert actual == expected
    assert actual.interval_days == 23


def caller_context_state(context):
    return (
        context.prec,
        context.rounding,
        context.Emin,
        context.Emax,
        context.capitals,
        context.clamp,
        context.traps.copy(),
        context.flags.copy(),
    )


HOSTILE_COMBINATION = {
    "prec": 1,
    "rounding": decimal.ROUND_UP,
    "Emin": 0,
    "Emax": 0,
    "capitals": 0,
    "clamp": 1,
    "traps": {
        signal: True
        for signal in (
            decimal.Clamped,
            decimal.DivisionByZero,
            decimal.FloatOperation,
            decimal.Inexact,
            decimal.InvalidOperation,
            decimal.Overflow,
            decimal.Rounded,
            decimal.Subnormal,
            decimal.Underflow,
        )
    },
    "flags": {decimal.Inexact: True, decimal.Rounded: True, decimal.Overflow: True},
}


def configure_caller_context(context, settings):
    context.flags[decimal.Clamped] = True
    for name, value in settings.items():
        if name in ("traps", "flags"):
            for signal, enabled in value.items():
                getattr(context, name)[signal] = enabled
        else:
            setattr(context, name, value)


def fifteen_day_input():
    prior = ConventionalState.model_validate(
        {
            "schema_version": 1,
            "scheduler_type": "conventional_srs",
            "algorithm_version": "sm2-binary-v1",
            "config_version": "sm2-binary-config-v1",
            "memory": {
                "repetition_count": 2,
                "ease_factor": Decimal("2.5"),
                "interval_days": 6,
                "lapse_count": 0,
            },
        }
    )
    return inputs(prior=prior)


@pytest.mark.parametrize(
    "settings",
    [
        pytest.param({"Emax": 0}, id="emax-zero"),
        pytest.param({"prec": 1}, id="precision-one"),
        pytest.param({"rounding": decimal.ROUND_UP}, id="rounding-up"),
        pytest.param({"traps": {decimal.Inexact: True}}, id="trap-inexact"),
        pytest.param({"traps": {decimal.Rounded: True}}, id="trap-rounded"),
        pytest.param({"Emin": 0}, id="emin-zero"),
        pytest.param({"clamp": 1}, id="clamp-on"),
        pytest.param(HOSTILE_COMBINATION, id="combined-all-traps"),
    ],
)
def test_c01_same_valid_input_is_independent_of_complete_caller_context(settings):
    # Validate once before narrowing caller settings; the input never changes.
    scheduler = engine()
    value = fifteen_day_input()
    original_input = copy.deepcopy(value.model_dump())
    normal = scheduler.schedule(value)
    assert normal.interval_days == 15
    outer = decimal.getcontext()
    outer_before = caller_context_state(outer)
    with localcontext() as caller:
        configure_caller_context(caller, settings)
        before = caller_context_state(caller)
        actual = scheduler.schedule(value)
        assert decimal.getcontext() is caller
        assert caller_context_state(caller) == before
    assert decimal.getcontext() is outer
    assert caller_context_state(outer) == outer_before
    assert value.model_dump() == original_input
    assert actual == normal
    assert actual.interval_days == 15
    assert actual.interval_seconds == 1296000
    assert actual.due_at == datetime(2026, 11, 1, 11, 23, 45, 678901, tzinfo=UTC)
    assert actual.scheduler_state.memory.model_dump() == {
        "repetition_count": 3,
        "ease_factor": Decimal("2.5"),
        "interval_days": 15,
        "lapse_count": 0,
    }


@pytest.mark.parametrize("failure", ["due-overflow", "invalid-state"])
def test_c01_caller_context_is_preserved_on_expected_validation_error(failure):
    scheduler = engine()
    value = fifteen_day_input()
    if failure == "due-overflow":
        value = value.model_copy(
            update={"interaction_at_utc": datetime.max.replace(tzinfo=UTC)}
        )
    else:
        prior = value.prior_state
        invalid = prior.model_copy(
            update={
                "memory": prior.memory.model_copy(
                    update={"ease_factor": Decimal("2.18")}
                )
            }
        )
        value = value.model_copy(update={"prior_state": invalid})
    outer = decimal.getcontext()
    outer_before = caller_context_state(outer)
    with localcontext() as caller:
        configure_caller_context(caller, HOSTILE_COMBINATION)
        before = caller_context_state(caller)
        with pytest.raises(ValidationError):
            scheduler.schedule(value)
        assert decimal.getcontext() is caller
        assert caller_context_state(caller) == before
    assert decimal.getcontext() is outer
    assert caller_context_state(outer) == outer_before


@pytest.mark.parametrize("hostile", [False, True])
def test_c01_fraction_oracle_in_normal_and_hostile_contexts(hostile):
    scheduler = engine()
    cases = 0
    for lapses in range(8):
        ease = max(Fraction(13, 10), Fraction(5, 2) - Fraction(8, 25) * lapses)
        exact_ease = Decimal(("2.5", "2.18", "1.86", "1.54", "1.3")[min(lapses, 4)])
        for repetitions in range(36):
            if repetitions == 0 and lapses == 0:
                continue
            days = 1 if repetitions < 2 else 6
            for _ in range(max(0, repetitions - 2)):
                product = days * ease
                days = min(36500, -(-product.numerator // product.denominator))
            prior = ConventionalState.model_validate(
                {
                    "schema_version": 1,
                    "scheduler_type": "conventional_srs",
                    "algorithm_version": "sm2-binary-v1",
                    "config_version": "sm2-binary-config-v1",
                    "memory": {
                        "repetition_count": repetitions,
                        "ease_factor": exact_ease,
                        "interval_days": days,
                        "lapse_count": lapses,
                    },
                }
            )
            for correct in (False, True):
                # Rational expectations are independent of engine Decimal arithmetic.
                new_lapses = lapses + (0 if correct else 1)
                next_ease = max(
                    Fraction(13, 10), ease - (0 if correct else Fraction(8, 25))
                )
                product = days * next_ease
                expected_days = (
                    (
                        1
                        if repetitions == 0
                        else 6
                        if repetitions == 1
                        else -(-product.numerator // product.denominator)
                    )
                    if correct
                    else 1
                )
                expected_days = min(36500, expected_days)
                value = inputs(correct, prior)
                with localcontext() as caller:
                    if hostile:
                        configure_caller_context(caller, HOSTILE_COMBINATION)
                    before = caller_context_state(caller)
                    result = scheduler.schedule(value)
                    assert caller_context_state(caller) == before
                assert result.scheduler_state.memory.model_dump() == {
                    "repetition_count": repetitions + 1 if correct else 0,
                    "ease_factor": Decimal(
                        ("2.5", "2.18", "1.86", "1.54", "1.3")[min(new_lapses, 4)]
                    ),
                    "interval_days": expected_days,
                    "lapse_count": new_lapses,
                }
                assert result.interval_seconds == expected_days * 86400
                assert result.due_at == ANCHOR + timedelta(days=expected_days)
                cases += 1
    assert cases == 574


def test_engine_does_not_read_clock_environment_network_database_or_randomness(
    monkeypatch,
):
    import os
    import random
    import socket
    import time

    from sqlalchemy.engine import Engine

    scheduler = engine()
    value = inputs()

    def forbidden(*args, **kwargs):
        pytest.fail("Pure scheduler attempted an external side effect")

    class ForbiddenDatetime(datetime):
        now = forbidden
        today = forbidden
        utcnow = forbidden

    with monkeypatch.context() as patch:
        patch.setattr(
            importlib.import_module("app.scheduling.sm2"),
            "datetime",
            ForbiddenDatetime,
            raising=False,
        )
        patch.setattr(time, "time", forbidden)
        patch.setattr(time, "monotonic", forbidden)
        patch.setattr(os, "getenv", forbidden)
        patch.setattr(os, "environ", {})
        patch.setattr(socket, "socket", forbidden)
        patch.setattr(Engine, "connect", forbidden)
        patch.setattr(random, "random", forbidden)
        patch.setattr(random, "randint", forbidden)
        result = scheduler.schedule(value)
    assert result.due_at == datetime(2026, 10, 18, 11, 23, 45, 678901, tzinfo=UTC)


@pytest.mark.parametrize(
    "answers", [[True], [False], [False] * 2, [False] * 3, [False] * 4]
)
def test_json_number_round_trip_preserves_exact_decimal_state(answers):
    result = sequence(answers)[-1]
    raw = json.loads(result.model_dump_json())
    memory = raw["scheduler_state"]["memory"]
    assert isinstance(memory["ease_factor"], (int, float))
    decoded = decode_research_state(raw["scheduler_state"])
    assert decoded == result.scheduler_state
    assert engine().schedule(inputs(True, decoded)) == engine().schedule(
        inputs(True, result.scheduler_state)
    )
    assert set(raw["scheduler_state"]) == {
        "schema_version",
        "scheduler_type",
        "algorithm_version",
        "config_version",
        "memory",
    }
    assert set(memory) == {
        "repetition_count",
        "ease_factor",
        "interval_days",
        "lapse_count",
    }


@pytest.mark.parametrize(
    "change",
    [
        {"scheduler_type": "development"},
        {"algorithm_version": "unknown"},
        {"config_version": "unknown"},
        {"schema_version": 2},
        {
            "memory": {
                "repetition_count": True,
                "ease_factor": 2.5,
                "interval_days": 1,
                "lapse_count": 0,
            }
        },
        {
            "memory": {
                "repetition_count": 1,
                "ease_factor": 1.29,
                "interval_days": 1,
                "lapse_count": 0,
            }
        },
        {
            "memory": {
                "repetition_count": 1,
                "ease_factor": 2.51,
                "interval_days": 1,
                "lapse_count": 0,
            }
        },
        {
            "memory": {
                "repetition_count": 3,
                "ease_factor": 2.5,
                "interval_days": 14,
                "lapse_count": 0,
            }
        },
        {
            "memory": {
                "repetition_count": 0,
                "ease_factor": 2.5,
                "interval_days": 0,
                "lapse_count": 0,
            }
        },
        {
            "memory": {
                "repetition_count": 1,
                "ease_factor": 2.5,
                "interval_days": 36501,
                "lapse_count": 0,
            }
        },
    ],
)
def test_invalid_predecessors_never_transition(change):
    scheduler = engine()
    raw = sequence([True])[-1].scheduler_state.model_dump()
    raw.update(change)
    with pytest.raises(ValidationError):
        scheduler.schedule(inputs(prior=raw))


def test_enhanced_state_is_valid_research_input_but_rejected_by_sm2():
    scheduler = engine()
    enhanced = decode_research_state(
        {
            "schema_version": 1,
            "scheduler_type": "enhanced_srs",
            "algorithm_version": "fluentt-esr-fsrs6-binary-v1",
            "config_version": "fsrs6-binary-r90-config-v1",
            "memory": {
                "state": "Review",
                "step": None,
                "stability": 1.0,
                "difficulty": 5.0,
            },
        }
    )
    with pytest.raises(ValidationError):
        scheduler.schedule(inputs(prior=enhanced))


def test_input_model_copy_cannot_bypass_state_validation():
    scheduler = engine()
    prior = sequence([True])[-1].scheduler_state
    invalid = prior.model_copy(
        update={
            "memory": prior.memory.model_copy(update={"ease_factor": Decimal("2.18")})
        }
    )
    with pytest.raises(ValidationError):
        scheduler.schedule(
            inputs().model_copy(
                update={
                    "prior_state": invalid,
                    "prior_interaction_at_utc": ANCHOR - timedelta(days=1),
                }
            )
        )


def test_dictionary_is_not_trusted_as_an_engine_input():
    with pytest.raises(TypeError):
        engine().schedule(inputs().model_dump())


@pytest.mark.parametrize(
    "extra",
    [
        "response_time_ms",
        "timing_evidence",
        "item_difficulty",
        "pronunciation",
        "network_delay",
        "server_receipt_at",
        "participant_id",
        "client_condition",
    ],
)
def test_excluded_features_are_rejected_at_input_boundary(extra):
    scheduler = engine()
    with pytest.raises(ValidationError):
        scheduler.schedule(
            ResearchSchedulerInput(**{**inputs().model_dump(), extra: 123})
        )


@pytest.mark.parametrize(
    "change",
    [{"correct": 1}, {"prior_state": None, "prior_interaction_at_utc": ANCHOR}],
)
def test_strict_answer_and_predecessor_pair_are_preserved(change):
    scheduler = engine()
    with pytest.raises(ValidationError):
        scheduler.schedule(
            ResearchSchedulerInput(**{**inputs().model_dump(), **change})
        )


def test_engine_identity_behavior_and_snapshot_bind_the_frozen_configuration(
    monkeypatch,
):
    scheduler = engine()
    record = next(
        r for r in CONFIGURATIONS if r["config_version"] == "sm2-binary-config-v1"
    )
    digest = sha256(record["canonical_document"].encode("utf-8")).hexdigest()
    assert (
        digest
        == record["config_sha256"]
        == "3bd486d1183d84a869a2470f0a97a13ecabc44365eb9fe8e158014fd1ef2a0d9"
    )
    config = json.loads(record["canonical_document"])
    result = scheduler.schedule(inputs())
    assert (
        result.scheduler_type,
        result.algorithm_version,
        result.state_schema_version,
        result.config_version,
    ) == (
        config["scheduler_type"],
        config["algorithm_version"],
        config["state_schema_version"],
        config["config_version"],
    )
    assert result.scheduler_state.memory.ease_factor == Decimal(
        config["initial_memory"]["ease_factor"]
    )
    assert sequence([False] * 4)[-1].scheduler_state.memory.ease_factor == Decimal(
        config["ease_update"]["minimum"]
    )
    assert sequence([True] * 12)[-1].interval_days == config["maximum_interval_days"]
    with monkeypatch.context() as patch:
        patch.setitem(record, "canonical_document", "{}")
        assert scheduler.schedule(inputs()) == result
