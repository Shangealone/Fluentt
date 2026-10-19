"""Pure pinned FSRS-6 binary adaptation; no research acceptance routing."""

import json
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import NamedTuple
from uuid import UUID

from fsrs import Card, Rating, Scheduler, State

from app.research_authority.config_v1 import CONFIGURATIONS
from app.scheduling.research_contracts import (
    EnhancedState,
    FsrsMemory,
    ResearchSchedulerIdentity,
    ResearchSchedulerInput,
    ResearchSchedulerResult,
    StrictContract,
    UtcDatetime,
    due_anchor_validation_error,
    validate_research_result,
)


class FsrsReconstructionContext(StrictContract):
    """Server-owned identity/due facts, separate from mathematical input."""

    user_id: UUID
    vocabulary_item_id: UUID
    prior_due_at_utc: UtcDatetime | None


class _Configuration(NamedTuple):
    identity: ResearchSchedulerIdentity
    parameters: tuple[float, ...]
    desired_retention: float
    learning_steps: tuple[timedelta, ...]
    relearning_steps: tuple[timedelta, ...]
    maximum_interval: int
    minimum_interval: int
    day_seconds: int
    enable_fuzzing: bool
    correct_rating: Rating
    incorrect_rating: Rating


def _configuration() -> _Configuration:
    record = next(
        row
        for row in CONFIGURATIONS
        if row["config_version"] == "fsrs6-binary-r90-config-v1"
    )
    digest = "4e4c56a9f928cae5581e5d577de413b17c9d581185482db423a98551f6575e4f"
    if (
        sha256(record["canonical_document"].encode("utf-8")).hexdigest() != digest
        or record["config_sha256"] != digest
    ):
        raise ValueError("FSRS-6 frozen configuration digest mismatch")
    config = json.loads(record["canonical_document"])
    identity = ResearchSchedulerIdentity.model_validate(
        {key: config[key] for key in ResearchSchedulerIdentity.model_fields}
    )
    if any(record[key] != value for key, value in identity.model_dump().items()):
        raise ValueError("FSRS-6 frozen configuration identity mismatch")
    # FSRS deliberately uses the pinned engine's binary64 arithmetic, not Decimal.
    return _Configuration(
        identity=identity,
        parameters=tuple(float(value) for value in config["parameters"]),
        desired_retention=float(config["desired_retention"]),
        learning_steps=tuple(
            timedelta(seconds=value) for value in config["learning_steps_seconds"]
        ),
        relearning_steps=tuple(
            timedelta(seconds=value) for value in config["relearning_steps_seconds"]
        ),
        maximum_interval=config["maximum_interval_days"],
        minimum_interval=config["minimum_interval_days"],
        day_seconds=config["day_seconds"],
        enable_fuzzing=config["enable_fuzzing"],
        correct_rating=Rating(config["binary_rating"]["correct"]),
        incorrect_rating=Rating(config["binary_rating"]["incorrect"]),
    )


# Detached immutable values; schedule() never consults mutable seed dictionaries.
_CONFIG = _configuration()


class EnhancedFsrsScheduler:
    """One pure transition from validated application facts and explicit UTC.

    Ownership, assignment, chronology and review eligibility belong to future
    acceptance integration. Engine presence does not enable research routing.
    """

    __slots__ = ()

    def schedule(
        self,
        inputs: ResearchSchedulerInput,
        reconstruction: FsrsReconstructionContext,
    ) -> ResearchSchedulerResult:
        if not isinstance(inputs, ResearchSchedulerInput):
            raise TypeError("FSRS-6 requires ResearchSchedulerInput")
        if not isinstance(reconstruction, FsrsReconstructionContext):
            raise TypeError("FSRS-6 requires FsrsReconstructionContext")
        # Revalidate copies: model_copy/model_construct can bypass validation.
        inputs = ResearchSchedulerInput.model_validate(inputs.model_dump())
        reconstruction = FsrsReconstructionContext.model_validate(
            reconstruction.model_dump()
        )
        if (inputs.prior_state is None) != (reconstruction.prior_due_at_utc is None):
            raise ValueError("Prior state, interaction and due must agree in presence")

        prior = (
            EnhancedState.model_validate(inputs.prior_state.model_dump())
            if inputs.prior_state is not None
            else None
        )
        card_id = (
            reconstruction.user_id.int << 128
        ) | reconstruction.vocabulary_item_id.int
        card = Card(
            card_id=card_id,
            state=State.Review if prior else State.Learning,
            step=None if prior else 0,
            stability=prior.memory.stability if prior else None,
            difficulty=prior.memory.difficulty if prior else None,
            due=(
                reconstruction.prior_due_at_utc if prior else inputs.interaction_at_utc
            ),
            last_review=inputs.prior_interaction_at_utc,
        )
        scheduler = Scheduler(
            parameters=_CONFIG.parameters,
            desired_retention=_CONFIG.desired_retention,
            learning_steps=_CONFIG.learning_steps,
            relearning_steps=_CONFIG.relearning_steps,
            maximum_interval=_CONFIG.maximum_interval,
            enable_fuzzing=_CONFIG.enable_fuzzing,
        )
        try:
            updated, _ = scheduler.review_card(
                card,
                _CONFIG.correct_rating if inputs.correct else _CONFIG.incorrect_rating,
                review_datetime=inputs.interaction_at_utc,
                review_duration=None,
            )
        except OverflowError as error:
            # The pinned transition computes its due before returning the Card.
            # No representable result exists: retain the cause, never retry or
            # fabricate an interval/due. This is a result error, not client time.
            raise due_anchor_validation_error(None) from error
        if updated.state is not State.Review or updated.step is not None:
            raise ValueError("FSRS-6 must produce Review with no learning step")
        if type(updated.card_id) is not int or updated.card_id != card_id:
            raise ValueError("FSRS-6 changed deterministic card identity")
        if (
            not isinstance(updated.last_review, datetime)
            or updated.last_review.tzinfo is not UTC
            or updated.last_review != inputs.interaction_at_utc
        ):
            raise ValueError("FSRS-6 last review must match the UTC interaction")
        memory = FsrsMemory(
            state="Review",
            step=None,
            stability=updated.stability,
            difficulty=updated.difficulty,
        )
        if not isinstance(updated.due, datetime) or updated.due.tzinfo is not UTC:
            raise ValueError("FSRS-6 due must be UTC aware")
        delta = updated.due - inputs.interaction_at_utc
        days = delta.days
        if (
            delta.seconds != 0
            or delta.microseconds != 0
            or not _CONFIG.minimum_interval <= days <= _CONFIG.maximum_interval
        ):
            raise ValueError("FSRS-6 interval must be positive bounded whole days")
        due = inputs.interaction_at_utc + timedelta(days=days)
        if due != updated.due:
            raise ValueError("FSRS-6 due disagrees with the interaction anchor")
        identity = _CONFIG.identity
        state = EnhancedState(
            schema_version=identity.state_schema_version,
            scheduler_type=identity.scheduler_type,
            algorithm_version=identity.algorithm_version,
            config_version=identity.config_version,
            memory=memory,
        )
        return validate_research_result(
            {
                **identity.model_dump(),
                "interval_days": days,
                "interval_seconds": days * _CONFIG.day_seconds,
                "due_at": due,
                "scheduler_state": state,
            },
            inputs,
        )
