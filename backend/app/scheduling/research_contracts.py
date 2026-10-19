"""D11A application-owned evidence contracts. No research engine is executable here."""

import math
from datetime import UTC, datetime, timedelta
from decimal import (
    ROUND_CEILING,
    ROUND_HALF_EVEN,
    Clamped,
    Context,
    Decimal,
    DivisionByZero,
    FloatOperation,
    Inexact,
    InvalidOperation,
    Overflow,
    Subnormal,
    Underflow,
    localcontext,
)
from typing import Annotated, Any, Literal, Self

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    TypeAdapter,
    ValidationError,
    field_serializer,
    model_validator,
)

DAY_SECONDS = 86400
MAX_INTERVAL_DAYS = 36500
IDENTITIES = frozenset(
    {
        ("conventional_srs", "sm2-binary-v1", 1, "sm2-binary-config-v1"),
        (
            "enhanced_srs",
            "fluentt-esr-fsrs6-binary-v1",
            1,
            "fsrs6-binary-r90-config-v1",
        ),
    }
)


def _decimal_number(value: Any) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError("Expected a numeric value without coercion")  # noqa: TRY004 -- Pydantic validation
    result = Decimal(str(value))
    if not result.is_finite():
        raise ValueError("Nonfinite memory value")
    return result


