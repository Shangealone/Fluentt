"""Server-authoritative eligibility against an immutable lesson snapshot."""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.content.service import get_active_lesson_by_id
from app.reviews.models import CurrentReviewSchedule, ReviewAttempt, ReviewSchedule
from app.reviews.schemas import (
    CurrentScheduleResponse,
    EligibleReviewItem,
    ReviewEligibilityResponse,
)


def backend_now() -> datetime:
    return datetime.now(UTC)


def get_review_eligibility(
    db: Session,
    user_id: uuid.UUID,
    lesson_id: uuid.UUID,
    content_release_id: uuid.UUID | None,
) -> ReviewEligibilityResponse:
    evaluated_at = backend_now()
    lesson = get_active_lesson_by_id(db, lesson_id, content_release_id)
    if not lesson:
        raise HTTPException(404, "Lesson/release not found or inactive")
    if not lesson.get("content_release_id"):
        raise HTTPException(409, "Published content is required for review eligibility")
    words = lesson["vocabulary_items"]
    ids = [uuid.UUID(str(word["id"])) for word in words]
    schedules = {
        schedule.vocabulary_item_id: schedule
        for schedule in db.scalars(
            select(ReviewSchedule)
            .join(
                CurrentReviewSchedule,
                CurrentReviewSchedule.schedule_id == ReviewSchedule.id,
            )
            .where(
                CurrentReviewSchedule.user_id == user_id,
                CurrentReviewSchedule.vocabulary_item_id.in_(ids),
            )
        )
    }
    reviewed_ids = set(
        db.scalars(
            select(ReviewAttempt.vocabulary_item_id)
            .distinct()
            .where(
                ReviewAttempt.user_id == user_id,
                ReviewAttempt.vocabulary_item_id.in_(ids),
            )
        )
    )
    if reviewed_ids - schedules.keys():
        raise HTTPException(503, "Current scheduling state is unavailable")
    items = []
    for word in words:
        schedule = schedules.get(uuid.UUID(str(word["id"])))
        if schedule and schedule.due_at > evaluated_at:
            continue
        current = (
            None
            if schedule is None
            else CurrentScheduleResponse(
                id=schedule.id,
                scheduler_type=schedule.scheduler_type,
                algorithm_version=schedule.algorithm_version,
                next_interval_seconds=schedule.interval_seconds,
                next_due_at=schedule.due_at,
                scheduler_state=schedule.scheduler_state,
            )
        )
        items.append(
            EligibleReviewItem(
                vocabulary_item=word,
                eligibility="new" if schedule is None else "due",
                current_schedule=current,
            )
        )
    return ReviewEligibilityResponse(
        lesson_id=lesson_id,
        content_release_id=lesson["content_release_id"],
        evaluated_at=evaluated_at,
        items=items,
    )
