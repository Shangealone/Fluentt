import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import exists, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import User
from app.content.provenance import resolve_review_content
from app.research_logging.service import ItemAttemptPayload, record_research_event
from app.reviews import acceptance
from app.reviews.models import (
    CurrentReviewSchedule,
    ReviewAttempt,
    ReviewSchedule,
    ReviewSession,
)
from app.reviews.schemas import ReviewAttemptCreate
from app.scheduling.base import Scheduler
from app.scheduling.fsrs6 import FsrsReconstructionContext
from app.scheduling.research_contracts import (
    ResearchSchedulerInput,
    validate_research_result,
)
from app.scheduling.types import ReviewContext
from app.sync.models import AcceptedClientEvent


def get_or_create_review_session(
    db: Session,
    user_id: uuid.UUID,
    client_session_id: uuid.UUID,
) -> ReviewSession:
    """Get an existing review session by (user_id, client_session_id) or create a new one."""
    session = (
        db.query(ReviewSession)
        .filter(
            ReviewSession.user_id == user_id,
            ReviewSession.client_session_id == client_session_id,
        )
        .first()
    )
    if session:
        return session

    try:
        session = ReviewSession(
            user_id=user_id,
            client_session_id=client_session_id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(ReviewSession)
            .filter(
                ReviewSession.user_id == user_id,
                ReviewSession.client_session_id == client_session_id,
            )
            .first()
        )
        if existing:
            return existing
        raise


def record_review_attempt(
    db: Session,
    user: User,
    attempt_in: ReviewAttemptCreate,
    scheduler: Scheduler | None = None,
) -> tuple[ReviewAttempt, ReviewSchedule]:
    """Shared online/sync acceptance: preflight, lock, replay, one atomic chain."""
    owner = user.id
    replay = acceptance.accepted_result(db, owner, attempt_in.client_event_id)
    if replay is not None:
        return replay
    if db.new or db.dirty or db.deleted:
        raise RuntimeError(
            "Review acceptance requires a session without unrelated pending writes"
        )
    if not attempt_in.content_revision_id or not attempt_in.content_release_id:
        raise HTTPException(
            400,
            "An immutable content revision and release are required for a new review",
        )
    vocab = resolve_review_content(
        db,
        attempt_in.vocabulary_item_id,
        attempt_in.content_revision_id,
        attempt_in.content_release_id,
    )
    # Frozen provenance may cross preflight as scalars; no ORM snapshots are state authority.
    item_id, revision_id, difficulty = (
        vocab.vocabulary_item_id,
        vocab.id,
        vocab.difficulty,
    )
    session = None
    if attempt_in.session_id:
        session = (
            db.query(ReviewSession)
            .filter(
                ReviewSession.id == attempt_in.session_id,
                ReviewSession.user_id == owner,
            )
            .first()
        )
    if session is None and attempt_in.client_session_id:
        session = get_or_create_review_session(db, owner, attempt_in.client_session_id)
    if session is None:
        raise HTTPException(400, "Review session not found for user")
    if session.client_session_id != attempt_in.client_session_id:
        raise HTTPException(
            400, "Original and resolved review session identities conflict"
        )
    session_id = session.id
    # get_or_create may commit then refresh (autobegin). End ALL preflight reads.
    # Its session is the only permitted durable preflight write.
    db.rollback()
    try:
        with db.begin():
            db.connection(execution_options={"isolation_level": "READ COMMITTED"})
            acceptance.acquire_learner_lock(db, owner)
            replay = acceptance.accepted_result(db, owner, attempt_in.client_event_id)
            if replay is not None:
                return replay
            assignment = acceptance.resolve_research_assignment(
                db,
                owner,
                item_id,
                revision_id,
                attempt_in.content_release_id,
            )
            predecessor = acceptance.load_current_predecessor(db, owner, item_id)
            # Revalidate owner/session identity with a fresh SQL result under the lock.
            valid_session = (
                db.query(ReviewSession.id)
                .filter(
                    ReviewSession.id == session_id,
                    ReviewSession.user_id == owner,
                    ReviewSession.client_session_id == attempt_in.client_session_id,
                )
                .first()
            )
            if valid_session is None:
                raise HTTPException(500, "D11_CURRENT_CHAIN_INVALID")
            if assignment is not None:
                if db.scalar(
                    select(
                        exists().where(
                            ReviewAttempt.user_id == owner,
                            ReviewAttempt.session_id == session_id,
                            ReviewAttempt.vocabulary_item_id == item_id,
                        )
                    )
                ):
                    raise HTTPException(409, "D11_SESSION_ITEM_ALREADY_ANSWERED")
                prior_state = (
                    acceptance.validate_research_predecessor(
                        db, predecessor, assignment.condition
                    )
                    if predecessor is not None
                    else None
                )
                prior_interaction = (
                    predecessor.attempt.client_interaction_at
                    if predecessor is not None
                    else None
                )
                interaction_at = acceptance.validate_research_assignment_time(
                    assignment, attempt_in.client_interaction_at, prior_interaction
                )
                inputs = ResearchSchedulerInput(
                    correct=attempt_in.correct,
                    interaction_at_utc=interaction_at,
                    prior_state=prior_state,
                    prior_interaction_at_utc=(
                        acceptance.validate_research_chronology(
                            prior_interaction, None
                        )
                        if prior_interaction is not None
                        else None
                    ),
                )
                engine = acceptance.resolve_research_engine(assignment.condition)
                if assignment.condition.scheduler_type == "enhanced_srs":
                    reconstruction = FsrsReconstructionContext(
                        user_id=owner,
                        vocabulary_item_id=item_id,
                        prior_due_at_utc=(
                            predecessor.schedule.due_at
                            if predecessor is not None
                            else None
                        ),
                    )
                    calculated = engine.schedule(inputs, reconstruction)
                else:
                    calculated = engine.schedule(inputs)
                result = validate_research_result(calculated, inputs)
                expected = (
                    assignment.condition.scheduler_type,
                    assignment.condition.algorithm_version,
                    assignment.condition.state_schema_version,
                    assignment.condition.config_version,
                )
                actual = (
                    result.scheduler_type,
                    result.algorithm_version,
                    result.state_schema_version,
                    result.config_version,
                )
                if actual != expected:
                    raise HTTPException(500, "D11_OUTPUT_INVALID")
                accepted, scheduled = _persist_research_acceptance(
                    db,
                    owner,
                    session_id,
                    item_id,
                    revision_id,
                    assignment.condition.id,
                    attempt_in,
                    interaction_at,
                    result,
                    datetime.now(UTC),
                )
                db.flush()
                db.refresh(accepted)
                db.refresh(scheduled)
                return accepted, scheduled

            engine = acceptance.resolve_development_authority(db, owner, scheduler)
            acceptance.validate_development_predecessor(predecessor)
            context = ReviewContext(
                correct=attempt_in.correct,
                response_time_ms=attempt_in.response_time_ms,
                item_difficulty={"medium": 2.0, "hard": 3.0}.get(difficulty, 1.0),
                interaction_at=attempt_in.client_interaction_at,
            )
            result = engine.schedule(context)
            if (result.scheduler_type, result.algorithm_version) != (
                "development",
                "dev-0.1",
            ):
                raise HTTPException(500, "D11_OUTPUT_INVALID")
            # No D11 chronology or research-state decoding is applied to dev-0.1.
            accepted, scheduled = _persist_development_acceptance(
                db,
                owner,
                session_id,
                item_id,
                revision_id,
                attempt_in,
                result,
                datetime.now(UTC),
            )
            db.flush()
            # Preserve the historical database timestamp representation on both
            # first acceptance and replay, while retaining the lock until commit.
            db.refresh(accepted)
            db.refresh(scheduled)
            return accepted, scheduled
    except DBAPIError as error:
        db.rollback()
        code = getattr(error.orig, "sqlstate", None)
        if (
            code == "23505"
            and getattr(getattr(error.orig, "diag", None), "constraint_name", None)
            == "uq_user_client_event_id"
        ):
            winner = acceptance.accepted_result(db, owner, attempt_in.client_event_id)
            if winner is not None:
                return winner
        if code in {"40001", "40P01", "55P03"}:
            raise HTTPException(503, "D11_TRANSACTION_RETRY") from error
        raise


