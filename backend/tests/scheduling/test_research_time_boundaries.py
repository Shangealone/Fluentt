"""D11-T1 controlled research errors at Python datetime representability limits."""

import copy
from datetime import UTC, datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import HTTPException
from fsrs import Scheduler
from pydantic import ValidationError

from app.research_authority.config_v1 import CONFIGURATIONS
from app.reviews.acceptance import (
    Predecessor,
    validate_research_chronology,
    validate_research_predecessor,
)
from app.scheduling import fsrs6
from app.scheduling.research_contracts import (
    EnhancedState,
    ResearchSchedulerInput,
    ResearchSchedulerResult,
    validate_research_result,
)
from app.scheduling.sm2 import BinarySm2Scheduler

MIN = datetime.min.replace(tzinfo=UTC)
MAX = datetime.max.replace(tzinfo=UTC)
AT = datetime(2026, 1, 1, 10, 11, 12, 123456, tzinfo=UTC)
UNREPRESENTABLE = (
    datetime.min.replace(tzinfo=timezone(timedelta(hours=8))),
    datetime.max.replace(tzinfo=timezone(-timedelta(hours=8))),
)
OWNER, ITEM, ASSIGNMENT, ATTEMPT = (UUID(int=n) for n in range(1, 5))


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """No database setup for disconnected pure/helper boundary tests."""


@pytest.fixture(autouse=True)
def isolate_test_database():
    """No database cleanup: these tests never persist evidence."""


def enhanced_state():
    return EnhancedState(
        schema_version=1,
        scheduler_type="enhanced_srs",
        algorithm_version="fluentt-esr-fsrs6-binary-v1",
        config_version="fsrs6-binary-r90-config-v1",
        memory={
            "state": "Review",
            "step": None,
            "stability": 2.3065,
            "difficulty": 2.118103970459016,
        },
    )


def facts(at=AT, correct=True, subsequent=False):
    return ResearchSchedulerInput(
        correct=correct,
        interaction_at_utc=at,
        prior_state=enhanced_state() if subsequent else None,
        prior_interaction_at_utc=AT if subsequent else None,
    )


def context(subsequent=False):
    return fsrs6.FsrsReconstructionContext(
        user_id=OWNER,
        vocabulary_item_id=ITEM,
        prior_due_at_utc=AT + timedelta(days=2) if subsequent else None,
    )


def result_data(due=AT + timedelta(days=1)):
    state = enhanced_state()
    return {
        "scheduler_type": state.scheduler_type,
        "algorithm_version": state.algorithm_version,
        "state_schema_version": 1,
        "config_version": state.config_version,
        "interval_days": 1,
        "interval_seconds": 86400,
        "due_at": due,
        "scheduler_state": state,
    }


def predecessor(at, due, seconds=86400):
    """Complete read fields, with a config-only reader and no evidence writer."""
    record = next(r for r in CONFIGURATIONS if r["scheduler_type"] == "enhanced_srs")
    config = SimpleNamespace(**record)
    condition = SimpleNamespace(
        id=ASSIGNMENT,
        user_id=OWNER,
        **{
            k: record[k]
            for k in (
                "scheduler_type",
                "algorithm_version",
                "state_schema_version",
                "config_version",
                "config_sha256",
            )
        },
    )
    attempt = SimpleNamespace(
        id=ATTEMPT,
        user_id=OWNER,
        vocabulary_item_id=ITEM,
        research_assignment_id=ASSIGNMENT,
        scheduler_type=record["scheduler_type"],
        algorithm_version=record["algorithm_version"],
        client_interaction_at=at,
        correct=True,
    )
    schedule = SimpleNamespace(
        user_id=OWNER,
        vocabulary_item_id=ITEM,
        attempt_id=ATTEMPT,
        scheduler_type=record["scheduler_type"],
        algorithm_version=record["algorithm_version"],
        interval_seconds=seconds,
        due_at=due,
        scheduler_state=enhanced_state().model_dump(),
    )

    class ConfigReader:
        def get(self, model, key, *, populate_existing):
            assert key == record["config_version"] and populate_existing is True
            return config

    return ConfigReader(), Predecessor(attempt, schedule), condition


@pytest.mark.parametrize("bad", UNREPRESENTABLE, ids=["underflow", "overflow"])
@pytest.mark.parametrize("field", ["interaction_at_utc", "prior_interaction_at_utc"])
def test_model_utc_conversion_wraps_unrepresentable_instants(bad, field):
    data = facts(subsequent=field == "prior_interaction_at_utc").model_dump()
    data[field] = bad
    with pytest.raises(ValidationError) as error:
        ResearchSchedulerInput.model_validate(data)
    assert error.value.errors()[0]["loc"] == (field,)
    assert error.value.errors()[0]["type"] == "value_error"


