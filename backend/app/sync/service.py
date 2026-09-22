from sqlalchemy.orm import Session

from app.auth.models import User
from app.reviews.schemas import ReviewAttemptCreate, ReviewAttemptResponse
from app.reviews.service import record_review_attempt


def sync_review_events(
    db: Session,
    user: User,
    events: list[ReviewAttemptCreate],
) -> list[ReviewAttemptResponse]:
    """Idempotently synchronize offline review events for the authenticated learner.

    Uses the shared record_review_attempt transaction to guarantee:
    - Atomicity per event
    - Idempotency via AcceptedClientEvent scoped to (user_id, client_event_id)
    - Replaying the same event returns the authoritative stored result without duplication
    - Cross-user isolation: User B's events never access or mutate User A's data
    """
    responses: list[ReviewAttemptResponse] = []
    for event_in in events:
        attempt, schedule = record_review_attempt(
            db=db,
            user=user,
            attempt_in=event_in,
        )
        responses.append(
            ReviewAttemptResponse(
                id=attempt.id,
                client_event_id=attempt.client_event_id,
                session_id=attempt.session_id,
                vocabulary_item_id=attempt.vocabulary_item_id,
                correct=attempt.correct,
                response_time_ms=attempt.response_time_ms,
                scheduler_type=attempt.scheduler_type,
                algorithm_version=attempt.algorithm_version,
                next_interval_seconds=schedule.interval_seconds,
                next_due_at=schedule.due_at,
                server_acceptance_at=attempt.server_acceptance_at,
                scheduler_state=schedule.scheduler_state,
            )
        )
    return responses
