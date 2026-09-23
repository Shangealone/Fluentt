from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.analytics.schemas import LearnerProgressResponse
from app.auth.models import User
from app.reviews.models import ReviewAttempt


def get_learner_progress(db: Session, user: User) -> LearnerProgressResponse:
    # 1. Total review attempts completed
    review_attempts_completed = (
        db.query(func.count(ReviewAttempt.id))
        .filter(ReviewAttempt.user_id == user.id)
        .scalar()
        or 0
    )

    # 2. Distinct vocabulary items studied
    vocabulary_items_studied = (
        db.query(func.count(distinct(ReviewAttempt.vocabulary_item_id)))
        .filter(ReviewAttempt.user_id == user.id)
        .scalar()
        or 0
    )

    # 3. Correct attempts
    correct_attempts = (
        db.query(func.count(ReviewAttempt.id))
        .filter(
            ReviewAttempt.user_id == user.id,
            ReviewAttempt.correct.is_(True),
        )
        .scalar()
        or 0
    )

    # 4. Accuracy rate: 0.0 when zero attempts
    accuracy_rate = 0.0
    if review_attempts_completed > 0:
        accuracy_rate = round(correct_attempts / review_attempts_completed, 4)

    return LearnerProgressResponse(
        vocabulary_items_studied=vocabulary_items_studied,
        review_attempts_completed=review_attempts_completed,
        correct_attempts=correct_attempts,
        accuracy_rate=accuracy_rate,
    )
