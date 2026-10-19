"""Pure Binary SM-2 adaptation (sm2-binary-v1); no acceptance routing."""

import json
from datetime import timedelta
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
from hashlib import sha256
from types import MappingProxyType

from app.research_authority.config_v1 import CONFIGURATIONS
from app.scheduling.research_contracts import (
    ConventionalState,
    ResearchSchedulerIdentity,
    ResearchSchedulerInput,
    ResearchSchedulerResult,
    Sm2Memory,
    validate_research_result,
)


def _freeze(value):
    if isinstance(value, dict):
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    return value


def _configuration():
    record = next(
        row for row in CONFIGURATIONS if row["config_version"] == "sm2-binary-config-v1"
    )
    expected_digest = "3bd486d1183d84a869a2470f0a97a13ecabc44365eb9fe8e158014fd1ef2a0d9"
    if (
        sha256(record["canonical_document"].encode("utf-8")).hexdigest()
        != expected_digest
        or record["config_sha256"] != expected_digest
    ):
        raise ValueError("Binary SM-2 frozen configuration digest mismatch")
    config = json.loads(record["canonical_document"])
    identity = ResearchSchedulerIdentity.model_validate(
        {key: config[key] for key in ResearchSchedulerIdentity.model_fields}
    )
    if any(record[key] != value for key, value in identity.model_dump().items()):
        raise ValueError("Binary SM-2 frozen configuration identity mismatch")
    return _freeze(config)


# A detached, recursively immutable snapshot; the seed dictionaries are never
# consulted by schedule(), and callers cannot override the research method.
_CONFIG = _configuration()


class BinarySm2Scheduler:
    """Binary SM-2 adaptation, consuming only validated D11B research facts.

    Chronology, ownership and assignment authorization belong to the service.
    Creating or invoking this engine does not enable research acceptance.
    """

    __slots__ = ()

    def schedule(self, inputs: ResearchSchedulerInput) -> ResearchSchedulerResult:
        if not isinstance(inputs, ResearchSchedulerInput):
            raise TypeError("Binary SM-2 requires ResearchSchedulerInput")
        # Construct a complete policy per call, independently of caller/default
        # context. The whole synchronous validation/calculation path is enclosed.
        # Inexact is an error; dropping only insignificant trailing zeroes may set
        # Rounded without changing a valid EF's exact value.
        with localcontext(
            Context(
                prec=28,
                rounding=ROUND_HALF_EVEN,
                Emin=-999999,
                Emax=999999,
                capitals=1,
                clamp=0,
                flags=[],
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
            # Revalidate copies too: model_copy/model_construct can bypass Pydantic.
            inputs = ResearchSchedulerInput.model_validate(inputs.model_dump())
            if inputs.prior_state is None:
                initial = _CONFIG["initial_memory"]
                repetitions = initial["repetition_count"]
                ease = Decimal(initial["ease_factor"])
                previous_days = initial["interval_days"]
                lapses = initial["lapse_count"]
            else:
                state = ConventionalState.model_validate(
                    inputs.prior_state.model_dump()
                )
                repetitions = state.memory.repetition_count
                ease = state.memory.ease_factor
                previous_days = state.memory.interval_days
                lapses = state.memory.lapse_count

            quality = _CONFIG["binary_rating"][
                "correct" if inputs.correct else "incorrect"
            ]
            distance = 5 - quality
            ease = max(
                Decimal(_CONFIG["ease_update"]["minimum"]),
                ease
                + Decimal("0.1")
                - distance * (Decimal("0.08") + distance * Decimal("0.02")),
            )
            if inputs.correct:
                transition = _CONFIG["correct_transition"]
                first_intervals = transition["first_intervals_days"]
                days = (
                    first_intervals[repetitions]
                    if repetitions < len(first_intervals)
                    else int(
                        (Decimal(previous_days) * ease).to_integral_value(
                            rounding=ROUND_CEILING
                        )
                    )
                )
                repetitions += transition["repetition_increment"]
                lapses += transition["lapse_increment"]
            else:
                transition = _CONFIG["incorrect_transition"]
                repetitions = transition["repetition_reset"]
                days = transition["interval_days"]
                lapses += transition["lapse_increment"]
            days = min(
                _CONFIG["maximum_interval_days"],
                max(_CONFIG["minimum_interval_days"], days),
            )
            memory = Sm2Memory(
                repetition_count=repetitions,
                ease_factor=ease,
                interval_days=days,
                lapse_count=lapses,
            )
            state = ConventionalState(
                schema_version=_CONFIG["state_schema_version"],
                scheduler_type=_CONFIG["scheduler_type"],
                algorithm_version=_CONFIG["algorithm_version"],
                config_version=_CONFIG["config_version"],
                memory=memory,
            )
            seconds = days * _CONFIG["day_seconds"]
            try:
                due = inputs.interaction_at_utc + timedelta(seconds=seconds)
            except OverflowError:
                # The existing result validator rejects every representable due
                # candidate when the true sum overflows (due_anchor). This value
                # is only a rejection candidate: it is never returned as a due.
                due = inputs.interaction_at_utc
            return validate_research_result(
                {
                    "scheduler_type": state.scheduler_type,
                    "algorithm_version": state.algorithm_version,
                    "state_schema_version": state.schema_version,
                    "config_version": state.config_version,
                    "interval_days": days,
                    "interval_seconds": seconds,
                    "due_at": due,
                    "scheduler_state": state,
                },
                inputs,
            )
