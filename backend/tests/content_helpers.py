"""Publish the declared content in existing review fixtures through the real importer."""

from sqlalchemy import select

from app.content.models import ContentRelease, Language, Lesson, VocabularyItem
from app.content.service import import_content_data


def publish_fixture_item(db, item: VocabularyItem) -> None:
    lesson = db.get(Lesson, item.lesson_id)
    language = db.get(Language, lesson.language_code)
    data = {
        "language": {
            "code": language.code,
            "name": language.name,
            "is_active": language.is_active,
        },
        "content_version": lesson.content_version,
        "lessons": [],
    }
    for current_lesson in db.scalars(
        select(Lesson).where(Lesson.language_code == language.code)
    ):
        context = {
            field: getattr(current_lesson, field)
            for field in [
                "title",
                "description",
                "content_version",
                "is_active",
                "sort_order",
            ]
        }
        context["id"] = str(current_lesson.id)
        context["vocabulary_items"] = []
        for current_item in db.scalars(
            select(VocabularyItem).where(VocabularyItem.lesson_id == current_lesson.id)
        ):
            facts = {
                field: getattr(current_item, field)
                for field in [
                    "term",
                    "definition",
                    "example_sentence",
                    "difficulty",
                    "category",
                    "translation",
                    "content_version",
                    "is_active",
                    "sort_order",
                ]
            }
            facts["id"] = str(current_item.id)
            context["vocabulary_items"].append(facts)
        data["lessons"].append(context)
    import_content_data(db, data)
    release = db.get(ContentRelease, language.current_content_release_id)
    for context in release.manifest["lessons"]:
        for member in context["vocabulary_items"]:
            if member["id"] == str(item.id):
                item._test_provenance_refs = {
                    "content_revision_id": member["content_revision_id"],
                    "content_release_id": str(release.id),
                }
                return
    raise AssertionError("Fixture item was not published")


def provenance_refs(item: VocabularyItem) -> dict[str, str]:
    return item._test_provenance_refs