@pytest.mark.parametrize("bad", UNREPRESENTABLE, ids=["underflow", "overflow"])
def test_context_and_result_utc_conversion_use_model_validation(bad):
    with pytest.raises(ValidationError) as error:
        fsrs6.FsrsReconstructionContext.model_validate(
            {
                **context().model_dump(),
                "prior_due_at_utc": bad,
            }
        )
    assert error.value.errors()[0]["loc"] == ("prior_due_at_utc",)
    assert error.value.errors()[0]["type"] == "value_error"
    with pytest.raises(ValidationError) as error:
        ResearchSchedulerResult.model_validate(result_data(bad))
    assert error.value.errors()[0]["loc"] == ("due_at",)
    assert error.value.errors()[0]["type"] == "value_error"


@pytest.mark.parametrize("bad", UNREPRESENTABLE, ids=["underflow", "overflow"])
def test_chronology_incoming_unrepresentable_is_client_time_invalid(bad):
    with pytest.raises(HTTPException) as error:
        validate_research_chronology(bad, None)
    assert (error.value.status_code, error.value.detail) == (422, "D11_TIME_INVALID")


@pytest.mark.parametrize("bad", UNREPRESENTABLE, ids=["underflow", "overflow"])
def test_chronology_prior_unrepresentable_is_stored_state_corrupt(bad):
    with pytest.raises(HTTPException) as error:
        validate_research_chronology(AT, bad)
    assert (error.value.status_code, error.value.detail) == (500, "D11_STATE_CORRUPT")


@pytest.mark.parametrize("seconds", [86400, 3153600000])
def test_predecessor_due_addition_overflow_is_integrity_error_without_mutation(seconds):
    db, prior, condition = predecessor(MAX, MAX, seconds)
    before = copy.deepcopy((vars(prior.attempt), vars(prior.schedule), vars(condition)))
    with pytest.raises(HTTPException) as error:
        validate_research_predecessor(db, prior, condition)
    assert (error.value.status_code, error.value.detail) == (500, "D11_STATE_CORRUPT")
    assert (vars(prior.attempt), vars(prior.schedule), vars(condition)) == before


def test_predecessor_plus_eight_upper_boundary_normalizes_before_one_day_addition():
    plus_eight = timezone(timedelta(hours=8))
    interaction = datetime(9999, 12, 31, 7, 59, 59, 999999, tzinfo=plus_eight)
    assert interaction.astimezone(UTC) == MAX - timedelta(days=1)
    db, prior, condition = predecessor(interaction, MAX)
    before = copy.deepcopy((vars(prior.attempt), vars(prior.schedule), vars(condition)))

    assert validate_research_predecessor(db, prior, condition) == enhanced_state()
    assert (vars(prior.attempt), vars(prior.schedule), vars(condition)) == before


def test_predecessor_utc_and_plus_eight_upper_boundary_results_are_identical():
    utc_interaction = MAX - timedelta(days=1)
    plus_eight_interaction = datetime(
        9999, 12, 31, 7, 59, 59, 999999, tzinfo=timezone(timedelta(hours=8))
    )
    results = []
    for interaction in (utc_interaction, plus_eight_interaction):
        db, prior, condition = predecessor(interaction, MAX)
        results.append(validate_research_predecessor(db, prior, condition))

    assert results == [enhanced_state(), enhanced_state()]


def test_predecessor_unrepresentable_lower_plus_eight_is_stored_state_corrupt():
    interaction = datetime.min.replace(tzinfo=timezone(timedelta(hours=8)))
    due = datetime(1, 1, 1, 16, tzinfo=UTC)
    db, prior, condition = predecessor(interaction, due)
    before = copy.deepcopy((vars(prior.attempt), vars(prior.schedule), vars(condition)))

    with pytest.raises(HTTPException) as error:
        validate_research_predecessor(db, prior, condition)

    assert (error.value.status_code, error.value.detail) == (500, "D11_STATE_CORRUPT")
    assert isinstance(error.value.__cause__, OverflowError)
    assert (vars(prior.attempt), vars(prior.schedule), vars(condition)) == before


def test_predecessor_naive_interaction_is_stored_state_corrupt():
    interaction = AT.replace(tzinfo=None)
    due = interaction + timedelta(days=1)
    db, prior, condition = predecessor(interaction, due)

    with pytest.raises(HTTPException) as error:
        validate_research_predecessor(db, prior, condition)

    assert (error.value.status_code, error.value.detail) == (500, "D11_STATE_CORRUPT")


