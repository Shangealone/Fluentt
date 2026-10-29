"""FastAPI router for student pronunciation activities and audio attempt recording."""

from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile

from app.modules.classrooms.router import Credential, Repo
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.identity.session_service import authenticated_session
from app.modules.pronunciation.schemas import (
    PronunciationActivitiesResponse,
    PronunciationActivityDTO,
    PronunciationAttemptSubmissionDTO,
    PronunciationAttemptHistoryDTO,
)
from app.modules.pronunciation.service import (
    get_pronunciation_activities,
    get_pronunciation_activity,
    record_pronunciation_attempt,
    get_user_pronunciation_attempts,
)

router = APIRouter(
    prefix="/me/pronunciation",
    tags=["pronunciation"],
    dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)],
)


@router.get("/activities", response_model=PronunciationActivitiesResponse)
def list_activities(
    request: Request,
    credential: Credential,
    repo: Repo,
    language: str | None = None,
):
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_pronunciation_activities(repo.session, user, language=language)


@router.get("/activities/{activity_id}", response_model=PronunciationActivityDTO)
def get_activity(
    activity_id: UUID,
    request: Request,
    credential: Credential,
    repo: Repo,
):
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_pronunciation_activity(repo.session, user, activity_id=activity_id)


@router.post("/attempts", response_model=PronunciationAttemptSubmissionDTO)
async def submit_attempt(
    request: Request,
    credential: Credential,
    repo: Repo,
    activity_id: Annotated[UUID, Form(...)],
    audio_file: Annotated[UploadFile, File(...)],
    duration_ms: Annotated[int, Form(ge=0, le=300000)],
    context_type: Annotated[str, Form()] = "self_study",
    class_id: Annotated[UUID | None, Form()] = None,
):
    audio_bytes = await audio_file.read()
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return record_pronunciation_attempt(
            repo.session,
            user=user,
            activity_id=activity_id,
            audio_bytes=audio_bytes,
            reported_content_type=audio_file.content_type,
            client_duration_ms=duration_ms,
            context_type=context_type,
            class_id=class_id,
        )


@router.get("/attempts", response_model=list[PronunciationAttemptHistoryDTO])
def list_attempts(
    request: Request,
    credential: Credential,
    repo: Repo,
    activity_id: UUID | None = None,
    context_type: str = "self_study",
    class_id: UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_user_pronunciation_attempts(
            repo.session,
            user=user,
            activity_id=activity_id,
            context_type=context_type,
            class_id=class_id,
            limit=limit,
        )


@router.post("/attempts/{attempt_id}/transcribe")
def transcribe_attempt(
    attempt_id: UUID,
    request: Request,
    credential: Credential,
    repo: Repo,
    force_retranscribe: bool = False,
    context_type: str = "self_study",
    class_id: UUID | None = None,
):
    from app.modules.speech.service import transcribe_pronunciation_attempt

    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return transcribe_pronunciation_attempt(
            repo.session,
            user=user,
            attempt_id=attempt_id,
            force_retranscribe=force_retranscribe,
            context_type=context_type,
            class_id=class_id,
        )


@router.get("/attempts/{attempt_id}/transcription")
def get_transcription(
    attempt_id: UUID,
    request: Request,
    credential: Credential,
    repo: Repo,
    context_type: str = "self_study",
    class_id: UUID | None = None,
):
    from app.modules.speech.service import get_attempt_transcription

    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_attempt_transcription(
            repo.session,
            user=user,
            attempt_id=attempt_id,
            context_type=context_type,
            class_id=class_id,
        )


@router.post("/attempts/{attempt_id}/evaluate")
def evaluate_attempt(
    attempt_id: UUID,
    request: Request,
    credential: Credential,
    repo: Repo,
    context_type: str = "self_study",
    class_id: UUID | None = None,
):
    from app.modules.speech.service import evaluate_pronunciation_attempt

    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return evaluate_pronunciation_attempt(
            repo.session,
            user=user,
            attempt_id=attempt_id,
            context_type=context_type,
            class_id=class_id,
        )


@router.get("/attempts/{attempt_id}/assessment")
def get_assessment(
    attempt_id: UUID,
    request: Request,
    credential: Credential,
    repo: Repo,
    context_type: str = "self_study",
    class_id: UUID | None = None,
):
    from app.modules.speech.service import get_attempt_assessment

    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_attempt_assessment(
            repo.session,
            user=user,
            attempt_id=attempt_id,
            context_type=context_type,
            class_id=class_id,
        )

