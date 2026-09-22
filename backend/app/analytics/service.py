from datetime import UTC, datetime, timedelta

from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.analytics.schemas import LearnerProgressResponse, RecentActivityItem
from app.auth.models import User
from app.content.models import VocabularyItem
from app.reviews.models import ReviewAttempt


def get_learner_progress(db: Session, user: User) -> LearnerProgressResponse:
    # 1. Total review attempts
    total_reviews = (
        db.query(func.count(ReviewAttempt.id))
        .filter(ReviewAttempt.user_id == user.id)
        .scalar()
        or 0
    )

    # 2. Distinct vocabulary items reviewed
    unique_vocab = (
        db.query(func.count(distinct(ReviewAttempt.vocabulary_item_id)))
        .filter(ReviewAttempt.user_id == user.id)
        .scalar()
        or 0
    )

    # 3. Performance breakdown
    breakdown_rows = (
        db.query(ReviewAttempt.submitted_answer, func.count(ReviewAttempt.id))
        .filter(ReviewAttempt.user_id == user.id)
        .group_by(ReviewAttempt.submitted_answer)
        .all()
    )
    breakdown: dict[str, int] = {"again": 0, "hard": 0, "good": 0, "easy": 0}
    for ans, count in breakdown_rows:
        if ans in breakdown:
            breakdown[ans] = count

    # 4. Streak calculation
    streak_days = 0
    if total_reviews > 0:
        dates_rows = (
            db.query(func.date(ReviewAttempt.server_acceptance_at))
            .filter(ReviewAttempt.user_id == user.id)
            .distinct()
            .order_by(func.date(ReviewAttempt.server_acceptance_at).desc())
            .all()
        )
        attempt_dates = set()
        for r in dates_rows:
            d_val = r[0]
            if isinstance(d_val, str):
                d_val = datetime.strptime(d_val, "%Y-%m-%d").replace(tzinfo=UTC).date()
            elif isinstance(d_val, datetime):
                d_val = d_val.date()
            if d_val:
                attempt_dates.add(d_val)

        today = datetime.now(UTC).date()
        yesterday = today - timedelta(days=1)

        current_check = today if today in attempt_dates else (yesterday if yesterday in attempt_dates else None)
        if current_check:
            while current_check in attempt_dates:
                streak_days += 1
                current_check = current_check - timedelta(days=1)

    # 5. Recent activity (last 10 attempts)
    recent_attempts = (
        db.query(ReviewAttempt, VocabularyItem.term)
        .join(VocabularyItem, ReviewAttempt.vocabulary_item_id == VocabularyItem.id)
        .filter(ReviewAttempt.user_id == user.id)
        .order_by(ReviewAttempt.server_acceptance_at.desc())
        .limit(10)
        .all()
    )

    recent_activity = [
        RecentActivityItem(
            attempt_id=att.id,
            vocabulary_item_id=att.vocabulary_item_id,
            term=term,
            correct=att.correct,
            performance_rating=att.submitted_answer or ("good" if att.correct else "again"),
            created_at=att.server_acceptance_at,
        )
        for att, term in recent_attempts
    ]

    return LearnerProgressResponse(
        total_reviews=total_reviews,
        unique_vocabulary_reviewed=unique_vocab,
        streak_days=streak_days,
        performance_breakdown=breakdown,
        recent_activity=recent_activity,
    )
