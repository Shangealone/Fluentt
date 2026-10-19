from uuid import UUID
from typing import Annotated
from fastapi import APIRouter, Header, Request, Depends
from app.modules.classrooms.router import Repo, Credential, Config
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.assignments.capture import execute
from app.modules.assignments.capture_schemas import AttemptView, BackView, ProgressInput, SubmitInput

router = APIRouter(
    tags=["unscored assignment capture"], dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)]
)


@router.post("/assignments/{assignment_id}/attempt", response_model=AttemptView)
def start(assignment_id: UUID, repo: Repo, credential: Credential, settings: Config, request: Request):
    return execute(
        repo, credential, settings, action="start", assignment_id=assignment_id, request_id=request.state.request_id
    )


@router.get("/assignments/attempts/{attempt_id}", response_model=AttemptView)
def read(attempt_id: UUID, repo: Repo, credential: Credential, settings: Config):
    return execute(repo, credential, settings, action="read", attempt_id=attempt_id)


@router.put("/assignments/attempts/{attempt_id}/progress", response_model=AttemptView)
def save(
    attempt_id: UUID,
    payload: ProgressInput,
    repo: Repo,
    credential: Credential,
    settings: Config,
    request: Request,
    expected: Annotated[str | None, Header(alias="If-Match")] = None,
):
    return execute(
        repo,
        credential,
        settings,
        action="save",
        attempt_id=attempt_id,
        payload=payload,
        expected=expected,
        request_id=request.state.request_id,
    )


@router.post("/assignments/attempts/{attempt_id}/submit", response_model=AttemptView)
def submit(
    attempt_id: UUID,
    payload: SubmitInput,
    repo: Repo,
    credential: Credential,
    settings: Config,
    request: Request,
    key: Annotated[UUID, Header(alias="Idempotency-Key")],
    expected: Annotated[str | None, Header(alias="If-Match")] = None,
):
    return execute(
        repo,
        credential,
        settings,
        action="submit",
        attempt_id=attempt_id,
        payload=payload,
        expected=expected,
        request_key=key,
        request_id=request.state.request_id,
    )


@router.post("/assignments/attempts/{attempt_id}/questions/{item_id}/reveal", response_model=BackView)
def reveal(
    attempt_id: UUID,
    item_id: UUID,
    repo: Repo,
    credential: Credential,
    settings: Config,
    expected: Annotated[str | None, Header(alias="If-Match")] = None,
):
    return execute(
        repo, credential, settings, action="reveal", attempt_id=attempt_id, item_id=item_id, expected=expected
    )
