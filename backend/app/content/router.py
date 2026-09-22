import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.content.schemas import (
    LanguageResponse,
    LessonDetailResponse,
    LessonSummaryResponse,
)
from app.content.service import (
    get_active_languages,
    get_active_lesson_by_id,
    get_active_lessons_by_language,
)
from app.database.session import get_db

router = APIRouter(prefix="/content", tags=["content"])


@router.get("/languages", response_model=list[LanguageResponse])
def list_languages(
    _: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[LanguageResponse]:
    return get_active_languages(db)


@router.get("/lessons", response_model=list[LessonSummaryResponse])
def list_lessons(
    _: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    language: Annotated[str, Query(description="Language code (e.g. en, fil)")] = "en",
    content_version: Annotated[
        str | None,
        Query(
            description="Specific content version; defaults to latest active version"
        ),
    ] = None,
) -> list[LessonSummaryResponse]:
    return [
        LessonSummaryResponse(**item)
        for item in get_active_lessons_by_language(
            db, language, content_version=content_version
        )
    ]


@router.get("/lessons/{lesson_id}", response_model=LessonDetailResponse)
def get_lesson_detail(
    lesson_id: uuid.UUID,
    _: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> LessonDetailResponse:
    lesson = get_active_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found or inactive",
        )
    return LessonDetailResponse(**lesson)
