"""Import original, explicitly selected lesson packs as administrator-owned drafts only."""
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
from app.models.curriculum import CurriculumVersion, Subject, CurriculumGrade, CurriculumSubject, Quarter, CurriculumTopic, Lesson, LearningCompetency
from app.models.operations import AuditLog
from app.models.users import User, AdminIdentity
from app.modules.administration.repository import AdminRepository
from app.modules.classrooms.repository import ClassroomRepository
from app.modules.questions import school_clubs_content


def import_drafts(db, username, content=school_clubs_content):
    PACK, LESSONS, content_id, definitions = content.PACK, content.LESSONS, content.content_id, content.definitions
    grammar = PACK == "fluentt-grammar-followup-v1"
    phonics = PACK == "fluentt-first-letters-v1"
    school = PACK == "fluentt-school-food-homes-v1"
    source_basis = getattr(content, "SOURCE_BASIS", "user-supplied video-topic summaries; original Fluentt explanations and activities" if grammar else "SRC-03 accessible description and contents; independently selected examples" if phonics else "user-supplied SRC-05 chapter notes; independently authored lessons" if school else "user-supplied screenshots; original Fluentt explanations and activities")
    canonical = validate_new_username(username)
    user = db.scalar(select(User).join(AdminIdentity, AdminIdentity.user_id == User.id).where(User.canonical_username == canonical).with_for_update(of=User))
    required = {"dashboard.view", "curriculum.read", "curriculum.write", "questions.read", "questions.write"}
    if not user or user.role != "administrator" or user.profile_status != "active" or user.archived_at or not required <= AdminRepository(db).permissions(user.id):
        raise ValueError("Use an existing active content administrator with curriculum and question editor permissions.")
    db.execute(text("SELECT pg_advisory_xact_lock(78090001)"))
    authored = {lesson["slug"]: list(definitions(lesson)) for lesson in LESSONS}
    fingerprint = hashlib.sha256(json.dumps(LESSONS, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    existing = db.get(CurriculumVersion, content_id("version"))
    count = sum(len(lesson["items"]) for lesson in LESSONS)
    if existing:
        if existing.source_metadata.get("pack_fingerprint") != fingerprint:
            raise ValueError("This pack has changed. Create a new version; existing content is never overwritten.")
        for lesson in LESSONS:
            if db.get(Lesson, content_id(lesson["slug"])) is None:
                raise ValueError("The prior import is incomplete and requires review.")
            for index, _ in enumerate(lesson["items"]):
                if db.get(QuestionRevision, content_id(f"{lesson['slug']}/revision/{index}")) is None or db.get(QuestionAnswerKey, content_id(f"{lesson['slug']}/key/{index}")) is None:
                    raise ValueError("The prior import is incomplete and requires review.")
        return {"created": False, "lessons": len(LESSONS), "questions": count, "version_id": str(existing.id)}

    def add(model, key, **values):
        row = model(id=content_id(key), **values)
        db.add(row)
        db.flush()
        return row

    version = add(CurriculumVersion, "version", code=PACK,
                  name=getattr(content, "EDITION_NAME", "English: Grammar Follow-up" if grammar else "English: First Letters" if phonics else "English: School, Food and Homes" if school else "English: Clubs and Future Ideas"),
                  description=getattr(content, "EDITION_DESCRIPTION", "Original Grade 7 grammar lessons." if grammar else "Original Grade 1 printed-letter lessons." if phonics else "Original Grade 2 lessons about school, food and homes." if school else "Original Grade 4 lessons about interests, reading, jobs and plans."), status="draft",
                  source_metadata={"pack": PACK, "pack_fingerprint": fingerprint, "source_id": getattr(content, "SOURCE_ID", "VID-04–VID-07" if grammar else "SRC-03" if phonics else "SRC-05" if school else "SRC-02"),
                                   "source_basis": source_basis,
                                   "permission_statement": getattr(content, "PERMISSION_STATEMENT", "User-supplied references; transcript permission confirmed 2026-10-29" if grammar else "User-supplied source; permission confirmed 2026-10-29" if phonics or school else "User-supplied references, permission confirmed 2026-10-29 and screenshots supplied 2026-11-01"),
                                   "transcripts_verified": False,
                                   "source_text_copied": False, "source_images_used": False, "audio_reuse": False})
    subject_code = "FLUENTT-ENGLISH-PILOT-V1" if grammar else "FLUENTT-ENGLISH"
    subject = db.scalar(select(Subject).where(Subject.code == subject_code).with_for_update())
    if not subject:
        subject = add(Subject, "subject", code=subject_code, name="English Grammar Pilot" if grammar else "English", description="English language learning.")
    grades = {lesson["grade"] for lesson in LESSONS}
    if len(grades) != 1:
        raise ValueError("This importer requires a single grade per pack.")
    grade = next(iter(grades))
    grade_id = ClassroomRepository(db).ensure_grade(grade)
    level = add(CurriculumGrade, f"grade/{grade}", curriculum_version_id=version.id, grade_level_id=grade_id)
    branch = add(CurriculumSubject, f"subject/{grade}", curriculum_grade_id=level.id, subject_id=subject.id)
    quarter = add(Quarter, f"quarter/{grade}", curriculum_subject_id=branch.id, number=1,
                  name=getattr(content, "QUARTER_NAME", "Grammar and agreement" if grammar else "First letters" if phonics else "School, food and homes" if school else "Clubs, interests and future ideas"))
    for position, lesson in enumerate(LESSONS, 1):
        slug = lesson["slug"]
        topic = add(CurriculumTopic, slug + "/topic", quarter_id=quarter.id, name=lesson["topic"], position=position, status="draft")
        leaf = add(Lesson, slug, topic_id=topic.id, name=lesson["title"], description=lesson["introduction"], position=1, status="draft",
                   source_metadata={"pack": PACK, "source_id": lesson.get("source_id", "SRC-02"), "reference_url": lesson.get("source_url", getattr(content, "SOURCE", "")),
                                    "source_basis": source_basis, "transcripts_verified": False,
                                    "source_text_copied": False, "audio_reuse": False,
                                    "materials": [{"title": lesson["title"], "resource_type": "reading", "description": lesson["introduction"], "content_text": lesson["reading"], "is_required": False}],
                                    "practice_order": [str(content_id(f"{slug}/question/{i}")) for i in range(len(lesson["items"]))]})
        competency = add(LearningCompetency, slug + "/competency", lesson_id=leaf.id, description=lesson["competency"], position=1)
        for index, definition in enumerate(authored[slug]):
            item = add(Question, f"{slug}/question/{index}", author_id=user.id, status="draft")
            data = definition.model_dump(exclude={"answer_key", "explanation", "competency_ids", "grading_version"})
            data["content"] = definition.content.model_dump()
            revision = add(QuestionRevision, f"{slug}/revision/{index}", question_id=item.id, version=1, **data)
            add(QuestionAnswerKey, f"{slug}/key/{index}", question_revision_id=revision.id, configuration=definition.answer_key.model_dump(), grading_version="ungraded-v1", explanation=definition.explanation)
            add(QuestionCompetency, f"{slug}/link/{index}", question_revision_id=revision.id, competency_id=competency.id)
    db.add(AuditLog(actor_id=user.id, action="content.original_lessons_drafts_imported", entity_type="curriculum_versions", entity_id=version.id,
                    occurred_at=datetime.now(timezone.utc), safe_metadata={"pack": PACK, "lessons": len(LESSONS), "questions": count}))
    db.flush()
    return {"created": True, "lessons": len(LESSONS), "questions": count, "version_id": str(version.id)}


def main():
    parser = argparse.ArgumentParser(description="Import an original lesson pack as administrator drafts.")
    parser.add_argument("--administrator", required=True)
    parser.add_argument("--pack", choices=["school-clubs", "grammar-followup", "first-letters", "school-food-homes", "everyday-english", "reading-skills"], default="school-clubs")
    args = parser.parse_args()
    if args.pack == "grammar-followup":
        from app.modules.questions import grammar_followup_content as content
    elif args.pack == "first-letters":
        from app.modules.questions import first_letters_content as content
    elif args.pack == "school-food-homes":
        from app.modules.questions import school_food_homes_content as content
    elif args.pack == "everyday-english":
        from app.modules.questions import everyday_english_content as content
    elif args.pack == "reading-skills":
        from app.modules.questions import reading_skills_content as content
    else:
        content = school_clubs_content
    engine = build_engine(Settings())
    if engine is None:
        raise SystemExit("Configure the local PostgreSQL connection first.")
    try:
        with session_factory(engine)() as db, db.begin():
            result = import_drafts(db, args.administrator, content)
        print(json.dumps(result))
    except ValueError as error:
        print(str(error))
        return 2
    except SQLAlchemyError:
        print("Draft import failed and rolled back. Check the local database and migrations.")
        return 1
    finally:
        engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
