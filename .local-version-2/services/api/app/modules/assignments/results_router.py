from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Header, Request
from app.modules.classrooms.router import Repo, Credential, Config
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.assignments.schemas import Query
from app.modules.assignments.results_schemas import ResultView, ReleaseInput, ResultPage, EvaluationPage
from app.modules.assignments.results import execute, student_read

router = APIRouter(
    tags=["classroom results"], dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)]
)


@router.get("/assignments/{assignment_id}/result", response_model=ResultView)
def student_result(assignment_id: UUID, repo: Repo, credential: Credential, settings: Config):
    return student_read(repo, credential, settings, assignment_id)


@router.get("/assignments/{assignment_id}/results", response_model=ResultPage)
def submissions(
    assignment_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Annotated[Query, Depends()]
):
    return execute(repo, credential, settings, action="list", assignment_id=assignment_id, query=query)


@router.get("/assignments/results/{attempt_id}", response_model=ResultView)
def owner_result(attempt_id: UUID, repo: Repo, credential: Credential, settings: Config, run_id: UUID | None = None):
    return execute(repo, credential, settings, action="read", attempt_id=attempt_id, run_id=run_id)


@router.get("/assignments/results/{attempt_id}/evaluations", response_model=EvaluationPage)
def runs(attempt_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Annotated[Query, Depends()]):
    return execute(repo, credential, settings, action="runs", attempt_id=attempt_id, query=query)


@router.post("/assignments/results/{attempt_id}/release", response_model=ResultView)
def release(
    attempt_id: UUID,
    payload: ReleaseInput,
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
        action="release",
        attempt_id=attempt_id,
        payload=payload,
        expected=expected,
        request_key=key,
        request_id=request.state.request_id,
    )
