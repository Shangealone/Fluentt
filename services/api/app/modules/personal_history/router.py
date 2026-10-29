"""Bounded client-reported activity metadata; no answers, audio, dialogue or grades."""

from datetime import datetime, timezone
import hashlib
import json
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select

from app.models.personal_history import PersonalActivityEvent
from app.modules.classrooms.router import Config, Credential, Repo
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.identity.errors import IdentityError
from app.modules.identity.session_service import authenticated_session

Kind = Literal["learn_question", "learn_lesson", "voice_phrase", "tutor_reply", "tutor_session"]
Area = Literal["all", "learn", "voice", "tutor"]
router = APIRouter(
    prefix="/me/personal-history",
    tags=["personal history"],
    dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)],
)


class EventInput(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True, strict=True)
    event_key: UUID = Field(strict=False)
    kind: Kind
    source_id: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9_.:-]+$")
    content_version: int | None = Field(default=None, ge=1)
    title: str = Field(min_length=1, max_length=200)
    prompt: str | None = Field(default=None, max_length=8000)
    language: Literal["english", "tagalog"]

    @model_validator(mode="after")
    def safe_display(self):
        if not self.title.strip() or any(ord(c) < 32 and c not in "\n\t" for c in self.title + (self.prompt or "")):
            raise ValueError("Use a nonempty plain-text activity title")
        if self.kind.startswith("tutor_") and self.prompt is not None:
            raise ValueError("Conversation text is not retained in personal history")
        return self


class EventView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    event_key: UUID
    kind: Kind
    source_id: str
    content_version: int | None
    title: str
    prompt: str | None
    language: Literal["english", "tagalog"]
    recorded_at: datetime
    evidence: Literal["client-reported-activity-v1"] = "client-reported-activity-v1"


class HistoryPage(BaseModel):
    items: list[EventView]
    has_more: bool
    offset: int


def require_owner(user):
    if user.role != "personal_student" or user.profile_status != "active":
        raise IdentityError(403, "personal_only", "Personal history is available only to active personal learners.")


def record(db, user, body):
    require_owner(user)
    payload = body.model_dump(mode="json")
    fingerprint = hashlib.sha256(
        json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()
    existing = db.scalar(
        select(PersonalActivityEvent).where(
            PersonalActivityEvent.user_id == user.id, PersonalActivityEvent.event_key == body.event_key
        )
    )
    if existing:
        if existing.fingerprint != fingerprint:
            raise IdentityError(
                409, "history_event_conflict", "This history request was already used for another activity."
            )
        return EventView.model_validate(existing)
    row = PersonalActivityEvent(
        user_id=user.id, **body.model_dump(), fingerprint=fingerprint, recorded_at=datetime.now(timezone.utc)
    )
    db.add(row)
    db.flush()
    return EventView.model_validate(row)


@router.post("", response_model=EventView)
def create_event(body: EventInput, credential: Credential, repo: Repo, settings: Config):
    # Existing user/session locks serialize owner retries and are held through the write.
    with authenticated_session(repo, credential, settings) as (_, user):
        return record(repo.session, user, body)


@router.get("", response_model=HistoryPage)
def history(
    credential: Credential,
    repo: Repo,
    settings: Config,
    area: Area = "all",
    offset: int = Query(default=0, ge=0, le=100000),
    limit: int = Query(default=20, ge=1, le=50),
):
    with authenticated_session(repo, credential, settings) as (_, user):
        require_owner(user)
        query = select(PersonalActivityEvent).where(PersonalActivityEvent.user_id == user.id)
        if area != "all":
            kinds = {
                "learn": ["learn_question", "learn_lesson"],
                "voice": ["voice_phrase"],
                "tutor": ["tutor_reply", "tutor_session"],
            }
            query = query.where(PersonalActivityEvent.kind.in_(kinds[area]))
        rows = repo.session.scalars(
            query.order_by(PersonalActivityEvent.recorded_at.desc(), PersonalActivityEvent.id.desc())
            .offset(offset)
            .limit(limit + 1)
        ).all()
        return HistoryPage(
            items=[EventView.model_validate(row) for row in rows[:limit]], offset=offset, has_more=len(rows) > limit
        )
