import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.content.models import Language, Lesson, VocabularyItem


def import_content_data(db: Session, data: dict[str, Any]) -> None:
    lang_info = data["language"]
    lang_code = lang_info["code"].strip().lower()
    lang_name = lang_info["name"].strip()
    lang_active = lang_info.get("is_active", True)

    existing_lang = db.scalar(select(Language).where(Language.code == lang_code))
    if existing_lang:
        existing_lang.name = lang_name
        existing_lang.is_active = lang_active
    else:
        new_lang = Language(
            code=lang_code,
            name=lang_name,
            is_active=lang_active,
        )
        db.add(new_lang)

    default_version = data.get("content_version", "v0.1")

    for lesson_data in data.get("lessons", []):
        lesson_id = uuid.UUID(str(lesson_data["id"]))
        lesson_version = lesson_data.get("content_version", default_version)
        existing_lesson = db.scalar(select(Lesson).where(Lesson.id == lesson_id))
        if existing_lesson:
            existing_lesson.language_code = lang_code
            existing_lesson.title = lesson_data["title"]
            existing_lesson.description = lesson_data.get("description")
            existing_lesson.content_version = lesson_version
            existing_lesson.is_active = lesson_data.get("is_active", True)
            existing_lesson.sort_order = lesson_data.get("sort_order", 0)
        else:
            new_lesson = Lesson(
                id=lesson_id,
                language_code=lang_code,
                title=lesson_data["title"],
                description=lesson_data.get("description"),
                content_version=lesson_version,
                is_active=lesson_data.get("is_active", True),
                sort_order=lesson_data.get("sort_order", 0),
            )
            db.add(new_lesson)

        for item_data in lesson_data.get("vocabulary_items", []):
            item_id = uuid.UUID(str(item_data["id"]))
            item_version = item_data.get("content_version", lesson_version)
            existing_item = db.scalar(
                select(VocabularyItem).where(VocabularyItem.id == item_id)
            )
            if existing_item:
                existing_item.lesson_id = lesson_id
                existing_item.term = item_data["term"]
                existing_item.definition = item_data["definition"]
                existing_item.example_sentence = item_data["example_sentence"]
                existing_item.difficulty = item_data.get("difficulty", "beginner")
                existing_item.category = item_data.get("category")
                existing_item.translation = item_data.get("translation")
                existing_item.content_version = item_version
                existing_item.is_active = item_data.get("is_active", True)
                existing_item.sort_order = item_data.get("sort_order", 0)
            else:
                new_item = VocabularyItem(
                    id=item_id,
                    lesson_id=lesson_id,
                    term=item_data["term"],
                    definition=item_data["definition"],
                    example_sentence=item_data["example_sentence"],
                    difficulty=item_data.get("difficulty", "beginner"),
                    category=item_data.get("category"),
                    translation=item_data.get("translation"),
                    content_version=item_version,
                    is_active=item_data.get("is_active", True),
                    sort_order=item_data.get("sort_order", 0),
                )
                db.add(new_item)

    db.commit()


def get_active_languages(db: Session) -> list[Language]:
    return list(
        db.scalars(
            select(Language).where(Language.is_active == True).order_by(Language.code)
        ).all()
    )


def get_active_lessons_by_language(
    db: Session, language_code: str, content_version: str | None = None
) -> list[dict[str, Any]]:
    norm_lang = language_code.strip().lower()
    target_version = content_version

    if target_version is None:
        # Default learner feed: select latest active content version for the requested language
        target_version = db.scalar(
            select(Lesson.content_version)
            .where(
                Lesson.language_code == norm_lang,
                Lesson.is_active == True,
            )
            .order_by(Lesson.created_at.desc())
            .limit(1)
        )
        if not target_version:
            return []

    lessons = list(
        db.scalars(
            select(Lesson)
            .where(
                Lesson.language_code == norm_lang,
                Lesson.is_active == True,
                Lesson.content_version == target_version,
            )
            .order_by(Lesson.sort_order)
        ).all()
    )

    results = []
    for lesson in lessons:
        active_item_count = (
            db.scalar(
                select(func.count(VocabularyItem.id)).where(
                    VocabularyItem.lesson_id == lesson.id,
                    VocabularyItem.is_active == True,
                    VocabularyItem.content_version == lesson.content_version,
                )
            )
            or 0
        )
        results.append(
            {
                "id": lesson.id,
                "language_code": lesson.language_code,
                "title": lesson.title,
                "description": lesson.description,
                "content_version": lesson.content_version,
                "sort_order": lesson.sort_order,
                "item_count": active_item_count,
            }
        )
    return results


def get_active_lesson_by_id(
    db: Session, lesson_id: uuid.UUID
) -> dict[str, Any] | None:
    lesson = db.scalar(
        select(Lesson).where(
            Lesson.id == lesson_id,
            Lesson.is_active == True,
        )
    )
    if not lesson:
        return None

    active_items = list(
        db.scalars(
            select(VocabularyItem)
            .where(
                VocabularyItem.lesson_id == lesson.id,
                VocabularyItem.is_active == True,
                VocabularyItem.content_version == lesson.content_version,
            )
            .order_by(VocabularyItem.sort_order)
        ).all()
    )

    return {
        "id": lesson.id,
        "language_code": lesson.language_code,
        "title": lesson.title,
        "description": lesson.description,
        "content_version": lesson.content_version,
        "sort_order": lesson.sort_order,
        "vocabulary_items": active_items,
    }
