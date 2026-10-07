"""Deterministic publication from declared import facts, never from current-row inference."""

import hashlib
import json
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.content.models import ContentRelease, Language, VocabularyRevision


def evidence_identity(kind: str, facts: dict[str, Any]) -> tuple[uuid.UUID, str]:
    canonical = json.dumps(
        facts, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    )
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return uuid.uuid5(uuid.NAMESPACE_URL, f"fluentt:{kind}:v1:{digest}"), digest


def publish_content_release(db: Session, data: dict[str, Any]) -> ContentRelease:
    language = data["language"]
    code = language["code"].strip().lower()
    version = data.get("content_version", "v0.1")
    manifest: dict[str, Any] = {
        "language": {
            "code": code,
            "name": language["name"].strip(),
            "is_active": language.get("is_active", True),
        },
        "content_version": version,
        "lessons": [],
    }
    seen_lessons: set[str] = set()
    seen_items: set[str] = set()
    for lesson in sorted(
        data.get("lessons", []), key=lambda row: str(uuid.UUID(str(row["id"])))
    ):
        lesson_id = str(uuid.UUID(str(lesson["id"])))
        if lesson_id in seen_lessons:
            raise ValueError("A release cannot contain duplicate lesson identities.")
        seen_lessons.add(lesson_id)
        lesson_version = lesson.get("content_version", version)
        context = {
            "id": lesson_id,
            "language_code": code,
            "title": lesson["title"],
            "description": lesson.get("description"),
            "content_version": lesson_version,
            "is_active": lesson.get("is_active", True),
            "sort_order": lesson.get("sort_order", 0),
            "vocabulary_items": [],
        }
        for item in sorted(
            lesson.get("vocabulary_items", []),
            key=lambda row: str(uuid.UUID(str(row["id"]))),
        ):
            item_id = str(uuid.UUID(str(item["id"])))
            if item_id in seen_items:
                raise ValueError(
                    "A release cannot contain duplicate vocabulary identities."
                )
            seen_items.add(item_id)
            facts = {
                "vocabulary_item_id": item_id,
                "lesson_id": lesson_id,
                "term": item["term"],
                "definition": item["definition"],
                "example_sentence": item["example_sentence"],
                "difficulty": item.get("difficulty", "beginner"),
                "category": item.get("category"),
                "translation": item.get("translation"),
                "content_version": item.get("content_version", lesson_version),
                "is_active": item.get("is_active", True),
                "sort_order": item.get("sort_order", 0),
            }
            revision_id, digest = evidence_identity("vocabulary-revision", facts)
            values = {
                **facts,
                "id": revision_id,
                "semantic_digest": digest,
                "vocabulary_item_id": uuid.UUID(item_id),
                "lesson_id": uuid.UUID(lesson_id),
            }
            db.execute(
                insert(VocabularyRevision)
                .values(**values)
                .on_conflict_do_nothing(index_elements=["id"])
            )
            context["vocabulary_items"].append(
                {"id": item_id, "content_revision_id": str(revision_id)}
            )
        manifest["lessons"].append(context)
    release_id, digest = evidence_identity("content-release", manifest)
    db.execute(
        insert(ContentRelease)
        .values(
            id=release_id,
            language_code=code,
            content_version=version,
            manifest=manifest,
            semantic_digest=digest,
        )
        .on_conflict_do_nothing(index_elements=["id"])
    )
    db.get(Language, code).current_content_release_id = release_id
    return db.get(ContentRelease, release_id)


def resolve_review_content(
    db: Session, item_id: uuid.UUID, revision_id: uuid.UUID, release_id: uuid.UUID
) -> VocabularyRevision:
    revision = db.get(VocabularyRevision, revision_id)
    release = db.get(ContentRelease, release_id)
    if not revision or not release or revision.vocabulary_item_id != item_id:
        raise HTTPException(
            status_code=400, detail="Unknown or inconsistent content provenance"
        )
    for lesson in release.manifest["lessons"]:
        membership = {"id": str(item_id), "content_revision_id": str(revision_id)}
        if (
            membership in lesson["vocabulary_items"]
            and str(revision.lesson_id) == lesson["id"]
            and release.manifest["language"]["is_active"]
            and lesson["is_active"]
            and revision.is_active
        ):
            return revision
    raise HTTPException(
        status_code=400,
        detail="Revision was not available in the supplied released context",
    )


def released_lesson(
    db: Session, release: ContentRelease, context: dict[str, Any]
) -> dict[str, Any]:
    items = []
    for member in context["vocabulary_items"]:
        revision = db.get(VocabularyRevision, uuid.UUID(member["content_revision_id"]))
        # Membership defines the released context; labels may have nested overrides.
        if revision.is_active:
            items.append(
                {
                    "id": revision.vocabulary_item_id,
                    "lesson_id": revision.lesson_id,
                    **{
                        field: getattr(revision, field)
                        for field in [
                            "term",
                            "definition",
                            "example_sentence",
                            "difficulty",
                            "category",
                            "translation",
                            "content_version",
                            "sort_order",
                            "is_active",
                        ]
                    },
                    "content_revision_id": revision.id,
                    "content_release_id": release.id,
                }
            )
    items.sort(key=lambda row: (row["sort_order"], str(row["id"])))
    return {
        **{key: value for key, value in context.items() if key != "vocabulary_items"},
        "content_release_id": release.id,
        "vocabulary_items": items,
        "item_count": len(items),
    }