@pytest.mark.parametrize(
    "utc_interaction",
    [
        datetime(1900, 2, 28, 23, 59, 59, 123456, tzinfo=UTC),
        datetime(2024, 2, 29, 12, 34, 56, 654321, tzinfo=UTC),
        datetime(2099, 12, 31, 0, 0, 0, 1, tzinfo=UTC),
    ],
    ids=["pre-epoch", "leap-day", "future-fixed"],
)
def test_predecessor_offset_representations_preserve_same_instant(utc_interaction):
    due = utc_interaction + timedelta(days=1)
    results = []
    for zone in (UTC, timezone(timedelta(hours=8)), timezone(-timedelta(hours=8))):
        db, prior, condition = predecessor(utc_interaction.astimezone(zone), due)
        results.append(validate_research_predecessor(db, prior, condition))

    assert results == [enhanced_state(), enhanced_state(), enhanced_state()]


def test_predecessor_nearest_valid_plus_eight_to_utc_min_remains_valid():
    interaction = datetime(1, 1, 1, 8, tzinfo=timezone(timedelta(hours=8)))
    assert interaction.astimezone(UTC) == MIN
    db, prior, condition = predecessor(interaction, MIN + timedelta(days=1))

    assert validate_research_predecessor(db, prior, condition) == enhanced_state()


def test_predecessor_one_microsecond_past_max_safe_anchor_overflows():
    interaction = datetime(9999, 12, 31, 8, tzinfo=timezone(timedelta(hours=8)))
    assert interaction.astimezone(UTC) == datetime(9999, 12, 31, tzinfo=UTC)
    db, prior, condition = predecessor(interaction, MAX)

    with pytest.raises(HTTPException) as error:
        validate_research_predecessor(db, prior, condition)

    assert (error.value.status_code, error.value.detail) == (500, "D11_STATE_CORRUPT")
    assert isinstance(error.value.__cause__, OverflowError)


def test_predecessor_36500_day_interval_can_reach_exact_utc_max():
    interaction = MAX - timedelta(days=36500)
    db, prior, condition = predecessor(interaction, MAX, seconds=3153600000)

    assert validate_research_predecessor(db, prior, condition) == enhanced_state()


def test_shared_result_due_overflow_retains_existing_controlled_error():
    with pytest.raises(ValidationError) as error:
        validate_research_result(result_data(MAX), facts(MAX))
    assert (error.value.errors()[0]["loc"], error.value.errors()[0]["type"]) == (
        ("due_at",),
        "due_anchor",
    )


@pytest.mark.parametrize("correct", [True, False], ids=["Good", "Again"])
@pytest.mark.parametrize("subsequent", [False, True], ids=["first", "subsequent"])
def test_fsrs_due_overflow_is_result_validation_with_one_real_transition(
    monkeypatch,
    correct,
    subsequent,
):
    calls = []

    class ObservedScheduler(Scheduler):
        def review_card(self, card, rating, *, review_datetime, review_duration):
            calls.append((review_datetime, review_duration))
            return super().review_card(
                card,
                rating,
                review_datetime=review_datetime,
                review_duration=review_duration,
            )

    monkeypatch.setattr(fsrs6, "Scheduler", ObservedScheduler)
    inputs, reconstruction = facts(MAX, correct, subsequent), context(subsequent)
    before = copy.deepcopy((inputs.model_dump(), reconstruction.model_dump()))
    with pytest.raises(ValidationError) as error:
        fsrs6.EnhancedFsrsScheduler().schedule(inputs, reconstruction)
    assert (error.value.errors()[0]["loc"], error.value.errors()[0]["type"]) == (
        ("due_at",),
        "due_anchor",
    )
    assert isinstance(error.value.__cause__, OverflowError)
    assert calls == [(MAX, None)]
    assert (inputs.model_dump(), reconstruction.model_dump()) == before


@pytest.mark.parametrize("correct", [True, False])
def test_sm2_due_overflow_already_uses_result_validation(correct):
    with pytest.raises(ValidationError) as error:
        BinarySm2Scheduler().schedule(facts(MAX, correct))
    assert (error.value.errors()[0]["loc"], error.value.errors()[0]["type"]) == (
        ("due_at",),
        "due_anchor",
    )


@pytest.mark.parametrize("error_type", [RuntimeError, ValueError])
def test_fsrs_does_not_hide_unrelated_library_errors(monkeypatch, error_type):
    failure = error_type("unrelated library failure")

    class FailingScheduler(Scheduler):
        def review_card(self, *args, **kwargs):
            raise failure

    monkeypatch.setattr(fsrs6, "Scheduler", FailingScheduler)
    with pytest.raises(error_type) as error:
        fsrs6.EnhancedFsrsScheduler().schedule(facts(), context())
    assert error.value is failure