def _persist_development_acceptance(
    db, owner, session_id, item_id, revision_id, attempt_in, sched_result, now_utc
):
    """Stage M-R only. The caller owns the learner lock and transaction/commit."""
    attempt = ReviewAttempt(
        user_id=owner,
        vocabulary_item_id=item_id,
        content_revision_id=revision_id,
        content_release_id=attempt_in.content_release_id,
        session_id=session_id,
        client_event_id=attempt_in.client_event_id,
        correct=attempt_in.correct,
        response_time_ms=attempt_in.response_time_ms,
        timing_evidence=(
            attempt_in.timing_evidence.model_dump()
            if attempt_in.timing_evidence is not None
            else None
        ),
        scheduler_type=sched_result.scheduler_type,
        algorithm_version=sched_result.algorithm_version,
        client_interaction_at=attempt_in.client_interaction_at,
        server_acceptance_at=now_utc,
        device_platform=attempt_in.device_platform,
        application_version=attempt_in.application_version,
        submitted_answer=attempt_in.submitted_answer,
    )
    db.add(attempt)
    db.flush()

    schedule = ReviewSchedule(
        user_id=owner,
        vocabulary_item_id=item_id,
        attempt_id=attempt.id,
        scheduler_type=sched_result.scheduler_type,
        algorithm_version=sched_result.algorithm_version,
        interval_seconds=sched_result.next_interval_seconds,
        due_at=sched_result.next_due_at,
        scheduler_state=sched_result.state,
    )
    db.add(schedule)
    db.flush()

    # 5. Accepted client event record for duplicate-safe sync
    accepted_event = AcceptedClientEvent(
        user_id=owner,
        client_event_id=attempt_in.client_event_id,
        attempt_id=attempt.id,
        accepted_at=now_utc,
        response_payload={
            "id": str(attempt.id),
            "client_event_id": str(attempt.client_event_id),
            "session_id": str(attempt.session_id),
            "vocabulary_item_id": str(attempt.vocabulary_item_id),
            "content_revision_id": str(attempt.content_revision_id),
            "content_release_id": str(attempt.content_release_id),
            "correct": attempt.correct,
            "response_time_ms": attempt.response_time_ms,
            "timing_evidence": attempt.timing_evidence,
            "scheduler_type": attempt.scheduler_type,
            "algorithm_version": attempt.algorithm_version,
            "next_interval_seconds": schedule.interval_seconds,
            "next_due_at": schedule.due_at.isoformat(),
            "server_acceptance_at": attempt.server_acceptance_at.isoformat(),
        },
    )
    db.add(accepted_event)
    # Flush the ledger uniqueness check before any current-state transition.
    # A duplicate event rolls back without advancing the pointer.
    db.flush()
    transition = insert(CurrentReviewSchedule).values(
        user_id=owner,
        vocabulary_item_id=attempt.vocabulary_item_id,
        schedule_id=schedule.id,
    )
    db.execute(
        transition.on_conflict_do_update(
            index_elements=["user_id", "vocabulary_item_id"],
            set_={"schedule_id": schedule.id},
        )
    )

    # 6. Append research events
    record_research_event(
        db=db,
        user_id=owner,
        event_type="REVIEW_ANSWERED",
        payload=ItemAttemptPayload(),
        review_attempt_id=attempt.id,
    )

    record_research_event(
        db=db,
        user_id=owner,
        event_type="REVIEW_SCHEDULED",
        payload=ItemAttemptPayload(),
        review_attempt_id=attempt.id,
    )

    return attempt, schedule


