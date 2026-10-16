from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.orm import Session
from app.core.config import Settings
from app.db.session import get_session
from app.modules.identity.dependencies import (
    get_identity_settings,
    require_credential,
    require_secure_transport,
    throttle,
    throttle_sessions,
)
from app.modules.classrooms.repository import ClassroomRepository
from app.modules.classrooms.schemas import ClassCreate, ClassUpdate, ClassDetails
from app.modules.classrooms.service import create_class, list_classes, read_class, update_class


def get_classroom_repository(session: Annotated[Session, Depends(get_session)]) -> ClassroomRepository:
    return ClassroomRepository(session)


def throttle_creation(request: Request):
    throttle(request, "class_creation", "class_creation_limit")


router = APIRouter(
    prefix="/classes",
    tags=["instructor classrooms"],
    dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)],
)
Repo = Annotated[ClassroomRepository, Depends(get_classroom_repository)]
Credential = Annotated[str, Depends(require_credential)]
Config = Annotated[Settings, Depends(get_identity_settings)]


@router.post("", response_model=ClassDetails, status_code=201, dependencies=[Depends(throttle_creation)])
def create(
    payload: ClassCreate,
    credential: Credential,
    repo: Repo,
    settings: Config,
    request_id: Annotated[UUID, Header(alias="Idempotency-Key")],
):
    return create_class(repo, credential, settings, payload, request_id)


@router.get("/mine", response_model=list[ClassDetails])
def mine(
    credential: Credential,
    repo: Repo,
    settings: Config,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0, le=100000)] = 0,
):
    return list_classes(repo, credential, settings, limit, offset)


@router.get("/{class_id}", response_model=ClassDetails)
def detail(class_id: UUID, credential: Credential, repo: Repo, settings: Config):
    return read_class(repo, credential, settings, class_id)


@router.patch("/{class_id}", response_model=ClassDetails)
def edit(class_id: UUID, payload: ClassUpdate, credential: Credential, repo: Repo, settings: Config):
    return update_class(repo, credential, settings, class_id, payload)
