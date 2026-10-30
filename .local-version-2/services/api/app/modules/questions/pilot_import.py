"""Operator-only draft import; no provisioning, publication, or database reset."""
import argparse
import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings
from app.core.usernames import validate_new_username
from app.db.engine import build_engine
from app.db.session import session_factory
from app.models.assessments import Question, QuestionRevision, QuestionAnswerKey, QuestionCompetency
from app.models.curriculum import (CurriculumVersion, Subject, CurriculumGrade, CurriculumSubject,
                                   Quarter, CurriculumTopic, Lesson, LearningCompetency)
from app.models.operations import AuditLog
from app.models.users import User, AdminIdentity
from app.modules.administration.repository import AdminRepository
from app.modules.classrooms.repository import ClassroomRepository
from app.modules.questions.pilot_content import PACK, LESSONS, content_id, definitions


def pack_fingerprint():
    return hashlib.sha256(json.dumps(LESSONS, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def import_drafts(db, username):
    """Caller owns the transaction. All records commit together or none do."""
    canonical = validate_new_username(username)
    user = db.scalar(select(User).join(AdminIdentity, AdminIdentity.user_id == User.id)
                     .where(User.canonical_username == canonical).with_for_update(of=User))
    required = {"dashboard.view", "curriculum.read", "curriculum.write", "questions.read", "questions.write"}
    if (not user or user.role != "administrator" or user.profile_status != "active"
            or user.archived_at is not None or not required <= AdminRepository(db).permissions(user.id)):
        raise ValueError("Use an existing active content administrator with curriculum and question editor permissions.")
    db.execute(text("SELECT pg_advisory_xact_lock(78090001)"))
    # Validate the entire pack before writing anything.
    authored = {lesson["slug"]: list(definitions(lesson)) for lesson in LESSONS}
    existing = db.get(CurriculumVersion, content_id("version"))
    if existing:
        if existing.source_metadata.get("pack_fingerprint") != pack_fingerprint():
            raise ValueError("This pack has changed. Create a new pack version; existing content is never overwritten.")
        for lesson in LESSONS:
            if db.get(Lesson, content_id(lesson["slug"])) is None:
                raise ValueError("The prior import is incomplete. Review it before retrying.")
            for index, _ in enumerate(lesson["items"]):
                revision = db.get(QuestionRevision, content_id(f"{lesson['slug']}/revision/{index}"))
                if revision is None or db.get(QuestionAnswerKey, content_id(f"{lesson['slug']}/key/{index}")) is None:
                    raise ValueError("The prior import is incomplete. Review it before retrying.")
        return {"created": False, "lessons": 3, "questions": 37, "version_id": str(existing.id)}

    def add(model, key, **values):
        row = model(id=content_id(key), **values)
        db.add(row); db.flush()
        return row

    version = add(CurriculumVersion, "version", code=PACK, name="English Grammar Pilot",
                  description="Three original lessons for educator review.", status="draft",
                  source_metadata={"pack": PACK, "pack_fingerprint": pack_fingerprint(),
                                   "transcript_permission": "User confirmation, 2026-10-29",
                                   "audio_reuse": False, "transcripts_verified": False})
    subject = add(Subject, "subject", code="FLUENTT-ENGLISH-PILOT-V1", name="English Grammar Pilot")
    quarters = {}
    for grade in sorted({lesson["grade"] for lesson in LESSONS}):
        grade_id = ClassroomRepository(db).ensure_grade(grade)
        level = add(CurriculumGrade, f"grade/{grade}", curriculum_version_id=version.id, grade_level_id=grade_id)
        branch = add(CurriculumSubject, f"subject/{grade}", curriculum_grade_id=level.id, subject_id=subject.id)
        quarters[grade] = add(Quarter, f"quarter/{grade}", curriculum_subject_id=branch.id,
                              number=1, name="Grammar practice")
    for position, lesson in enumerate(LESSONS, 1):
        slug = lesson["slug"]
        topic = add(CurriculumTopic, slug + "/topic", quarter_id=quarters[lesson["grade"]].id,
                    name=lesson["topic"], position=position, status="draft")
        row = add(Lesson, slug, topic_id=topic.id, name=lesson["title"],
                  description=lesson["introduction"], position=1, status="draft",
                  source_metadata={"pack": PACK, "reference_url": lesson["source_url"],
                                   "reference_title": lesson["source_title"], "source_basis": "client summaries",
                                   "practice_feedback": "exact-practice-v1", "transcripts_verified": False,
                                   "audio_reuse": False,
                                   "practice_order": [str(content_id(f"{slug}/question/{index}")) for index in range(len(lesson["items"]))]})
        competency = add(LearningCompetency, slug + "/competency", lesson_id=row.id,
                         description=lesson["competency"], position=1)
        for index, definition in enumerate(authored[slug]):
            item = add(Question, f"{slug}/question/{index}", author_id=user.id, status="draft")
            data = definition.model_dump(exclude={"answer_key", "explanation", "competency_ids", "grading_version"})
            data["content"] = definition.content.model_dump()
            revision = add(QuestionRevision, f"{slug}/revision/{index}", question_id=item.id, version=1, **data)
            add(QuestionAnswerKey, f"{slug}/key/{index}", question_revision_id=revision.id,
                configuration=definition.answer_key.model_dump(), grading_version="ungraded-v1",
                explanation=definition.explanation)
            add(QuestionCompetency, f"{slug}/link/{index}", question_revision_id=revision.id, competency_id=competency.id)
    db.add(AuditLog(actor_id=user.id, action="content.pilot_drafts_imported", entity_type="curriculum_versions",
                    entity_id=version.id, occurred_at=datetime.now(timezone.utc),
                    safe_metadata={"pack": PACK, "lessons": 3, "questions": 37}))
    db.flush()
    return {"created": True, "lessons": 3, "questions": 37, "version_id": str(version.id)}


def main():
    parser = argparse.ArgumentParser(description="Validate the English pilot; optionally import drafts as an operator.")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--administrator")
    args = parser.parse_args()
    try:
        count = sum(len(list(definitions(lesson))) for lesson in LESSONS)
        if not args.apply:
            print(json.dumps({"pack": PACK, "lessons": len(LESSONS), "questions": count, "database_writes": False}))
            return 0
        if not args.administrator:
            raise ValueError("--apply requires --administrator with an existing editor account.")
        engine = build_engine(Settings())
        if engine is None:
            raise ValueError("Configure the local PostgreSQL connection first.")
        try:
            with session_factory(engine)() as db, db.begin():
                result = import_drafts(db, args.administrator)
            print(json.dumps(result))
        finally:
            engine.dispose()
        return 0
    except ValueError as error:
        print(str(error))
        return 2
    except SQLAlchemyError:
        print("Draft import failed and rolled back. Check database migrations and connectivity.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