def _persist_research_acceptance(
    db,
    owner,
    session_id,
    item_id,
    revision_id,
    assignment_id,
    attempt_in,
    interaction_at,
    result,
    now_utc,
):
    """Stage one immutable research chain under the caller's learner lock."""
    attempt = ReviewAttempt(
        user_id=owner,
        vocabulary_item_id=item_id,
        content_revision_id=revision_id,
        content_release_id=attempt_in.content_release_id,
        session_id=session_id,
        client_event_id=attempt_in.client_event_id,
        correct=attempt_in.correct,
        response_time_ms=attempt_in.response_time_ms,
        timing_evidence=(
            attempt_in.timing_evidence.model_dump()
            if attempt_in.timing_evidence is not None
            else None
        ),
        scheduler_type=result.scheduler_type,
        algorithm_version=result.algorithm_version,
        research_assignment_id=assignment_id,
        client_interaction_at=interaction_at,
        server_acceptance_at=now_utc,
        device_platform=attempt_in.device_platform,
        application_version=attempt_in.application_version,
        submitted_answer=attempt_in.submitted_answer,
    )
    db.add(attempt)
    db.flush()

    schedule = ReviewSchedule(
        user_id=owner,
        vocabulary_item_id=item_id,
        attempt_id=attempt.id,
        scheduler_type=result.scheduler_type,
        algorithm_version=result.algorithm_version,
        interval_seconds=result.interval_seconds,
        due_at=result.due_at,
        scheduler_state=result.scheduler_state.model_dump(mode="json"),
    )
    db.add(schedule)
    db.flush()

    accepted_event = AcceptedClientEvent(
        user_id=owner,
        client_event_id=attempt_in.client_event_id,
        attempt_id=attempt.id,
        accepted_at=now_utc,
        response_payload={
            "id": str(attempt.id),
            "client_event_id": str(attempt.client_event_id),
            "session_id": str(attempt.session_id),
            "vocabulary_item_id": str(attempt.vocabulary_item_id),
            "content_revision_id": str(attempt.content_revision_id),
            "content_release_id": str(attempt.content_release_id),
            "correct": attempt.correct,
            "response_time_ms": attempt.response_time_ms,
            "timing_evidence": attempt.timing_evidence,
            "scheduler_type": attempt.scheduler_type,
            "algorithm_version": attempt.algorithm_version,
            "next_interval_seconds": schedule.interval_seconds,
            "next_due_at": schedule.due_at.isoformat(),
            "server_acceptance_at": now_utc.isoformat(),
        },
    )
    db.add(accepted_event)
    db.flush()

    _advance_current_pointer(db, owner, item_id, schedule.id)
    record_research_event(
        db=db,
        user_id=owner,
        event_type="REVIEW_ANSWERED",
        payload=ItemAttemptPayload(),
        review_attempt_id=attempt.id,
    )
    record_research_event(
        db=db,
        user_id=owner,
        event_type="REVIEW_SCHEDULED",
        payload=ItemAttemptPayload(),
        review_attempt_id=attempt.id,
    )
    db.flush()
    return attempt, schedule


def _advance_current_pointer(db, owner, item_id, schedule_id):
    transition = insert(CurrentReviewSchedule).values(
        user_id=owner,
        vocabulary_item_id=item_id,
        schedule_id=schedule_id,
    )
    db.execute(
        transition.on_conflict_do_update(
            index_elements=["user_id", "vocabulary_item_id"],
            set_={"schedule_id": schedule_id},
        )
    )
