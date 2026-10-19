"""Pinned direct-runtime goldens and pure FLUENTT FSRS reconstruction checks."""

import copy
import importlib
import inspect
import json
from datetime import UTC, datetime, timedelta
from importlib.metadata import version
from pathlib import Path
from uuid import UUID

import pytest
from fastapi.encoders import jsonable_encoder
from fsrs import Card, Rating, Scheduler, State
from pydantic import ValidationError

from app.scheduling.research_contracts import (
    ConventionalState,
    EnhancedState,
    ResearchSchedulerInput,
    decode_research_state,
)

GOLDENS = json.loads(
    (Path(__file__).parent / "fixtures/fsrs6_6_3_2_goldens.json").read_text(
        encoding="utf-8"
    )
)
PROVENANCE = GOLDENS["provenance"]
AT = datetime(2026, 1, 1, 10, 11, 12, 123456, tzinfo=UTC)
USER = UUID(PROVENANCE["user_id"])
ITEM = UUID(PROVENANCE["vocabulary_item_id"])


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Override parent database setup for this pure test module."""


@pytest.fixture(autouse=True)
def isolate_test_database():
    """Override parent cleanup: the adapter performs no persistence."""


def adapter():
    try:
        return importlib.import_module("app.scheduling.fsrs6")
    except ModuleNotFoundError:
        pytest.fail("D11D pure enhanced FSRS adapter is not implemented")


def context(due=None, **changes):
    return adapter().FsrsReconstructionContext(
        **{
            "user_id": USER,
            "vocabulary_item_id": ITEM,
            "prior_due_at_utc": due,
            **changes,
        }
    )


def value(correct=True, prior=None, previous=None, at=AT):
    return ResearchSchedulerInput(
        correct=correct,
        interaction_at_utc=at,
        prior_state=prior,
        prior_interaction_at_utc=previous,
    )


def initial_facts(case):
    if case["initial"] is None:
        return None, None, None
    initial = case["initial"]
    return (
        EnhancedState.model_validate(
            {
                "schema_version": 1,
                "scheduler_type": "enhanced_srs",
                "algorithm_version": "fluentt-esr-fsrs6-binary-v1",
                "config_version": "fsrs6-binary-r90-config-v1",
                "memory": initial["memory"],
            }
        ),
        datetime.fromisoformat(initial["prior_interaction_at"]),
        datetime.fromisoformat(initial["prior_due_at"]),
    )


def run_case(case, serialized=False):
    engine = adapter().EnhancedFsrsScheduler()
    state, previous, due = initial_facts(case)
    results = []
    for step in case["steps"]:
        at = datetime.fromisoformat(step["interaction_at"])
        inputs, reconstruction = (
            value(step["correct"], state, previous, at),
            context(due),
        )
        before = copy.deepcopy((inputs.model_dump(), reconstruction.model_dump()))
        result = engine.schedule(inputs, reconstruction)
        expected = step["expected"]
        assert (inputs.model_dump(), reconstruction.model_dump()) == before
        assert result.scheduler_state.memory.model_dump() == {
            key: expected[key] for key in ("state", "step", "stability", "difficulty")
        }
        assert result.interval_days == expected["interval_days"]
        assert result.interval_seconds == expected["interval_seconds"]
        assert result.due_at.isoformat() == expected["due_at"]
        assert (
            result.scheduler_type,
            result.algorithm_version,
            result.state_schema_version,
            result.config_version,
        ) == (
            "enhanced_srs",
            "fluentt-esr-fsrs6-binary-v1",
            1,
            "fsrs6-binary-r90-config-v1",
        )
        assert set(result.scheduler_state.model_dump()) == {
            "schema_version",
            "scheduler_type",
            "algorithm_version",
            "config_version",
            "memory",
        }
        state = result.scheduler_state
        if serialized:
            raw = json.loads(json.dumps(jsonable_encoder(state)))
            assert isinstance(raw["memory"]["stability"], (int, float))
            assert isinstance(raw["memory"]["difficulty"], (int, float))
            state = decode_research_state(raw)
            assert state == result.scheduler_state
        previous, due = at, result.due_at
        results.append(result)
    return results


def test_pinned_distribution_and_actual_api_contract():
    assert version("fsrs") == "6.3.2"
    assert list(inspect.signature(Scheduler).parameters) == [
        "parameters",
        "desired_retention",
        "learning_steps",
        "relearning_steps",
        "maximum_interval",
        "enable_fuzzing",
    ]
    assert list(inspect.signature(Card).parameters) == [
        "card_id",
        "state",
        "step",
        "stability",
        "difficulty",
        "due",
        "last_review",
    ]
    assert list(inspect.signature(Scheduler.review_card).parameters) == [
        "self",
        "card",
        "rating",
        "review_datetime",
        "review_duration",
    ]
    assert (int(Rating.Again), int(Rating.Good), int(State.Review)) == (1, 3, 2)


@pytest.mark.parametrize("case", GOLDENS["cases"], ids=lambda c: c["name"])
@pytest.mark.parametrize("serialized", [False, True], ids=["memory", "json-fastapi"])
def test_literal_direct_runtime_goldens(case, serialized):
    run_case(case, serialized)


@pytest.mark.parametrize(
    "family", ["first_correct", "first_incorrect", "mixed_elapsed", "maximum_cap"]
)
def test_one_real_transition_explicit_card_config_time_duration_and_copy(
    monkeypatch, family
):
    module = adapter()
    transitions, cards, schedulers = [], [], []

    class ObservedScheduler(Scheduler):
        def __init__(self, **kwargs):
            super().__init__(**kwargs)
            schedulers.append((self, kwargs))

        def review_card(self, card, rating, *, review_datetime, review_duration):
            before = vars(card).copy()
            updated, log = super().review_card(
                card,
                rating,
                review_datetime=review_datetime,
                review_duration=review_duration,
            )
            assert vars(card) == before and updated is not card
            transitions.append(
                (before, rating, review_datetime, review_duration, log, updated)
            )
            return updated, log

    def explicit_card(**kwargs):
        assert set(kwargs) == {
            "card_id",
            "state",
            "step",
            "stability",
            "difficulty",
            "due",
            "last_review",
        }
        card = Card(**kwargs)
        cards.append(card)
        return card

    monkeypatch.setattr(module, "Scheduler", ObservedScheduler)
    monkeypatch.setattr(module, "Card", explicit_card)
    case = next(c for c in GOLDENS["cases"] if c["name"] == family)
    run_case(case)
    assert len(transitions) == len(cards) == len(schedulers) == len(case["steps"])
    for index, (before, rating, at, duration, log, updated) in enumerate(transitions):
        expected = case["steps"][index]["expected"]
        scheduler, kwargs = schedulers[index]
        assert set(kwargs) == {
            "parameters",
            "desired_retention",
            "learning_steps",
            "relearning_steps",
            "maximum_interval",
            "enable_fuzzing",
        }
        assert tuple(scheduler.parameters) == tuple(PROVENANCE["parameters"])
        assert scheduler.desired_retention == 0.9
        assert scheduler.learning_steps == scheduler.relearning_steps == ()
        assert scheduler.maximum_interval == 36500 and scheduler.enable_fuzzing is False
        assert (
            before["card_id"] == (USER.int << 128) | ITEM.int == PROVENANCE["card_id"]
        )
        assert before["card_id"].bit_length() == 256
        assert int(rating) == expected["rating"] == int(log.rating)
        assert duration is None and log.review_duration is None
        assert log.card_id == before["card_id"]
        assert log.review_datetime == updated.last_review == at
        assert at.tzinfo is UTC
        if index == 0 and case["initial"] is None:
            assert before == {
                "card_id": PROVENANCE["card_id"],
                "state": State.Learning,
                "step": 0,
                "stability": None,
                "difficulty": None,
                "due": at,
                "last_review": None,
            }
        else:
            previous = case["steps"][index - 1] if index else None
            assert before["state"] is State.Review and before["step"] is None
            assert before["due"] == datetime.fromisoformat(
                previous["expected"]["due_at"]
                if previous
                else case["initial"]["prior_due_at"]
            )
            assert before["last_review"] == datetime.fromisoformat(
                previous["interaction_at"]
                if previous
                else case["initial"]["prior_interaction_at"]
            )


def test_elapsed_time_and_maximum_cap_match_literal_observations():
    actual = {
        c["name"]: run_case(c)[-1]
        for c in GOLDENS["cases"]
        if c["name"]
        in {
            "on_due",
            "after_due",
            "before_due",
            "elapsed_below_day",
            "elapsed_exact_day",
            "elapsed_above_day",
            "maximum_cap",
        }
    }
    assert {name: result.interval_days for name, result in actual.items()} == {
        "on_due": 11,
        "after_due": 24,
        "before_due": 7,
        "elapsed_below_day": 2,
        "elapsed_exact_day": 7,
        "elapsed_above_day": 7,
        "maximum_cap": 36500,
    }
    assert actual["maximum_cap"].interval_seconds == 3153600000


def test_repeat_determinism_without_random_clock_environment_or_io(monkeypatch):
    import os
    import socket
    import time

    from sqlalchemy.engine import Engine

    module = adapter()
    case = next(c for c in GOLDENS["cases"] if c["name"] == "mixed_elapsed")
    expected = run_case(case, True)

    def forbidden(*args, **kwargs):
        pytest.fail("Pure FSRS path reached a forbidden default/time/random/I/O branch")

    class NoClock(datetime):
        now = forbidden
        utcnow = forbidden
        today = forbidden

    with monkeypatch.context() as patch:
        for name in ("fsrs.card", "fsrs.scheduler", "fsrs.review_log"):
            library = importlib.import_module(name)
            if hasattr(library, "datetime"):
                patch.setattr(library, "datetime", NoClock)
        patch.setattr(Scheduler, "_get_fuzzed_interval", forbidden)
        patch.setattr(time, "sleep", forbidden)
        patch.setattr(time, "time", forbidden)
        patch.setattr(os, "getenv", forbidden)
        patch.setattr(socket, "socket", forbidden)
        patch.setattr(Engine, "connect", forbidden)
        assert run_case(case, True) == expected
        assert run_case(case, True) == expected
    assert (
        module.EnhancedFsrsScheduler().schedule(value(), context()).interval_days == 2
    )


@pytest.mark.parametrize("where", ["input", "context"])
@pytest.mark.parametrize(
    "extra",
    [
        "response_time_ms",
        "pronunciation",
        "item_difficulty",
        "timing_evidence",
        "network_delay",
        "server_receipt_at",
        "card_id",
        "scheduler_type",
    ],
)
def test_excluded_features_are_rejected_at_strict_boundaries(where, extra):
    module = adapter()
    with pytest.raises(ValidationError):
        if where == "input":
            ResearchSchedulerInput(**{**value().model_dump(), extra: 123})
        else:
            module.FsrsReconstructionContext(**{**context().model_dump(), extra: 123})


@pytest.mark.parametrize(
    "change",
    [
        {"user_id": str(USER)},
        {"vocabulary_item_id": True},
        {"prior_due_at_utc": AT.replace(tzinfo=None)},
    ],
)
def test_reconstruction_context_rejects_coercion_and_naive_due(change):
    adapter()
    with pytest.raises(ValidationError):
        context(**change)


@pytest.mark.parametrize("first", [False, True])
def test_prior_due_presence_must_match_the_input_before_library_entry(
    monkeypatch, first
):
    module = adapter()
    first_case = GOLDENS["cases"][0]
    previous = run_case(first_case)[0]

    def forbidden(*args, **kwargs):
        pytest.fail("Invalid reconstruction facts entered the library")

    monkeypatch.setattr(Scheduler, "review_card", forbidden)
    inputs = (
        value()
        if first
        else value(
            prior=previous.scheduler_state, previous=AT, at=AT + timedelta(days=2)
        )
    )
    with pytest.raises(ValueError):
        module.EnhancedFsrsScheduler().schedule(
            inputs, context(previous.due_at if first else None)
        )


def test_incompatible_or_forged_state_is_revalidated_before_library(monkeypatch):
    module = adapter()
    first = run_case(GOLDENS["cases"][0])[0]
    conventional = ConventionalState(
        schema_version=1,
        scheduler_type="conventional_srs",
        algorithm_version="sm2-binary-v1",
        config_version="sm2-binary-config-v1",
        memory={
            "repetition_count": 1,
            "ease_factor": 2.5,
            "interval_days": 1,
            "lapse_count": 0,
        },
    )
    invalid = first.scheduler_state.model_copy(
        update={
            "memory": first.scheduler_state.memory.model_copy(update={"stability": 0.0})
        }
    )

    def forbidden(*args, **kwargs):
        pytest.fail("Incompatible state entered the library")

    monkeypatch.setattr(Scheduler, "review_card", forbidden)
    for state in (conventional, invalid):
        with pytest.raises(ValidationError):
            module.EnhancedFsrsScheduler().schedule(
                value(
                    prior=first.scheduler_state, previous=AT, at=AT + timedelta(days=2)
                ).model_copy(update={"prior_state": state}),
                context(first.due_at),
            )


@pytest.mark.parametrize("raw_input", [False, True])
def test_arbitrary_dictionaries_are_not_trusted_by_the_adapter(raw_input):
    module = adapter()
    with pytest.raises(TypeError):
        module.EnhancedFsrsScheduler().schedule(
            value().model_dump() if raw_input else value(),
            context() if raw_input else context().model_dump(),
        )


@pytest.mark.parametrize(
    "field,bad",
    [
        ("state", State.Learning),
        ("step", 0),
        ("stability", float("nan")),
        ("stability", 0.0),
        ("stability", True),
        ("stability", "1.2"),
        ("difficulty", float("inf")),
        ("difficulty", 0.0),
        ("difficulty", 11.0),
        ("difficulty", True),
        ("due", AT + timedelta(days=2, microseconds=1)),
        ("due", AT),
        ("due", AT - timedelta(days=1)),
        ("due", AT + timedelta(days=36501)),
        ("last_review", AT - timedelta(seconds=1)),
        ("card_id", 1),
    ],
)
def test_malformed_library_output_fails_closed(monkeypatch, field, bad):
    module = adapter()

    class CorruptScheduler(Scheduler):
        def review_card(self, *args, **kwargs):
            card, log = super().review_card(*args, **kwargs)
            setattr(card, field, bad)
            return card, log

    monkeypatch.setattr(module, "Scheduler", CorruptScheduler)
    with pytest.raises(ValueError):
        module.EnhancedFsrsScheduler().schedule(value(), context())
