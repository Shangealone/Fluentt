from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Header, Query, Request
from app.modules.classrooms.router import Repo, Credential, Config
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.teacher_lessons import service
from app.modules.teacher_lessons.schemas import LessonInput, Command

router = APIRouter(tags=["teacher lessons"], dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)])
Offset = Annotated[int, Query(ge=0, le=100000)]
Limit = Annotated[int, Query(ge=1, le=100)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]
Expected = Annotated[str | None, Header(alias="If-Match")]


@router.get("/instructor/lesson-subjects")
def subjects(repo: Repo, credential: Credential, settings: Config):
    return service.read(repo, credential, settings, subjects=True)


@router.get("/instructor/lessons")
def library(repo: Repo, credential: Credential, settings: Config, offset: Offset = 0, limit: Limit = 20, class_id: UUID | None = None):
    return service.read(repo, credential, settings, class_id=class_id, offset=offset, limit=limit)


@router.post("/instructor/lessons", status_code=201)
def create(payload: LessonInput, repo: Repo, credential: Credential, settings: Config, key: Key, request: Request):
    return service.mutate(repo, credential, settings, payload=payload, request_key=key, request_id=request.state.request_id)


@router.get("/instructor/lessons/{root_id}")
def detail(root_id: UUID, repo: Repo, credential: Credential, settings: Config, version_id: UUID | None = None):
    return service.read(repo, credential, settings, root_id=root_id, version_id=version_id)


@router.get("/instructor/lessons/{root_id}/classes")
def classes(root_id: UUID, repo: Repo, credential: Credential, settings: Config, version_id: UUID, offset: Offset = 0, limit: Limit = 20):
    return service.read(repo, credential, settings, root_id=root_id, version_id=version_id, options=True, offset=offset, limit=limit)


@router.post("/instructor/lessons/{root_id}/actions")
def change(root_id: UUID, payload: Command, repo: Repo, credential: Credential, settings: Config, key: Key, request: Request, expected: Expected = None):
    return service.mutate(repo, credential, settings, root_id=root_id, payload=payload, request_key=key, expected=expected, request_id=request.state.request_id)


@router.get("/classes/{class_id}/teacher-lessons")
def student_lessons(class_id: UUID, repo: Repo, credential: Credential, settings: Config, offset: Offset = 0, limit: Limit = 20):
    return service.student_read(repo, credential, settings, class_id, offset=offset, limit=limit)


@router.get("/classes/{class_id}/teacher-lessons/{lesson_id}")
def student_lesson(class_id: UUID, lesson_id: UUID, repo: Repo, credential: Credential, settings: Config):
    return service.student_read(repo, credential, settings, class_id, lesson_id=lesson_id)
