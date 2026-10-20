"""FIFAKT Feature Extraction Pipeline.

Extracts deterministic, chronological, non-leaking knowledge-tracing feature vectors
from learner review states and historical review event sequences.

Key Engineering Guarantees:
1. Strict Temporal Leakage Prevention: Any event with reviewed_at >= as_of is excluded.
2. Deterministic Ordering: Events are ordered by (reviewed_at, state_revision).
3. Missing-Data Resilience: Handles new cards (0 reviews), zero durations, and absent metrics.
4. Stable References: Binds learner context, vocabulary item ID, and content version.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Sequence
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.modules.spaced_repetition.schemas import ReviewRating

SECONDS_PER_DAY = 86400.0


class FIFAKTFeatureVector(BaseModel):
    """Immutable, typed feature vector passed to FIFAKT knowledge tracing inference."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    vocabulary_item_id: UUID
    content_version: int = Field(ge=1, default=1)
    total_reviews: int = Field(ge=0, description="Cumulative number of prior reviews before this event.")
    total_lapses: int = Field(ge=0, description="Cumulative number of prior lapses ('again' ratings).")
    consecutive_successes: int = Field(
        ge=0, description="Consecutive successful recalls directly preceding this review."
    )
    prior_success_rate: float = Field(
        ge=0.0, le=1.0, description="Proportion of prior reviews that were successful (ratings >= 'hard')."
    )
    elapsed_seconds: float = Field(ge=0.0, description="Seconds elapsed since the immediately preceding review.")
    avg_response_duration_ms: float = Field(
        ge=0.0, description="Mean response duration in milliseconds across prior reviews."
    )
    current_response_duration_ms: int = Field(
        ge=0, le=300000, description="Response latency in ms for the current review interaction."
    )
    last_rating: ReviewRating | None = Field(
        default=None, description="Recall rating of the immediately preceding review."
    )
    current_rating: ReviewRating = Field(description="Recall rating submitted for the current review.")
    card_difficulty: float = Field(
        ge=1.0, le=10.0, default=5.0, description="Current difficulty parameter of the item."
    )
    card_stability: float = Field(
        ge=0.001, default=1.0, description="Current memory stability of the item in days."
    )


@dataclass(frozen=True)
class ReviewEventRecord:
    """Standardized representation of a review event for feature extraction."""

    reviewed_at: datetime
    recall_rating: str
    response_duration_ms: int
    state_revision: int = 1


def extract_features_from_state(
    current_state: dict[str, Any] | None,
    current_rating: str,
    reviewed_at: datetime,
    current_duration_ms: int,
    vocabulary_item_id: UUID,
    content_version: int = 1,
    base_difficulty: float = 5.0,
    base_stability: float = 1.0,
) -> FIFAKTFeatureVector:
    """Online, O(1) feature extraction directly from the active card review state.
    
    Used during synchronous schedule computation.
    """
    state = current_state or {}
    total_reviews = max(0, int(state.get("total_reviews", 0)))
    total_lapses = max(0, int(state.get("lapses", 0)))
    consecutive_successes = max(0, int(state.get("consecutive_successes", 0)))
    total_duration_ms = max(0, int(state.get("total_duration_ms", 0)))
    last_rating_raw = state.get("last_rating")
    last_rating = str(last_rating_raw) if last_rating_raw in ("again", "hard", "good", "easy") else None

    # Calculate prior success rate
    if total_reviews > 0:
        prior_success_rate = max(0.0, min(1.0, (total_reviews - total_lapses) / float(total_reviews)))
        avg_duration_ms = total_duration_ms / float(total_reviews)
    else:
        prior_success_rate = 0.0
        avg_duration_ms = float(max(0, current_duration_ms))

    # Calculate elapsed seconds since last review
    last_rev_str = state.get("last_reviewed_at")
    elapsed_seconds = 0.0
    if last_rev_str:
        try:
            last_dt = datetime.fromisoformat(last_rev_str)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            cur_dt = reviewed_at if reviewed_at.tzinfo is not None else reviewed_at.replace(tzinfo=timezone.utc)
            elapsed_seconds = max(0.0, (cur_dt - last_dt).total_seconds())
        except (ValueError, TypeError):
            elapsed_seconds = 0.0

    raw_difficulty = state.get("difficulty")
    difficulty = (
        max(1.0, min(10.0, float(raw_difficulty)))
        if raw_difficulty is not None
        else max(1.0, min(10.0, base_difficulty))
    )

    raw_stability = state.get("stability")
    stability = (
        max(0.001, float(raw_stability))
        if raw_stability is not None
        else max(0.001, base_stability)
    )

    return FIFAKTFeatureVector(
        vocabulary_item_id=vocabulary_item_id,
        content_version=max(1, content_version),
        total_reviews=total_reviews,
        total_lapses=total_lapses,
        consecutive_successes=consecutive_successes,
        prior_success_rate=prior_success_rate,
        elapsed_seconds=elapsed_seconds,
        avg_response_duration_ms=avg_duration_ms,
        current_response_duration_ms=max(0, min(300000, current_duration_ms)),
        last_rating=last_rating,  # type: ignore[arg-type]
        current_rating=current_rating,  # type: ignore[arg-type]
        card_difficulty=difficulty,
        card_stability=stability,
    )


