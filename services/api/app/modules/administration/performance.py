"""Permission-gated personal activity projection. No scores or private content."""

from datetime import datetime, time, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.modules.administration.repository import AdminRepository
from app.modules.administration.router import credential
from app.modules.administration.service import resolve_session
from app.modules.curriculum.router import get_admin_repository
from app.modules.identity.dependencies import require_secure_transport


class Counts(BaseModel):
    learn_question: int = Field(ge=0)
    learn_lesson: int = Field(ge=0)
    voice_phrase: int = Field(ge=0)
    tutor_reply: int = Field(ge=0)
    tutor_session: int = Field(ge=0)


class Learner(Counts):
    id: str
    username: str
    last_activity: datetime | None


class Day(BaseModel):
    date: str
    count: int = Field(ge=0)


class Performance(BaseModel):
    metric_version: Literal["client-reported-activity-v1"] = "client-reported-activity-v1"
    scope: Literal["active-personal-learners"] = "active-personal-learners"
    as_of: datetime
    window_start: datetime
    days: int
    learners: int = Field(ge=0)
    learners_with_activity: int = Field(ge=0)
    counts: Counts
    items: list[Learner]
    timeline: list[Day]
    offset: int
    has_more: bool


# All projections share one PostgreSQL statement snapshot. Page before materializing
# rows; never retrieve event prompts, recordings, dialogue, research or scheduler data.
SQL = text("""
WITH eligible AS (
 SELECT id, username, canonical_username FROM users
 WHERE role = 'personal_student' AND profile_status = 'active' AND archived_at IS NULL
), events AS (
 SELECT e.user_id, e.kind, e.recorded_at FROM personal_activity_events e
 JOIN eligible u ON u.id = e.user_id
 WHERE e.recorded_at >= :start AND e.recorded_at <= :now
), grouped AS (
 SELECT user_id,
 count(*) FILTER (WHERE kind='learn_question') AS learn_question,
 count(*) FILTER (WHERE kind='learn_lesson') AS learn_lesson,
 count(*) FILTER (WHERE kind='voice_phrase') AS voice_phrase,
 count(*) FILTER (WHERE kind='tutor_reply') AS tutor_reply,
 count(*) FILTER (WHERE kind='tutor_session') AS tutor_session,
 max(recorded_at) AS last_activity
 FROM events GROUP BY user_id
), page AS (
 SELECT u.id::text AS id, u.username, u.canonical_username AS sort_username,
 coalesce(g.learn_question,0) AS learn_question, coalesce(g.learn_lesson,0) AS learn_lesson,
 coalesce(g.voice_phrase,0) AS voice_phrase, coalesce(g.tutor_reply,0) AS tutor_reply,
 coalesce(g.tutor_session,0) AS tutor_session, g.last_activity
 FROM eligible u LEFT JOIN grouped g ON g.user_id=u.id
 WHERE u.username ILIKE :search ESCAPE '!'
 ORDER BY u.canonical_username,u.id LIMIT :limit OFFSET :offset
), daily AS (
 SELECT (recorded_at AT TIME ZONE 'UTC')::date::text AS date, count(*) AS count
 FROM events GROUP BY 1 ORDER BY 1
)
SELECT
 (SELECT count(*) FROM eligible) AS learners,
 (SELECT count(*) FROM grouped) AS learners_with_activity,
 (SELECT jsonb_build_object(
 'learn_question',count(*) FILTER (WHERE kind='learn_question'),
 'learn_lesson',count(*) FILTER (WHERE kind='learn_lesson'),
 'voice_phrase',count(*) FILTER (WHERE kind='voice_phrase'),
 'tutor_reply',count(*) FILTER (WHERE kind='tutor_reply'),
 'tutor_session',count(*) FILTER (WHERE kind='tutor_session')) FROM events) AS counts,
 coalesce((SELECT jsonb_agg(to_jsonb(p)-'sort_username' ORDER BY p.sort_username,p.id) FROM page p),'[]'::jsonb) AS items,
 coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.date) FROM daily d),'[]'::jsonb) AS timeline
""")


def project(db, *, days=30, q="", offset=0, limit=20, now=None):
    now = now or datetime.now(timezone.utc)
    start = datetime.combine((now - timedelta(days=days - 1)).date(), time.min, timezone.utc)
    escaped = q.strip().replace("!", "!!").replace("%", "!%").replace("_", "!_")
    row = dict(
        db.execute(SQL, {"start": start, "now": now, "search": f"%{escaped}%", "limit": limit + 1, "offset": offset})
        .mappings()
        .one()
    )
    rows = row.pop("items")
    return Performance(
        **row, items=rows[:limit], has_more=len(rows) > limit, offset=offset, days=days, window_start=start, as_of=now
    )


router = APIRouter(
    prefix="/admin/performance", tags=["administrator performance"], dependencies=[Depends(require_secure_transport)]
)


@router.get("", response_model=Performance)
def overview(
    repo: Annotated[AdminRepository, Depends(get_admin_repository)],
    token: Annotated[str, Depends(credential)],
    days: Literal["7", "30", "90"] = "30",
    q: str = Query(default="", max_length=100),
    offset: int = Query(default=0, ge=0, le=100000),
    limit: int = Query(default=20, ge=1, le=50),
):
    return resolve_session(
        repo,
        token,
        required_permission="performance.read",
        read_operation=lambda _: project(repo.session, days=int(days), q=q, offset=offset, limit=limit),
    )
