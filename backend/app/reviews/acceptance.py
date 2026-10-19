"""D11 acceptance boundaries for development and explicitly gated research."""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.auth.models import User
from app.core.config import get_settings
from app.research_authority.models import (
    ParticipantAllocation,
    ParticipantSetCondition,
    ResearchProtocol,
    ResearchSet,
    ResearchSetMembership,
    SchedulerConfiguration,
)
from app.reviews.models import CurrentReviewSchedule, ReviewAttempt, ReviewSchedule
from app.scheduling.development import DevelopmentScheduler
from app.scheduling.fsrs6 import EnhancedFsrsScheduler
from app.scheduling.research_contracts import (
    ConventionalState,
    ResearchState,
    decode_research_state,
)
from app.scheduling.sm2 import BinarySm2Scheduler
from app.sync.models import AcceptedClientEvent


def acquire_learner_lock(db: Session, owner: uuid.UUID) -> None:
    if db.scalar(select(User.id).where(User.id == owner).with_for_update()) is None:
        raise HTTPException(500, "D11_CURRENT_CHAIN_INVALID")


def accepted_result(db: Session, owner: uuid.UUID, event_id: uuid.UUID):
    ledger = db.scalar(
        select(AcceptedClientEvent)
        .where(
            AcceptedClientEvent.user_id == owner,
            AcceptedClientEvent.client_event_id == event_id,
        )
        .execution_options(populate_existing=True)
    )
    if ledger is None:
        return None
    attempt = db.get(ReviewAttempt, ledger.attempt_id, populate_existing=True)
    schedule = db.scalar(
        select(ReviewSchedule)
        .where(ReviewSchedule.attempt_id == ledger.attempt_id)
        .execution_options(populate_existing=True)
    )
    if (
        attempt is None
        or schedule is None
        or attempt.user_id != owner
        or attempt.client_event_id != event_id
        or schedule.user_id != owner
        or schedule.vocabulary_item_id != attempt.vocabulary_item_id
        or (schedule.scheduler_type, schedule.algorithm_version)
        != (attempt.scheduler_type, attempt.algorithm_version)
    ):
        raise HTTPException(500, "D11_CURRENT_CHAIN_INVALID")
    return attempt, schedule


@dataclass(frozen=True)
class Predecessor:
    attempt: ReviewAttempt
    schedule: ReviewSchedule


@dataclass(frozen=True)
class ResearchAssignment:
    allocation: ParticipantAllocation
    protocol: ResearchProtocol
    research_set: ResearchSet
    condition: ParticipantSetCondition


def load_current_predecessor(
    db: Session, owner: uuid.UUID, item: uuid.UUID
) -> Predecessor | None:
    """Caller holds the learner lock; never reconstruct missing/partial history."""
    pointer = db.scalar(
        select(CurrentReviewSchedule)
        .where(
            CurrentReviewSchedule.user_id == owner,
            CurrentReviewSchedule.vocabulary_item_id == item,
        )
        .execution_options(populate_existing=True)
    )
    history = db.scalar(
        select(
            exists().where(
                ReviewAttempt.user_id == owner, ReviewAttempt.vocabulary_item_id == item
            )
        )
    )
    schedules = db.scalar(
        select(
            exists().where(
                ReviewSchedule.user_id == owner,
                ReviewSchedule.vocabulary_item_id == item,
            )
        )
    )
    if pointer is None:
        if history or schedules:
            raise HTTPException(500, "D11_CURRENT_CHAIN_INVALID")
        return None
    schedule = db.get(ReviewSchedule, pointer.schedule_id, populate_existing=True)
    if (
        schedule is None
        or schedule.user_id != owner
        or schedule.vocabulary_item_id != item
    ):
        raise HTTPException(500, "D11_CURRENT_CHAIN_INVALID")
    attempt = db.get(ReviewAttempt, schedule.attempt_id, populate_existing=True)
    if (
        attempt is None
        or attempt.vocabulary_item_id != item
        or attempt.user_id != owner
    ):
        raise HTTPException(500, "D11_CURRENT_CHAIN_INVALID")
    result = accepted_result(db, owner, attempt.client_event_id)
    if result is None or result[0].id != attempt.id or result[1].id != schedule.id:
        raise HTTPException(500, "D11_CURRENT_CHAIN_INVALID")
    # A pointer cannot mask an earlier partial chain for the same logical item.
    incomplete = db.scalar(
        select(
            exists().where(
                ReviewAttempt.user_id == owner,
                ReviewAttempt.vocabulary_item_id == item,
                ~exists().where(
                    ReviewSchedule.attempt_id == ReviewAttempt.id,
                    ReviewSchedule.user_id == owner,
                    ReviewSchedule.vocabulary_item_id == item,
                )
                | ~exists().where(
                    AcceptedClientEvent.attempt_id == ReviewAttempt.id,
                    AcceptedClientEvent.user_id == owner,
                    AcceptedClientEvent.client_event_id
                    == ReviewAttempt.client_event_id,
                ),
            )
        )
    )
    if incomplete:
        raise HTTPException(500, "D11_CURRENT_CHAIN_INVALID")
    return Predecessor(attempt, schedule)