def extract_features_from_event_history(
    events: Sequence[Any],
    as_of: datetime,
    vocabulary_item_id: UUID,
    current_rating: str,
    current_duration_ms: int,
    content_version: int = 1,
    base_difficulty: float = 5.0,
    base_stability: float = 1.0,
) -> FIFAKTFeatureVector:
    """Historical stream feature extractor with strict future-data leakage prevention.
    
    Any event in `events` where `reviewed_at >= as_of` is strictly ignored.
    Events are sorted chronologically by (reviewed_at, state_revision).
    """
    target_dt = as_of if as_of.tzinfo is not None else as_of.replace(tzinfo=timezone.utc)

    # 1. Filter out future and simultaneous events (leakage protection)
    valid_prior_events: list[ReviewEventRecord] = []
    for ev in events:
        ev_dt = getattr(ev, "reviewed_at", None)
        if ev_dt is None and isinstance(ev, dict):
            ev_dt = ev.get("reviewed_at")
            if isinstance(ev_dt, str):
                ev_dt = datetime.fromisoformat(ev_dt)

        if not isinstance(ev_dt, datetime):
            continue

        if ev_dt.tzinfo is None:
            ev_dt = ev_dt.replace(tzinfo=timezone.utc)

        # STRICT LEAKAGE GUARD: Must precede target_dt
        if ev_dt < target_dt:
            rating = getattr(ev, "recall_rating", None) or (ev.get("recall_rating") if isinstance(ev, dict) else None)
            dur = getattr(ev, "response_duration_ms", 0) or (ev.get("response_duration_ms", 0) if isinstance(ev, dict) else 0)
            rev = getattr(ev, "state_revision", 1) or (ev.get("state_revision", 1) if isinstance(ev, dict) else 1)
            valid_prior_events.append(
                ReviewEventRecord(
                    reviewed_at=ev_dt,
                    recall_rating=str(rating),
                    response_duration_ms=max(0, int(dur)),
                    state_revision=max(1, int(rev)),
                )
            )

    # 2. Deterministic sort by timestamp and state revision
    valid_prior_events.sort(key=lambda x: (x.reviewed_at, x.state_revision))

    # 3. Calculate sequence aggregates
    total_reviews = len(valid_prior_events)
    total_lapses = sum(1 for e in valid_prior_events if e.recall_rating == "again")

    # Consecutive successes counting backward from the most recent prior event
    consecutive_successes = 0
    for e in reversed(valid_prior_events):
        if e.recall_rating in ("hard", "good", "easy"):
            consecutive_successes += 1
        else:
            break

    if total_reviews > 0:
        prior_success_rate = (total_reviews - total_lapses) / float(total_reviews)
        avg_duration_ms = sum(e.response_duration_ms for e in valid_prior_events) / float(total_reviews)
        last_event = valid_prior_events[-1]
        elapsed_seconds = max(0.0, (target_dt - last_event.reviewed_at).total_seconds())
        last_rating_raw = last_event.recall_rating
        last_rating = last_rating_raw if last_rating_raw in ("again", "hard", "good", "easy") else None
    else:
        prior_success_rate = 0.0
        avg_duration_ms = float(max(0, current_duration_ms))
        elapsed_seconds = 0.0
        last_rating = None

    return FIFAKTFeatureVector(
        vocabulary_item_id=vocabulary_item_id,
        content_version=max(1, content_version),
        total_reviews=total_reviews,
        total_lapses=total_lapses,
        consecutive_successes=consecutive_successes,
        prior_success_rate=prior_success_rate,
        elapsed_seconds=elapsed_seconds,
        avg_response_duration_ms=avg_duration_ms,
        current_response_duration_ms=max(0, min(300000, current_duration_ms)),
        last_rating=last_rating,  # type: ignore[arg-type]
        current_rating=current_rating,  # type: ignore[arg-type]
        card_difficulty=max(1.0, min(10.0, base_difficulty)),
        card_stability=max(0.001, base_stability),
    )
