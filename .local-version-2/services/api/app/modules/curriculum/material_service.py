"""Authorized learning materials extraction from published lesson metadata."""

from datetime import datetime, timezone
from uuid import UUID, uuid5, NAMESPACE_URL
from sqlalchemy import select, and_
from app.models.curriculum import Lesson
from app.modules.curriculum.repository import visible, unavailable
from app.modules.curriculum.material_schemas import MaterialView, MaterialPage
from app.modules.identity.errors import IdentityError


def get_lesson_materials(db, lesson_id: UUID) -> MaterialPage:
    now = datetime.now(timezone.utc)
    lesson = db.scalar(
        select(Lesson).where(
            Lesson.id == lesson_id,
            *visible(5),
        )
    )
    if not lesson:
        raise IdentityError(404, "lesson_not_found", "Published lesson is unavailable.")

    # Materials can be authored under lesson.source_metadata["materials"]
    raw_materials = lesson.source_metadata.get("materials", []) if isinstance(lesson.source_metadata, dict) else []

    items: list[MaterialView] = []
    for idx, mat in enumerate(raw_materials):
        if not isinstance(mat, dict):
            continue
        title = mat.get("title", f"Material {idx + 1}")
        res_type = mat.get("resource_type", "reading")
        if res_type not in ["reading", "reference_guide", "vocabulary_list", "activity_sheet", "audio_transcript"]:
            res_type = "reading"
        
        # Derive stable deterministic UUID from lesson_id and index
        mat_id = uuid5(NAMESPACE_URL, f"fluentt://lessons/{lesson_id}/materials/{idx}")
        
        items.append(
            MaterialView(
                id=mat_id,
                lesson_id=lesson.id,
                title=title,
                description=mat.get("description"),
                resource_type=res_type,
                content_text=mat.get("content_text"),
                reference_url=mat.get("reference_url"),
                media_url=mat.get("media_url"),
                is_required=bool(mat.get("is_required", False)),
                source_metadata=mat.get("metadata", {}),
            )
        )

    # If no specific materials list was authored in metadata, provide the foundational lesson reading guide
    if not items:
        default_id = uuid5(NAMESPACE_URL, f"fluentt://lessons/{lesson_id}/materials/default")
        items.append(
            MaterialView(
                id=default_id,
                lesson_id=lesson.id,
                title=f"Study Guide: {lesson.name}",
                description=lesson.description or "Official curriculum learning material and study notes.",
                resource_type="reading",
                content_text=lesson.description or "Review and study this lesson as part of your curriculum pathway.",
                reference_url=None,
                media_url=None,
                is_required=True,
                source_metadata={"curriculum_status": lesson.status},
            )
        )

    return MaterialPage(
        items=items,
        lesson_id=lesson.id,
        lesson_name=lesson.name,
        total_count=len(items),
        as_of=now,
    )
