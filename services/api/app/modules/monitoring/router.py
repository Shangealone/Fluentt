from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Query as HttpQuery
from app.modules.classrooms.router import Repo, Credential, Config
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.monitoring.schemas import (
    Query,
    Page,
    Classroom,
    Overview,
    Student,
    Assignment,
    ContextOption,
    StudentDetail,
    AssignmentDetail,
)
from app.modules.monitoring.service import execute

router = APIRouter(
    tags=["instructor monitoring"], dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)]
)
Filters = Annotated[Query, HttpQuery()]


@router.get("/instructor/monitoring/classes", response_model=Page[Classroom])
def classes(repo: Repo, credential: Credential, settings: Config, query: Filters):
    return execute(repo, credential, settings, action="classes", query=query)


@router.get("/classes/{class_id}/monitoring", response_model=Overview)
def overview(class_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Filters):
    return execute(repo, credential, settings, action="overview", class_id=class_id, query=query)


@router.get("/classes/{class_id}/monitoring/contexts", response_model=Page[ContextOption])
def contexts(class_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Filters):
    return execute(repo, credential, settings, action="contexts", class_id=class_id, query=query)


@router.get("/classes/{class_id}/monitoring/students", response_model=Page[Student])
def students(class_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Filters):
    return execute(repo, credential, settings, action="roster", class_id=class_id, query=query)


@router.get("/classes/{class_id}/monitoring/students/{student_id}", response_model=StudentDetail)
def student(class_id: UUID, student_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Filters):
    return execute(repo, credential, settings, action="student", class_id=class_id, student_id=student_id, query=query)


@router.get("/classes/{class_id}/monitoring/assignments", response_model=Page[Assignment])
def assignments(class_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Filters):
    return execute(repo, credential, settings, action="assignments", class_id=class_id, query=query)


@router.get("/classes/{class_id}/monitoring/assignments/{assignment_id}", response_model=AssignmentDetail)
def assignment(
    class_id: UUID, assignment_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Filters
):
    return execute(
        repo, credential, settings, action="assignment", class_id=class_id, assignment_id=assignment_id, query=query
    )