@pytest.mark.parametrize("at", [MIN, MAX - timedelta(days=36500)])
@pytest.mark.parametrize("correct,days", [(True, 2), (False, 1)])
def test_first_fsrs_extremes_with_representable_due_keep_exact_result(
    at, correct, days
):
    result = fsrs6.EnhancedFsrsScheduler().schedule(facts(at, correct), context())
    assert result.interval_days == days and result.interval_seconds == days * 86400
    assert result.due_at == at + timedelta(days=days)
    assert result.scheduler_state.memory.stability == (2.3065 if correct else 0.212)


@pytest.mark.parametrize("correct,days", [(True, 2), (False, 1)])
def test_first_fsrs_due_can_equal_exact_max_without_clamping(correct, days):
    result = fsrs6.EnhancedFsrsScheduler().schedule(
        facts(MAX - timedelta(days=days), correct),
        context(),
    )
    assert result.due_at == MAX and result.interval_days == days


@pytest.mark.parametrize("correct", [True, False])
def test_subsequent_fsrs_near_upper_boundary_keeps_interaction_anchor(correct):
    at = MAX - timedelta(days=36500)
    result = fsrs6.EnhancedFsrsScheduler().schedule(
        facts(at, correct, True),
        context(True),
    )
    assert result.due_at == at + timedelta(days=result.interval_days)
    assert result.interval_seconds == result.interval_days * 86400


@pytest.mark.parametrize("at", [MIN, MAX - timedelta(days=1)])
def test_sm2_representable_boundary_keeps_exact_one_day(at):
    result = BinarySm2Scheduler().schedule(facts(at))
    assert result.interval_days == 1 and result.due_at == at + timedelta(days=1)


@pytest.mark.parametrize("at", [MIN, MAX - timedelta(days=1)])
def test_predecessor_representable_boundary_remains_valid(at):
    db, prior, condition = predecessor(at, at + timedelta(days=1))
    assert validate_research_predecessor(db, prior, condition) == enhanced_state()


@pytest.mark.parametrize("at", [MIN, MAX])
def test_chronology_safe_utc_endpoints_remain_unchanged(at):
    assert validate_research_chronology(at, None) == at
    assert facts(at).interaction_at_utc == at


@pytest.mark.parametrize(
    "local,utc",
    [
        (datetime(1, 1, 1, 8, tzinfo=timezone(timedelta(hours=8))), MIN),
        (
            datetime(
                9999, 12, 31, 15, 59, 59, 999999, tzinfo=timezone(-timedelta(hours=8))
            ),
            MAX,
        ),
    ],
)
def test_nearest_representable_offset_instants_are_not_rejected(local, utc):
    assert facts(local).interaction_at_utc == utc
    assert validate_research_chronology(local, None) == utc


@pytest.mark.parametrize("residue_us", [0, 1])
def test_fsrs_cap_at_exact_date_boundary_never_reduces_or_clamps(residue_us):
    state = enhanced_state().model_copy(
        update={
            "memory": enhanced_state().memory.model_copy(
                update={"stability": 100000000.0, "difficulty": 5.0},
            )
        }
    )
    inputs = facts(
        MAX - timedelta(days=36500) + timedelta(microseconds=residue_us),
        subsequent=True,
    ).model_copy(update={"prior_state": state})
    if residue_us:
        with pytest.raises(ValidationError) as error:
            fsrs6.EnhancedFsrsScheduler().schedule(inputs, context(True))
        assert (error.value.errors()[0]["loc"], error.value.errors()[0]["type"]) == (
            ("due_at",),
            "due_anchor",
        )
    else:
        result = fsrs6.EnhancedFsrsScheduler().schedule(inputs, context(True))
        assert result.interval_days == 36500
        assert result.interval_seconds == 3153600000 and result.due_at == MAX


def test_existing_chronology_codes_and_ordinary_offset_normalization_remain():
    offset = AT.astimezone(timezone(timedelta(hours=8)))
    assert validate_research_chronology(offset, AT - timedelta(microseconds=1)) == AT
    for incoming, prior, expected in (
        (AT.replace(tzinfo=None), None, (422, "D11_TIMEZONE_REQUIRED")),
        (AT, AT.replace(tzinfo=None), (500, "D11_STATE_CORRUPT")),
        (AT, AT, (409, "D11_STALE_INTERACTION")),
        (AT - timedelta(microseconds=1), AT, (409, "D11_STALE_INTERACTION")),
    ):
        with pytest.raises(HTTPException) as error:
            validate_research_chronology(incoming, prior)
        assert (error.value.status_code, error.value.detail) == expected
