from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Header, Request
from app.modules.classrooms.router import Repo, Credential, Config
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.assignments.schemas import DraftInput, DraftView, DraftSummary, Page, Query, Context, Item
from app.modules.assignments.service import execute
from app.modules.assignments.schemas import PublishInput, PublishedView
from app.modules.assignments.publication import student_read

router = APIRouter(
    tags=["instructor assignment drafts"], dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)]
)


@router.post("/assignments/{assignment_id}/publish", response_model=DraftView)
def publish(
    assignment_id: UUID,
    payload: PublishInput,
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
        action="publish",
        assignment_id=assignment_id,
        payload=payload,
        expected=expected,
        request_key=key,
        request_id=request.state.request_id,
    )


@router.get("/classes/{class_id}/published-assignments", response_model=Page[PublishedView])
def student_list(
    class_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Annotated[Query, Depends()]
):
    return student_read(repo, credential, settings, class_id=class_id, query=query)


@router.get("/assignments/{assignment_id}/published", response_model=PublishedView)
def student_detail(assignment_id: UUID, repo: Repo, credential: Credential, settings: Config):
    return student_read(repo, credential, settings, assignment_id=assignment_id)


@router.get("/classes/{class_id}/assignments", response_model=Page[DraftSummary])
def listing(class_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Annotated[Query, Depends()]):
    return execute(repo, credential, settings, action="list", class_id=class_id, query=query)


@router.post("/classes/{class_id}/assignments", response_model=DraftView, status_code=201)
def create(
    class_id: UUID,
    payload: DraftInput,
    repo: Repo,
    credential: Credential,
    settings: Config,
    request: Request,
    key: Annotated[UUID, Header(alias="Idempotency-Key")],
):
    return execute(
        repo,
        credential,
        settings,
        action="create",
        class_id=class_id,
        payload=payload,
        request_key=key,
        request_id=request.state.request_id,
    )


@router.get("/classes/{class_id}/assignment-lessons", response_model=Page[Context])
def lessons(class_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Annotated[Query, Depends()]):
    return execute(repo, credential, settings, action="lessons", class_id=class_id, query=query)


@router.get("/classes/{class_id}/assignment-questions", response_model=Page[Item])
def questions(
    class_id: UUID,
    lesson_id: UUID,
    repo: Repo,
    credential: Credential,
    settings: Config,
    query: Annotated[Query, Depends()],
):
    return execute(repo, credential, settings, action="questions", class_id=class_id, lesson_id=lesson_id, query=query)


@router.get("/assignments/{assignment_id}", response_model=DraftView)
def read(assignment_id: UUID, repo: Repo, credential: Credential, settings: Config):
    return execute(repo, credential, settings, action="read", assignment_id=assignment_id)


@router.patch("/assignments/{assignment_id}", response_model=DraftView)
def replace(
    assignment_id: UUID,
    payload: DraftInput,
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
        action="replace",
        assignment_id=assignment_id,
        payload=payload,
        expected=expected,
        request_id=request.state.request_id,
    )


@router.post("/assignments/{assignment_id}/archive", response_model=DraftView)
def archive(
    assignment_id: UUID,
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
        action="archive",
        assignment_id=assignment_id,
        expected=expected,
        request_id=request.state.request_id,
    )
