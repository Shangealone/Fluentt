"""Record the client's external assessment outcomes; never infer measured ability."""
import hashlib
import json
import re
from datetime import date, datetime, timezone, timedelta
from typing import Literal, Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Header, Request, Query
from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from app.models.student_proficiency import StudentProficiencyEvent as Event
from app.models.operations import AuditLog
from app.modules.monitoring.service import authorized
from app.modules.classrooms.router import Repo, Credential, Config
from app.modules.identity.session_service import authenticated_session
from app.modules.identity.errors import IdentityError
from app.modules.enrollment.service import require_student
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions

Level = Literal["beginner", "intermediate", "advanced"]
Language = Literal["english", "tagalog"]
router = APIRouter(tags=["external assessment outcomes"], dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)])


class AssessmentInput(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    level: Level | None
    assessed_on: date | None
    expected_event_id: UUID | None

    @field_validator("assessed_on", mode="before")
    @classmethod
    def date_format(cls, value):
        if value is not None and (not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)):
            raise ValueError("Use an assessment date in YYYY-MM-DD format")
        return value

    @model_validator(mode="after")
    def date_matches_level(self):
        if (self.level is None) != (self.assessed_on is None):
            raise ValueError("An assessed level needs its assessment date; Not assessed yet has no assessment date")
        if self.assessed_on and self.assessed_on > datetime.now(timezone(timedelta(hours=8))).date():
            raise ValueError("The assessment date cannot be in the future")
        return self


class AssessmentEvent(BaseModel):
    id: UUID
    level: Level | None
    assessed_on: date | None
    recorded_at: datetime
    recorded_by: str


class AssessmentView(BaseModel):
    student_id: UUID
    username: str
    language: Language
    current: AssessmentEvent | None
    history: list[AssessmentEvent]
    offset: int
    has_more: bool


def view(db, student, language, offset=0):
    # Keep current and paginated history consistent across separate SQL reads.
    # A writer already owns this scope exclusively in the same transaction.
    db.execute(text("SELECT pg_advisory_xact_lock_shared(hashtextextended(:scope, 0))"),
               {"scope": f"external-proficiency:{student.id}:{language}"})
    query = select(Event).where(Event.student_id == student.id, Event.language == language).order_by(Event.ordinal.desc())
    current = db.scalar(query.limit(1))
    rows = list(db.scalars(query.offset(offset).limit(21)))
    def event(row):
        return AssessmentEvent(id=row.id, level=row.level, assessed_on=row.assessed_on,
                               recorded_at=row.recorded_at, recorded_by=row.recorder_username)
    return AssessmentView(student_id=student.id, username=student.username, language=language,
        current=event(current) if current else None, history=[event(row) for row in rows[:20]],
        offset=offset, has_more=len(rows) > 20)


def fail(status, message):
    return IdentityError(status, "assessed_proficiency_unavailable", message)


def write(repo, credential, settings, class_id, student_id, payload, key, request_id):
    try:
        with authorized(repo, credential, settings, class_id, student_id) as (db, user, classroom, students):
            language = classroom.language
            db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:scope, 0))"),
                       {"scope": f"external-proficiency:{student_id}:{language}"})
            digest = hashlib.sha256(json.dumps({"class_id": str(class_id), "student_id": str(student_id),
                "body": payload.model_dump(mode="json")}, sort_keys=True).encode()).hexdigest()
            prior = db.scalar(select(Event).where(Event.recorded_by == user.id, Event.request_id == key))
            if prior:
                if prior.fingerprint != digest:
                    raise fail(409, "This request was already used for different assessment details.")
                # A retry returns today's latest state, never reinstates an older entry.
                return view(db, students[0], language)
            latest = db.scalar(select(Event).where(Event.student_id == student_id, Event.language == language).order_by(Event.ordinal.desc()).limit(1))
            if (latest.id if latest else None) != payload.expected_event_id:
                raise fail(409, "This student's assessment record changed. Reload it before saving your entry.")
            now = datetime.now(timezone.utc)
            entry = Event(student_id=student_id, language=language, ordinal=latest.ordinal + 1 if latest else 1,
                level=payload.level, assessed_on=payload.assessed_on, recorded_at=now,
                recorded_by=user.id, recorder_username=user.username, source_class_id=class_id,
                request_id=key, fingerprint=digest)
            db.add(entry); db.flush()
            db.add(AuditLog(actor_id=user.id, action="external_assessment.recorded", entity_type="student_proficiency_events",
                entity_id=entry.id, occurred_at=now, request_id=request_id, safe_metadata={"language": language}))
            db.flush()
            return view(db, students[0], language)
    except DBAPIError as exc:
        if getattr(exc.orig, "sqlstate", None) in {"55P03", "40P01", "40001"}:
            raise fail(409, "This student's record is busy. Reload and try again.") from exc
        raise


@router.get("/classes/{class_id}/students/{student_id}/assessed-proficiency", response_model=AssessmentView)
def read(class_id: UUID, student_id: UUID, repo: Repo, credential: Credential, settings: Config,
         offset: Annotated[int, Query(ge=0, le=100000)] = 0):
    with authorized(repo, credential, settings, class_id, student_id) as (db, _, classroom, students):
        return view(db, students[0], classroom.language, offset)


@router.post("/classes/{class_id}/students/{student_id}/assessed-proficiency", response_model=AssessmentView)
def record(class_id: UUID, student_id: UUID, payload: AssessmentInput, repo: Repo, credential: Credential,
           settings: Config, request: Request, key: Annotated[UUID, Header(alias="Idempotency-Key")]):
    return write(repo, credential, settings, class_id, student_id, payload, key, request.state.request_id)


@router.get("/me/assessed-proficiency", response_model=AssessmentView)
def mine(repo: Repo, credential: Credential, settings: Config, language: Language = "english",
         offset: Annotated[int, Query(ge=0, le=100000)] = 0):
    with authenticated_session(repo, credential, settings) as (_, user):
        require_student(user)
        return view(repo.session, user, language, offset)
