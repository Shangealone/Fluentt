"""Separate personal scoring namespace. No research/classroom/personal progress writer."""

from typing import Annotated, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from app.modules.classrooms.router import Credential, Repo
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.identity.session_service import authenticated_session
from .whole_phrase import MAX_BYTES, Capability, WholePhraseScore, capability, require_personal, assess_whole_phrase

router = APIRouter(
    prefix="/me/pronunciation/whole-phrase",
    tags=["whole phrase pronunciation"],
    dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)],
)


@router.get("/capabilities", response_model=Capability)
def capabilities(
    request: Request, credential: Credential, repo: Repo, language: Literal["english", "tagalog"] = Query()
):
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        require_personal(user)
        return capability(request.app.state.settings, language)


@router.post("/assess", response_model=WholePhraseScore)
def assess(
    request: Request,
    credential: Credential,
    repo: Repo,
    activity_id: Annotated[UUID, Form()],
    activity_version: Annotated[int, Form(ge=1)],
    audio_file: Annotated[UploadFile, File()],
    cloud_consent_version: Annotated[str, Form(max_length=64)],
):
    # Read only the bounded final clip, close the spooled upload even on validation/provider failures.
    try:
        with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
            require_personal(user)
            audio = audio_file.file.read(MAX_BYTES + 1)
            return assess_whole_phrase(
                repo.session,
                user,
                request.app.state.settings,
                activity_id,
                activity_version,
                audio,
                cloud_consent_version,
            )
    finally:
        audio_file.file.close()
