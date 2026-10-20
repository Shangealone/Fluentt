from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.modules.classrooms.router import Credential, Repo
from app.modules.curriculum.material_schemas import MaterialPage, NotificationPage, NotificationItem
from app.modules.curriculum.material_service import get_lesson_materials
from app.modules.curriculum.notification_service import (
    list_notifications,
    mark_notification_read,
    mark_all_notifications_read,
)
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.identity.session_service import authenticated_session

router = APIRouter(
    dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)],
)


@router.get("/lessons/{lesson_id}/materials", response_model=MaterialPage, tags=["learning materials"])
def lesson_materials(
    lesson_id: UUID,
    request: Request,
    credential: Credential,
    repo: Repo,
):
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_lesson_materials(repo.session, lesson_id)


@router.get("/me/notifications", response_model=NotificationPage, tags=["notifications"])
def get_my_notifications(
    request: Request,
    credential: Credential,
    repo: Repo,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0, le=100000)] = 0,
):
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return list_notifications(repo.session, user, limit=limit, offset=offset)


@router.post("/me/notifications/{notification_id}/read", response_model=NotificationItem, tags=["notifications"])
def read_notification(
    notification_id: UUID,
    request: Request,
    credential: Credential,
    repo: Repo,
):
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return mark_notification_read(repo.session, user, notification_id)


@router.post("/me/notifications/read-all", tags=["notifications"])
def read_all_notifications(
    request: Request,
    credential: Credential,
    repo: Repo,
):
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        count = mark_all_notifications_read(repo.session, user)
        return {"read_count": count}
