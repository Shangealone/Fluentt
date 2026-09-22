import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import User
from app.content.models import VocabularyItem
from app.research_logging.service import record_research_event
from app.reviews.models import ReviewAttempt, ReviewSchedule, ReviewSession
from app.reviews.schemas import ReviewAttemptCreate
from app.scheduling.base import Scheduler
from app.scheduling.development import DevelopmentScheduler
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
    """Validate and transactionally accept a review attempt.

    Shared between normal online submission and offline-sync retry path to ensure
    identical idempotency semantics:
    - If client_event_id was already accepted for this user, returns existing attempt/schedule.
    - Preserves database-level uniqueness on (user_id, client_event_id).
    - Prevents duplicate ReviewAttempt and ResearchEvent records on lost acknowledgement.
    """
    # 0. Check if already accepted for this user (idempotency check)
    existing_event = (
        db.query(AcceptedClientEvent)
        .filter(
            AcceptedClientEvent.user_id == user.id,
            AcceptedClientEvent.client_event_id == attempt_in.client_event_id,
        )
        .first()
    )
    if existing_event:
        existing_attempt = (
            db.query(ReviewAttempt)
            .filter(ReviewAttempt.id == existing_event.attempt_id)
            .first()
        )
        existing_schedule = (
            db.query(ReviewSchedule)
            .filter(ReviewSchedule.attempt_id == existing_event.attempt_id)
            .first()
        )
        if existing_attempt and existing_schedule:
            return existing_attempt, existing_schedule

    # 1. Validate vocabulary item
    vocab_item = (
        db.query(VocabularyItem)
        .filter(
            VocabularyItem.id == attempt_in.vocabulary_item_id,
            VocabularyItem.is_active.is_(True),
        )
        .first()
    )
    if not vocab_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vocabulary item not found or inactive",
        )

    # 2. Resolve review session
    session = None
    if attempt_in.session_id:
        session = (
            db.query(ReviewSession)
            .filter(
                ReviewSession.id == attempt_in.session_id,
                ReviewSession.user_id == user.id,
            )
            .first()
        )
    if not session and attempt_in.client_session_id:
        session = get_or_create_review_session(
            db, user.id, attempt_in.client_session_id
        )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Review session not found for user",
        )

    # 3. Schedule next review
    if scheduler is None:
        scheduler = DevelopmentScheduler()

    difficulty_weight = 1.0
    if vocab_item.difficulty == "medium":
        difficulty_weight = 2.0
    elif vocab_item.difficulty == "hard":
        difficulty_weight = 3.0

    context = ReviewContext(
        correct=attempt_in.correct,
        response_time_ms=attempt_in.response_time_ms,
        item_difficulty=difficulty_weight,
        interaction_at=attempt_in.client_interaction_at,
    )
    sched_result = scheduler.schedule(context)

    # 4. Transactionally persist ReviewAttempt, ReviewSchedule, AcceptedClientEvent, ResearchEvents
    now_utc = datetime.now(UTC)
    try:
        attempt = ReviewAttempt(
            user_id=user.id,
            vocabulary_item_id=vocab_item.id,
            session_id=session.id,
            client_event_id=attempt_in.client_event_id,
            correct=attempt_in.correct,
            response_time_ms=attempt_in.response_time_ms,
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
            user_id=user.id,
            vocabulary_item_id=vocab_item.id,
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
            user_id=user.id,
            client_event_id=attempt_in.client_event_id,
            attempt_id=attempt.id,
            accepted_at=now_utc,
            response_payload={
                "id": str(attempt.id),
                "client_event_id": str(attempt.client_event_id),
                "session_id": str(attempt.session_id),
                "vocabulary_item_id": str(attempt.vocabulary_item_id),
                "correct": attempt.correct,
                "response_time_ms": attempt.response_time_ms,
                "scheduler_type": attempt.scheduler_type,
                "algorithm_version": attempt.algorithm_version,
                "next_interval_seconds": schedule.interval_seconds,
                "next_due_at": schedule.due_at.isoformat(),
                "server_acceptance_at": attempt.server_acceptance_at.isoformat(),
            },
        )
        db.add(accepted_event)

        # 6. Append research events
        record_research_event(
            db=db,
            user_id=user.id,
            event_type="REVIEW_ANSWERED",
            payload={
                "client_event_id": str(attempt_in.client_event_id),
                "participant_code": user.participant_code,
                "vocabulary_item_id": str(vocab_item.id),
                "correct": attempt_in.correct,
                "response_time_ms": attempt_in.response_time_ms,
                "device_platform": attempt_in.device_platform,
                "application_version": attempt_in.application_version,
                "client_interaction_at": attempt_in.client_interaction_at.isoformat(),
                "server_acceptance_at": now_utc.isoformat(),
            },
        )

        record_research_event(
            db=db,
            user_id=user.id,
            event_type="REVIEW_COMPLETED",
            payload={
                "attempt_id": str(attempt.id),
                "client_event_id": str(attempt_in.client_event_id),
                "scheduler_type": sched_result.scheduler_type,
                "algorithm_version": sched_result.algorithm_version,
                "interval_seconds": sched_result.next_interval_seconds,
                "due_at": sched_result.next_due_at.isoformat(),
            },
        )

        db.commit()
        db.refresh(attempt)
        db.refresh(schedule)
        return attempt, schedule

    except IntegrityError:
        db.rollback()
        # Concurrency race: another request with the same client_event_id won
        winner_event = (
            db.query(AcceptedClientEvent)
            .filter(
                AcceptedClientEvent.user_id == user.id,
                AcceptedClientEvent.client_event_id == attempt_in.client_event_id,
            )
            .first()
        )
        if winner_event:
            winner_attempt = (
                db.query(ReviewAttempt)
                .filter(ReviewAttempt.id == winner_event.attempt_id)
                .first()
            )
            winner_schedule = (
                db.query(ReviewSchedule)
                .filter(ReviewSchedule.attempt_id == winner_event.attempt_id)
                .first()
            )
            if winner_attempt and winner_schedule:
                return winner_attempt, winner_schedule
        raise