def resolve_development_authority(
    db: Session, owner: uuid.UUID, injected=None
) -> DevelopmentScheduler:
    """Development authority requires no research enrollment and a safe env."""
    if db.scalar(select(exists().where(ParticipantAllocation.user_id == owner))):
        raise HTTPException(503, "D11_ROUTING_DISABLED")
    environment = get_settings().app_env
    if environment not in ("development", "testing"):
        raise HTTPException(503, "D11_ROUTING_DISABLED")
    if injected is not None:
        if environment != "testing" or not isinstance(injected, DevelopmentScheduler):
            raise HTTPException(503, "D11_ROUTING_DISABLED")
        return injected
    return DevelopmentScheduler()


def resolve_research_assignment(
    db: Session,
    owner: uuid.UUID,
    item: uuid.UUID,
    revision: uuid.UUID,
    release: uuid.UUID,
) -> ResearchAssignment | None:
    """Resolve only one complete, frozen test assignment; formal stays closed."""
    owner_allocations = db.execute(
        select(ParticipantAllocation, ResearchProtocol)
        .join(
            ResearchProtocol,
            (ResearchProtocol.id == ParticipantAllocation.protocol_id)
            & (ResearchProtocol.version == ParticipantAllocation.protocol_version),
        )
        .where(ParticipantAllocation.user_id == owner)
        .execution_options(populate_existing=True)
    ).all()
    if not owner_allocations:
        return None
    if (
        get_settings().app_env != "testing"
        or any(protocol.mode != "test" for _, protocol in owner_allocations)
    ):
        raise HTTPException(503, "D11_ROUTING_DISABLED")

    assignments = []
    for allocation, protocol in owner_allocations:
        sets = db.scalars(
            select(ResearchSet)
            .where(
                ResearchSet.protocol_id == protocol.id,
                ResearchSet.protocol_version == protocol.version,
            )
            .execution_options(populate_existing=True)
        ).all()
        conditions = db.scalars(
            select(ParticipantSetCondition)
            .where(ParticipantSetCondition.allocation_id == allocation.id)
            .execution_options(populate_existing=True)
        ).all()
        if (
            len(sets) != 2
            or {research_set.label for research_set in sets} != {"A", "B"}
            or len(conditions) != 2
            or {condition.research_set_id for condition in conditions}
            != {research_set.id for research_set in sets}
            or allocation.mapping_group not in (1, 2)
            or not _period_order_matches(allocation.period_order, sets)
        ):
            raise HTTPException(500, "D11_ASSIGNMENT_CONTRADICTION")

        for research_set in sets:
            condition = next(
                row for row in conditions if row.research_set_id == research_set.id
            )
            expected_type = _expected_scheduler_type(
                allocation.mapping_group, research_set.label
            )
            if not _condition_matches_configuration(db, condition, expected_type):
                raise HTTPException(500, "D11_ASSIGNMENT_CONTRADICTION")

        member = db.scalar(
            select(ResearchSetMembership)
            .where(
                ResearchSetMembership.protocol_id == protocol.id,
                ResearchSetMembership.protocol_version == protocol.version,
                ResearchSetMembership.vocabulary_item_id == item,
                ResearchSetMembership.content_revision_id == revision,
                ResearchSetMembership.content_release_id == release,
            )
            .execution_options(populate_existing=True)
        )
        if member is not None:
            research_set = next(
                (row for row in sets if row.id == member.research_set_id), None
            )
            condition = next(
                (
                    row
                    for row in conditions
                    if row.research_set_id == member.research_set_id
                ),
                None,
            )
            if research_set is None or condition is None:
                raise HTTPException(500, "D11_ASSIGNMENT_CONTRADICTION")
            assignments.append(
                ResearchAssignment(allocation, protocol, research_set, condition)
            )

    if not assignments:
        raise HTTPException(400, "D11_ITEM_NOT_ASSIGNED")
    if len(assignments) != 1:
        raise HTTPException(500, "D11_ASSIGNMENT_CONTRADICTION")
    assignment = assignments[0]
    if (
        assignment.protocol.frozen_at is None
        or assignment.allocation.frozen_at is None
        or assignment.protocol.approved_at is None
        or assignment.protocol.clock_policy_version != "test-no-future-v1"
    ):
        raise HTTPException(503, "D11_CLOCK_POLICY_UNAVAILABLE")
    return assignment


