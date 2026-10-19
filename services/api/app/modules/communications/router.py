from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Header, Query as HttpQuery, Request
from app.modules.classrooms.router import Repo, Credential, Config
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.communications.schemas import Query, Send, Page, Person, Context, Classroom, MessageView, Model
from app.modules.communications.service import execute

router = APIRouter(
    tags=["class communication"], dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)]
)
Filters = Annotated[Query, HttpQuery()]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]


@router.get("/communication/classes", response_model=Page[Classroom])
def classes(repo: Repo, credential: Credential, settings: Config, query: Filters):
    return execute(repo, credential, settings, action="classes", query=query)


@router.get("/classes/{class_id}/communication", response_model=Context)
def context(class_id: UUID, repo: Repo, credential: Credential, settings: Config, student_id: UUID | None = None):
    return execute(repo, credential, settings, action="context", class_id=class_id, student_id=student_id)


@router.get("/classes/{class_id}/communication/participants", response_model=Page[Person])
def participants(class_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Filters):
    return execute(repo, credential, settings, action="participants", class_id=class_id, query=query)


@router.get("/classes/{class_id}/announcements", response_model=Page[MessageView])
def announcements(class_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Filters):
    return execute(repo, credential, settings, action="list", class_id=class_id, query=query)


@router.post("/classes/{class_id}/announcements", response_model=MessageView, status_code=201)
def announce(
    class_id: UUID, payload: Send, key: Key, request: Request, repo: Repo, credential: Credential, settings: Config
):
    return execute(
        repo,
        credential,
        settings,
        action="send",
        class_id=class_id,
        payload=payload,
        key=key,
        request_id=UUID(request.state.request_id),
    )


@router.get("/classes/{class_id}/messages/{student_id}", response_model=Page[MessageView])
def messages(class_id: UUID, student_id: UUID, repo: Repo, credential: Credential, settings: Config, query: Filters):
    return execute(repo, credential, settings, action="list", class_id=class_id, student_id=student_id, query=query)


@router.post("/classes/{class_id}/messages/{student_id}", response_model=MessageView, status_code=201)
def send(
    class_id: UUID,
    student_id: UUID,
    payload: Send,
    key: Key,
    request: Request,
    repo: Repo,
    credential: Credential,
    settings: Config,
):
    return execute(
        repo,
        credential,
        settings,
        action="send",
        class_id=class_id,
        student_id=student_id,
        payload=payload,
        key=key,
        request_id=UUID(request.state.request_id),
    )


@router.get("/classes/{class_id}/communication/messages/{message_id}", response_model=MessageView)
def detail(class_id: UUID, message_id: UUID, repo: Repo, credential: Credential, settings: Config):
    return execute(repo, credential, settings, action="detail", class_id=class_id, message_id=message_id)


@router.post("/classes/{class_id}/communication/messages/{message_id}/read", response_model=MessageView)
def read(class_id: UUID, message_id: UUID, payload: Model, repo: Repo, credential: Credential, settings: Config):
    return execute(repo, credential, settings, action="read", class_id=class_id, message_id=message_id)
