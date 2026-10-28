"""FastAPI router for student pronunciation activities and audio attempt recording."""

from typing import Annotated, Literal
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
from .wavlm_contract import Score, MAX_BYTES
from . import wavlm_service
from .upload_limit import AudioUploadRoute

router = APIRouter(
    prefix="/me/pronunciation",
    tags=["pronunciation"],
    dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)],
    route_class=AudioUploadRoute,
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


@router.get("/capabilities")
def acoustic_capabilities(
    request: Request, credential: Credential, repo: Repo, language: Literal["english", "tagalog"]
):
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        wavlm_service.require_student(user)
        return wavlm_service.capabilities(request.app.state.settings, language)


@router.post("/attempts", response_model=PronunciationAttemptSubmissionDTO | Score)
def submit_attempt(
    request: Request,
    credential: Credential,
    repo: Repo,
    activity_id: Annotated[UUID, Form(...)],
    audio_file: Annotated[UploadFile, File(...)],
    duration_ms: Annotated[int, Form(ge=0, le=300000)],
    context_type: Annotated[str, Form()] = "self_study",
    class_id: Annotated[UUID | None, Form()] = None,
    assessment_engine: Annotated[Literal["legacy", "wavlm"], Form()] = "legacy",
    activity_version: Annotated[int | None, Form(ge=1)] = None,
    request_id: Annotated[UUID | None, Form()] = None,
    consent_version: Annotated[str | None, Form(max_length=80)] = None,
):
    try:
        audio_bytes = audio_file.file.read(MAX_BYTES + 1)
        if assessment_engine == "wavlm":
            if activity_version is None or request_id is None:
                from app.modules.identity.errors import IdentityError

                raise IdentityError(
                    422, "wavlm_request_required", "An activity version and recording request UUID are required."
                )
            if context_type not in {"self_study", "personal", "classroom"} or (
                context_type == "classroom" and class_id is None
            ):
                from app.modules.identity.errors import IdentityError

                raise IdentityError(
                    422, "wavlm_context_invalid", "Use independent practice or an authorized ordinary classroom."
                )
            return wavlm_service.assess(
                repo,
                credential,
                request.app.state.settings,
                activity_id=activity_id,
                activity_version=activity_version,
                audio=audio_bytes,
                key=request_id,
                consent_version=consent_version,
                class_id=class_id,
            )
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
    finally:
        audio_file.file.close()


@router.get("/attempts", response_model=list[PronunciationAttemptHistoryDTO | Score])
def list_attempts(
    request: Request,
    credential: Credential,
    repo: Repo,
    activity_id: UUID | None = None,
    context_type: str = "self_study",
    class_id: UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0, le=10000)] = 0,
    assessment_engine: Literal["legacy", "wavlm"] = "legacy",
):
    if assessment_engine == "wavlm":
        if context_type not in {"self_study", "personal", "classroom"} or (
            context_type == "classroom" and class_id is None
        ):
            from app.modules.identity.errors import IdentityError

            raise IdentityError(422, "wavlm_context_invalid", "Research records are unavailable here.")
        return wavlm_service.history(
            repo,
            credential,
            request.app.state.settings,
            activity_id=activity_id,
            class_id=class_id,
            limit=min(limit, 50),
            offset=offset,
        )
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_user_pronunciation_attempts(
            repo.session,
            user=user,
            activity_id=activity_id,
            context_type=context_type,
            class_id=class_id,
            limit=limit,
        )


@router.get("/classes/{class_id}/attempts")
def classroom_model_attempts(
    class_id: UUID,
    request: Request,
    credential: Credential,
    repo: Repo,
    offset: Annotated[int, Query(ge=0, le=10000)] = 0,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
):
    return wavlm_service.classroom_attempts(repo, credential, request.app.state.settings, class_id, offset, limit)


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
        wavlm_service.protect_result(repo.session, user, attempt_id)
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
        wavlm_service.protect_result(repo.session, user, attempt_id)
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
        wavlm_service.protect_result(repo.session, user, attempt_id)
        return get_attempt_assessment(
            repo.session,
            user=user,
            attempt_id=attempt_id,
            context_type=context_type,
            class_id=class_id,
        )