def _period_order_matches(period_order, sets: list[ResearchSet]) -> bool:
    if not isinstance(period_order, list) or len(period_order) != 2:
        return False
    return set(period_order) == {str(research_set.id) for research_set in sets}


def _expected_scheduler_type(mapping_group: int, set_label: str) -> str:
    enhanced_set = "A" if mapping_group == 1 else "B"
    return "enhanced_srs" if set_label == enhanced_set else "conventional_srs"


def _condition_matches_configuration(
    db: Session, condition: ParticipantSetCondition, expected_scheduler_type: str
) -> bool:
    expected_identity = {
        "conventional_srs": (
            "sm2-binary-v1",
            1,
            "sm2-binary-config-v1",
        ),
        "enhanced_srs": (
            "fluentt-esr-fsrs6-binary-v1",
            1,
            "fsrs6-binary-r90-config-v1",
        ),
    }[expected_scheduler_type]
    config = db.get(
        SchedulerConfiguration, condition.config_version, populate_existing=True
    )
    if config is None:
        raise HTTPException(503, "D11_CONFIG_UNAVAILABLE")
    identity = (
        condition.scheduler_type,
        condition.algorithm_version,
        condition.state_schema_version,
        condition.config_version,
    )
    config_identity = (
        config.scheduler_type,
        config.algorithm_version,
        config.state_schema_version,
        config.config_version,
    )
    expected = (
        expected_scheduler_type,
        *expected_identity,
    )
    return (
        identity == expected
        and config_identity == expected
        and condition.config_sha256 == config.config_sha256
        and sha256(config.canonical_document.encode("utf-8")).hexdigest()
        == config.config_sha256
    )


def resolve_research_engine(condition: ParticipantSetCondition):
    identity = (
        condition.scheduler_type,
        condition.algorithm_version,
        condition.state_schema_version,
        condition.config_version,
    )
    if identity == ("conventional_srs", "sm2-binary-v1", 1, "sm2-binary-config-v1"):
        return BinarySm2Scheduler()
    if identity == (
        "enhanced_srs",
        "fluentt-esr-fsrs6-binary-v1",
        1,
        "fsrs6-binary-r90-config-v1",
    ):
        return EnhancedFsrsScheduler()
    raise HTTPException(503, "D11_ENGINE_UNAVAILABLE")


def backend_now() -> datetime:
    return datetime.now(UTC)


def validate_research_assignment_time(
    assignment: ResearchAssignment,
    incoming: datetime,
    prior_interaction: datetime | None,
) -> datetime:
    normalized = validate_research_chronology(incoming, prior_interaction)
    freeze_instants = (
        assignment.protocol.approved_at,
        assignment.protocol.frozen_at,
        assignment.allocation.frozen_at,
    )
    if any(
        value.tzinfo is None or value.utcoffset() is None
        for value in freeze_instants
    ):
        raise HTTPException(500, "D11_ASSIGNMENT_CONTRADICTION")
    try:
        freeze_utc = tuple(value.astimezone(UTC) for value in freeze_instants)
    except (AttributeError, OverflowError) as error:
        raise HTTPException(500, "D11_ASSIGNMENT_CONTRADICTION") from error
    if any(normalized < instant for instant in freeze_utc):
        raise HTTPException(400, "D11_ASSIGNMENT_NOT_ACTIVE_AT_INTERACTION")
    # Test protocols use a pinned zero-future-skew policy. No formal policy or
    # collection route is defined here; formal assignments are rejected above.
    validate_future_policy(
        normalized,
        backend_now(),
        lambda interaction, now: interaction <= now,
    )
    return normalized


def validate_development_predecessor(predecessor: Predecessor | None) -> None:
    if predecessor and (
        predecessor.schedule.scheduler_type,
        predecessor.schedule.algorithm_version,
    ) != ("development", "dev-0.1"):
        raise HTTPException(500, "D11_STATE_IDENTITY_UNSUPPORTED")
    # dev-0.1 state is intentionally not decoded by research validators.