def _finite_number(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("Expected a numeric value without coercion")  # noqa: TRY004 -- Pydantic validation
    try:
        result = float(value)
    except OverflowError as error:
        raise ValueError("Numeric memory value is not representable") from error
    if not math.isfinite(result):
        raise ValueError("Nonfinite memory value")
    return result


def _utc(value: datetime) -> datetime:
    try:
        return value.astimezone(UTC)
    except OverflowError as error:
        # Pydantic wraps this in a field-local ValidationError. Keep the instant;
        # an out-of-domain UTC conversion cannot be repaired by clamping it.
        raise ValueError("Datetime cannot be represented in UTC") from error


UtcDatetime = Annotated[AwareDatetime, AfterValidator(_utc)]
FiniteNumber = Annotated[float, BeforeValidator(_finite_number)]
EaseFactor = Annotated[
    Decimal,
    BeforeValidator(_decimal_number),
    Field(ge=Decimal("1.3"), le=Decimal("2.5")),
]
Counter = Annotated[StrictInt, Field(ge=0)]
Days = Annotated[StrictInt, Field(ge=1, le=MAX_INTERVAL_DAYS)]
SchemaVersion = Annotated[StrictInt, Field(ge=1, le=1)]


class StrictContract(BaseModel):
    model_config = ConfigDict(
        extra="forbid", frozen=True, strict=True, allow_inf_nan=False
    )


class Sm2Memory(StrictContract):
    repetition_count: Counter
    ease_factor: EaseFactor
    interval_days: Days
    lapse_count: Counter

    @field_serializer("ease_factor", when_used="json")
    def json_ease(self, value: Decimal) -> float:
        # Reachable EF values have at most two decimal places; JSON round-trips them.
        return float(value)

    @model_validator(mode="after")
    def reachable(self) -> Self:
        # Validation also runs after the engine returns. Own the same complete
        # numeric policy here; neither caller settings nor flags may participate.
        with localcontext(
            Context(
                prec=28,
                rounding=ROUND_HALF_EVEN,
                Emin=-999999,
                Emax=999999,
                capitals=1,
                clamp=0,
                flags=[],
                # Inexact is an error; Rounded alone may discard only redundant
                # trailing zeroes from an exact accepted Decimal representation.
                traps=[
                    InvalidOperation,
                    DivisionByZero,
                    Overflow,
                    Underflow,
                    Inexact,
                    Subnormal,
                    Clamped,
                    FloatOperation,
                ],
            )
        ):
            expected_ease = (
                Decimal("1.3")
                if self.lapse_count >= 4
                else Decimal("2.5") - Decimal("0.32") * self.lapse_count
            )
            if self.ease_factor != expected_ease:
                raise ValueError("Ease factor is unreachable for the lapse count")
            repetitions = self.repetition_count
            if repetitions == 0 and self.lapse_count == 0:
                raise ValueError("Transient initial state cannot be persisted")
            expected_days = 1 if repetitions < 2 else 6
            # Validate snapshot reachability only; this is not an answer transition API.
            remaining = max(0, repetitions - 2)
            while remaining and expected_days < MAX_INTERVAL_DAYS:
                expected_days = min(
                    MAX_INTERVAL_DAYS,
                    int(
                        (Decimal(expected_days) * self.ease_factor).to_integral_value(
                            rounding=ROUND_CEILING
                        )
                    ),
                )
                remaining -= 1
            if self.interval_days != expected_days:
                raise ValueError("Interval is unreachable for this accepted memory")
            return self


class FsrsMemory(StrictContract):
    state: Literal["Review"]
    step: None
    stability: Annotated[FiniteNumber, Field(gt=0)]
    difficulty: Annotated[FiniteNumber, Field(ge=1, le=10)]


class ConventionalState(StrictContract):
    schema_version: SchemaVersion
    scheduler_type: Literal["conventional_srs"]
    algorithm_version: Literal["sm2-binary-v1"]
    config_version: Literal["sm2-binary-config-v1"]
    memory: Sm2Memory


class EnhancedState(StrictContract):
    schema_version: SchemaVersion
    scheduler_type: Literal["enhanced_srs"]
    algorithm_version: Literal["fluentt-esr-fsrs6-binary-v1"]
    config_version: Literal["fsrs6-binary-r90-config-v1"]
    memory: FsrsMemory


ResearchState = ConventionalState | EnhancedState
_STATE_DECODER = TypeAdapter(ResearchState)


def decode_research_state(value: Any) -> ResearchState:
    return _STATE_DECODER.validate_python(value)


class ResearchSchedulerIdentity(StrictContract):
    scheduler_type: str
    algorithm_version: str
    state_schema_version: SchemaVersion
    config_version: str

    @model_validator(mode="after")
    def supported(self) -> Self:
        if (
            self.scheduler_type,
            self.algorithm_version,
            self.state_schema_version,
            self.config_version,
        ) not in IDENTITIES:
            raise ValueError("Unsupported research scheduler identity")
        return self


class ResearchSchedulerInput(StrictContract):
    correct: StrictBool
    interaction_at_utc: UtcDatetime
    prior_state: ResearchState | None
    prior_interaction_at_utc: UtcDatetime | None

    @model_validator(mode="after")
    def predecessor_pair(self) -> Self:
        if (self.prior_state is None) != (self.prior_interaction_at_utc is None):
            raise ValueError(
                "Prior state and interaction must both exist or both be absent"
            )
        return self


class ResearchSchedulerResult(ResearchSchedulerIdentity):
    interval_days: Days
    interval_seconds: StrictInt
    due_at: UtcDatetime
    scheduler_state: ResearchState

    @model_validator(mode="after")
    def consistent(self) -> Self:
        state = self.scheduler_state
        if (
            state.scheduler_type,
            state.algorithm_version,
            state.schema_version,
            state.config_version,
        ) != (
            self.scheduler_type,
            self.algorithm_version,
            self.state_schema_version,
            self.config_version,
        ):
            raise ValueError("Result and state identities disagree")
        if self.interval_seconds != self.interval_days * DAY_SECONDS:
            raise ValueError("Result interval seconds disagree with whole days")
        if (
            isinstance(state, ConventionalState)
            and state.memory.interval_days != self.interval_days
        ):
            raise ValueError("Result interval disagrees with SM-2 memory")
        return self


def due_anchor_validation_error(due_at: Any) -> ValidationError:
    """Shared result-domain error, including a due that cannot be computed."""
    from pydantic_core import PydanticCustomError

    return ValidationError.from_exception_data(
        "ResearchSchedulerResult",
        [
            {
                "type": PydanticCustomError(
                    "due_anchor", "Due time must use the interaction anchor"
                ),
                "loc": ("due_at",),
                "input": due_at,
            }
        ],
    )


def _result_field_data(value: Any) -> Any:
    """Reconstruct model fields without serializers or trusted nested instances."""
    if isinstance(value, BaseModel):
        # model_copy can retain unknown keys in __dict__, even with extra=forbid.
        # Keep them visible to fresh validation; model_dump could omit them.
        value = {**vars(value), **(value.model_extra or {})}
    if isinstance(value, dict):
        return {key: _result_field_data(item) for key, item in value.items()}
    # Preserve exact Decimal, datetime and binary64 values for the validators.
    return value


def validate_research_result(
    value: Any, inputs: ResearchSchedulerInput
) -> ResearchSchedulerResult:
    result = ResearchSchedulerResult.model_validate(_result_field_data(value))
    try:
        expected_due = inputs.interaction_at_utc + timedelta(
            seconds=result.interval_seconds
        )
    except OverflowError:
        expected_due = None
    if result.due_at != expected_due:
        raise due_anchor_validation_error(result.due_at)
    return result