def validate_research_predecessor(
    db: Session, prior: Predecessor, condition: ParticipantSetCondition
) -> ResearchState:
    """Validate the assigned predecessor identity/state; never calculate here."""
    a, s = prior.attempt, prior.schedule
    if (
        a.research_assignment_id != condition.id
        or a.user_id != condition.user_id
        or s.user_id != a.user_id
        or s.vocabulary_item_id != a.vocabulary_item_id
        or s.attempt_id != a.id
        or (a.scheduler_type, a.algorithm_version)
        != (s.scheduler_type, s.algorithm_version)
    ):
        raise HTTPException(500, "D11_ASSIGNMENT_CONTRADICTION")
    config = db.get(
        SchedulerConfiguration, condition.config_version, populate_existing=True
    )
    if config is None:
        raise HTTPException(503, "D11_CONFIG_UNAVAILABLE")
    if (
        config.config_sha256 != condition.config_sha256
        or sha256(config.canonical_document.encode("utf-8")).hexdigest()
        != config.config_sha256
        or (s.scheduler_type, s.algorithm_version, condition.state_schema_version)
        != (
            config.scheduler_type,
            config.algorithm_version,
            config.state_schema_version,
        )
    ):
        raise HTTPException(500, "D11_ASSIGNMENT_CONTRADICTION")
    try:
        state = decode_research_state(s.scheduler_state)
    except ValidationError as error:
        raise HTTPException(500, "D11_STATE_CORRUPT") from error
    if (
        state.scheduler_type,
        state.algorithm_version,
        state.schema_version,
        state.config_version,
    ) != (
        condition.scheduler_type,
        condition.algorithm_version,
        condition.state_schema_version,
        condition.config_version,
    ):
        raise HTTPException(500, "D11_STATE_IDENTITY_UNSUPPORTED")
    if (
        s.interval_seconds < 86400
        or s.interval_seconds > 3153600000
        or s.interval_seconds % 86400
    ):
        raise HTTPException(500, "D11_STATE_CORRUPT")
    prior_interaction = a.client_interaction_at
    if prior_interaction.tzinfo is None or prior_interaction.utcoffset() is None:
        raise HTTPException(500, "D11_STATE_CORRUPT")
    try:
        prior_interaction_utc = prior_interaction.astimezone(UTC)
    except OverflowError as error:
        raise HTTPException(500, "D11_STATE_CORRUPT") from error
    try:
        expected_due = prior_interaction_utc + timedelta(seconds=s.interval_seconds)
    except OverflowError as error:
        raise HTTPException(500, "D11_STATE_CORRUPT") from error
    if s.due_at != expected_due:
        raise HTTPException(500, "D11_STATE_CORRUPT")
    if isinstance(state, ConventionalState) and (
        state.memory.interval_days * 86400 != s.interval_seconds
        or (state.memory.repetition_count == 0) != (a.correct is False)
    ):
        raise HTTPException(500, "D11_STATE_CORRUPT")
    return state


def validate_research_chronology(
    incoming: datetime, prior: datetime | None
) -> datetime:
    if incoming.tzinfo is None or incoming.utcoffset() is None:
        raise HTTPException(422, "D11_TIMEZONE_REQUIRED")
    try:
        incoming = incoming.astimezone(UTC)
    except OverflowError as error:
        raise HTTPException(422, "D11_TIME_INVALID") from error
    if prior is not None:
        if prior.tzinfo is None or prior.utcoffset() is None:
            raise HTTPException(500, "D11_STATE_CORRUPT")
        try:
            prior = prior.astimezone(UTC)
        except OverflowError as error:
            raise HTTPException(500, "D11_STATE_CORRUPT") from error
        if incoming <= prior:
            raise HTTPException(409, "D11_STALE_INTERACTION")
    return incoming


# No numeric skew tolerance is invented here. Future activation must supply a
# separately approved, frozen policy; this hook is not wired to development.
FutureClockPolicy = Callable[[datetime, datetime], bool]


def validate_future_policy(
    incoming: datetime, server_now: datetime, policy: FutureClockPolicy | None
) -> None:
    if policy is None:
        raise HTTPException(503, "D11_CLOCK_POLICY_UNAVAILABLE")
    if not policy(incoming, server_now):
        raise HTTPException(422, "D11_FUTURE_INTERACTION")
