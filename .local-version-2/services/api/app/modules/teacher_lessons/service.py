"""Live owner authorization, versioned authoring and explicit class distribution."""
import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select, func, text
from sqlalchemy.exc import DBAPIError
from app.models.teacher_lessons import TeacherLesson, TeacherLessonVersion, TeacherLessonQuestion, TeacherLessonShare, TeacherLessonMutation
from app.models.curriculum import Lesson, GradeLevel, Subject
from app.models.assessments import Question, QuestionRevision, QuestionAnswerKey, Assignment, AssignmentVersion
from app.models.users import Classroom
from app.models.operations import AuditLog
from app.modules.identity.session_service import authenticated_session
from app.modules.identity.errors import IdentityError
from app.modules.classrooms.service import require_instructor
from app.modules.curriculum.repository import CurriculumRepository
from app.modules.teacher_lessons.source import active_shares, context_for_version
from app.modules.teacher_lessons.schemas import LessonInput


def fail(status=409, message="This lesson changed. Reload it before trying again."):
    return IdentityError(status, "teacher_lesson_conflict" if status == 409 else "teacher_lesson_unavailable", message)


def token(root):
    return hashlib.sha256(f"{root.id}:{root.revision}".encode()).hexdigest()


def owned(db, user, root_id):
    root = db.scalar(select(TeacherLesson).where(TeacherLesson.id == root_id, TeacherLesson.instructor_id == user.id).with_for_update().execution_options(populate_existing=True))
    if not root:
        raise fail(404, "Lesson not found in your library.")
    return root


def versions(db, root):
    return list(db.scalars(select(TeacherLessonVersion).where(TeacherLessonVersion.teacher_lesson_id == root.id).order_by(TeacherLessonVersion.version.desc()).execution_options(populate_existing=True)))


def question_rows(db, version):
    return list(db.scalars(select(QuestionRevision).join(TeacherLessonQuestion, TeacherLessonQuestion.question_revision_id == QuestionRevision.id).where(TeacherLessonQuestion.version_id == version.id).order_by(TeacherLessonQuestion.position)))


def author_question(db, row):
    key = db.scalar(select(QuestionAnswerKey).where(QuestionAnswerKey.question_revision_id == row.id))
    if key is None:
        raise fail(409, "This question needs review before it can be edited.")
    return dict(method=row.method, prompt=row.prompt, instructions=row.instructions, difficulty=row.difficulty,
                content=row.content, answer_key=key.configuration)


def brief(db, root, version):
    leaf = db.get(Lesson, version.lesson_id, populate_existing=True)
    context = context_for_version(db, version, leaf)
    return dict(id=str(root.id), version_id=str(version.id), lesson_id=str(leaf.id), version=version.version,
                title=leaf.name, introduction=leaf.description, grade=context.grade, subject_id=str(version.subject_id),
                subject_name=context.subject_name, language=version.language, revision=token(root),
                status="archived" if root.archived_at else "published" if version.published_at else "draft",
                published_at=version.published_at.isoformat() if version.published_at else None,
                question_count=db.scalar(select(func.count()).select_from(TeacherLessonQuestion).where(TeacherLessonQuestion.version_id == version.id)))


def describe(db, root, version):
    result = brief(db, root, version)
    shares = active_shares()
    result.update(sections=version.sections, questions=[author_question(db, row) for row in question_rows(db, version)],
                  versions=[brief(db, root, row) for row in versions(db, root)],
                  shares=[dict(class_id=str(row.class_id), class_name=row.class_name, version_id=str(row.version_id)) for row in db.execute(
                      select(shares.c.class_id, Classroom.class_name, shares.c.version_id).join(Classroom, Classroom.id == shares.c.class_id).where(shares.c.teacher_lesson_id == root.id).order_by(Classroom.class_name, Classroom.id))])
    return result


def set_questions(db, user, root, version, definitions):
    # Only unlocked, unpublished drafts reach this function. Published evidence is never replaced.
    for row in question_rows(db, version):
        link = db.scalar(select(TeacherLessonQuestion).where(TeacherLessonQuestion.question_revision_id == row.id))
        key = db.scalar(select(QuestionAnswerKey).where(QuestionAnswerKey.question_revision_id == row.id))
        item = db.get(Question, row.question_id)
        db.delete(link)
        if key:
            db.delete(key)
        db.flush()
        db.delete(row)
        db.flush()
        db.delete(item)
    db.flush()
    for position, definition in enumerate(definitions, 1):
        item = Question(author_id=user.id, teacher_lesson_id=root.id, status="draft")
        db.add(item)
        db.flush()
        row = QuestionRevision(question_id=item.id, lesson_id=version.lesson_id, version=1, method=definition.method,
                               language=version.language, prompt=definition.prompt, instructions=definition.instructions,
                               difficulty=definition.difficulty, points=Decimal("1"), schema_version=1, content=definition.content)
        db.add(row)
        db.flush()
        db.add(QuestionAnswerKey(question_revision_id=row.id, configuration=definition.answer_key, grading_version="ungraded-v1"))
        db.add(TeacherLessonQuestion(version_id=version.id, question_revision_id=row.id, position=position))
        db.flush()


def write_draft(db, repo, user, root, payload, version=None):
    if db.get(Subject, payload.subject_id, populate_existing=True) is None:
        raise fail(422, "Choose an available subject.")
    grade_id = repo.ensure_grade(payload.grade)
    if version is None:
        leaf = Lesson(topic_id=None, teacher_owned=True, name=payload.title, description=payload.introduction,
                      position=1, status="draft", source_metadata={})
        db.add(leaf)
        db.flush()
        number = (db.scalar(select(func.max(TeacherLessonVersion.version)).where(TeacherLessonVersion.teacher_lesson_id == root.id)) or 0) + 1
        version = TeacherLessonVersion(teacher_lesson_id=root.id, lesson_id=leaf.id, version=number,
                                      grade_level_id=grade_id, subject_id=payload.subject_id, language=payload.language,
                                      sections=[row.model_dump() for row in payload.sections])
        db.add(version)
    else:
        if version.published_at:
            raise fail(409, "Published lessons stay unchanged. Create a new version to make corrections.")
        leaf = db.get(Lesson, version.lesson_id)
        leaf.name, leaf.description = payload.title, payload.introduction
        version.grade_level_id, version.subject_id, version.language = grade_id, payload.subject_id, payload.language
        version.sections = [row.model_dump() for row in payload.sections]
    db.flush()
    set_questions(db, user, root, version, payload.questions)
    return version


def bind_subject(db, classroom, subject_id, confirmed):
    if classroom.subject_id is not None:
        if classroom.subject_id != subject_id:
            raise fail(422, "This lesson does not match the class subject.")
        return
    if not confirmed:
        raise fail(422, "Confirm this subject as the class subject before sharing.")
    from app.modules.assignments.service import lesson_path, context_for
    from app.models.learning import LearnerProgress, LearningContext
    ids = set(db.scalars(select(AssignmentVersion.lesson_id).join(Assignment).where(Assignment.class_id == classroom.id)))
    ids.update(db.scalars(select(LearnerProgress.lesson_id).join(LearningContext).where(LearningContext.class_id == classroom.id)))
    for lesson_id in ids:
        path = lesson_path(db, classroom, lesson_id, False)
        if path is None or context_for(path).subject_id != subject_id:
            raise fail(409, "Retained class content has a different or unavailable subject. Review the class first.")
    shares = active_shares()
    if db.scalar(select(TeacherLessonVersion.id).join(shares, shares.c.version_id == TeacherLessonVersion.id).where(
            shares.c.class_id == classroom.id, TeacherLessonVersion.subject_id != subject_id).limit(1)):
        raise fail(409, "Another shared lesson has a different subject. Review the class first.")
    classroom.subject_id = subject_id


def mutate(repo, credential, settings, *, root_id=None, payload, request_key, expected=None, request_id=None):
    db = repo.session
    try:
        with authenticated_session(repo, credential, settings) as (_, user):
            require_instructor(user)
            digest = hashlib.sha256(json.dumps(dict(root=str(root_id), body=payload.model_dump(mode="json")), sort_keys=True).encode()).hexdigest()
            replay = db.scalar(select(TeacherLessonMutation).where(TeacherLessonMutation.instructor_id == user.id, TeacherLessonMutation.request_id == request_key))
            if replay:
                if replay.fingerprint != digest:
                    raise fail(409, "This request was already used with different details. Reload before trying again.")
                return replay.response
            classrooms = []
            if root_id and payload.action in {"share", "unshare"}:
                for class_id in sorted(payload.class_ids, key=str):
                    classroom = repo.owned(user.id, class_id)
                    if not classroom:
                        raise fail(404, "One of these classes is unavailable.")
                    db.refresh(classroom)
                    classrooms.append(classroom)
            db.execute(text("SELECT pg_advisory_xact_lock(78090001)"))
            now = datetime.now(timezone.utc)
            if root_id is None:
                root = TeacherLesson(instructor_id=user.id)
                db.add(root)
                db.flush()
                version = write_draft(db, repo, user, root, payload)
                action = "create"
            else:
                root = owned(db, user, root_id)
                if not expected:
                    raise fail(428, "Reload the lesson before changing it.")
                if expected.strip('"') != token(root):
                    raise fail()
                version = db.scalar(select(TeacherLessonVersion).where(TeacherLessonVersion.id == payload.version_id, TeacherLessonVersion.teacher_lesson_id == root.id).with_for_update().execution_options(populate_existing=True))
                if version is None:
                    raise fail(404, "Lesson version not found.")
                action = payload.action
                if root.archived_at and action not in {"unshare"}:
                    raise fail(409, "Archived lessons cannot be edited, published, or shared with new classes.")
                if action == "save":
                    version = write_draft(db, repo, user, root, payload.draft, version)
                elif action == "new_version":
                    if not version.published_at:
                        raise fail(409, "Continue editing this draft instead.")
                    if any(row.published_at is None for row in versions(db, root)):
                        raise fail(409, "This lesson already has a draft. Open it before making another version.")
                    leaf = db.get(Lesson, version.lesson_id)
                    data = LessonInput(title=leaf.name, introduction=leaf.description, grade=db.get(GradeLevel, version.grade_level_id).number,
                                       language=version.language, subject_id=version.subject_id, sections=version.sections,
                                       questions=[author_question(db, row) for row in question_rows(db, version)])
                    version = write_draft(db, repo, user, root, data)
                elif action == "publish":
                    if version.published_at:
                        raise fail(409, "This version is already published.")
                    rows = question_rows(db, version)
                    if not version.sections and not rows:
                        raise fail(422, "Add reading content or at least one valid question before publishing.")
                    for row in rows:
                        author_question(db, row)  # Refuse incomplete private evidence before freezing.
                        row.locked_at = now
                        db.get(Question, row.question_id).status = "published"
                    db.get(Lesson, version.lesson_id).status = "published"
                    db.flush()
                    version.published_at = now
                elif action == "archive":
                    root.archived_at = now
                elif action in {"share", "unshare"}:
                    if not version.published_at:
                        raise fail(422, "Publish this version before sharing it.")
                    for classroom in classrooms:
                        if action == "share":
                            if classroom.status != "active" or classroom.archived_at or classroom.grade_level_id != version.grade_level_id or classroom.language != version.language:
                                raise fail(422, "Share only with active classes with the same grade and learning language.")
                            bind_subject(db, classroom, version.subject_id, payload.bind_subject)
                        latest = db.scalar(select(TeacherLessonShare).where(TeacherLessonShare.teacher_lesson_id == root.id, TeacherLessonShare.class_id == classroom.id).order_by(TeacherLessonShare.ordinal.desc()).limit(1))
                        if action == "unshare" and (latest is None or not latest.active):
                            continue
                        target_id = version.id if action == "share" else latest.version_id
                        db.add(TeacherLessonShare(teacher_lesson_id=root.id, class_id=classroom.id, version_id=target_id,
                                                 ordinal=(latest.ordinal if latest else 0) + 1, active=action == "share", request_id=request_key))
                root.revision += 1
            db.flush()
            result = describe(db, root, version)
            db.add(TeacherLessonMutation(instructor_id=user.id, request_id=request_key, fingerprint=digest, response=result))
            db.add(AuditLog(actor_id=user.id, action=f"teacher_lessons.{action}", entity_type="teacher_lesson", entity_id=root.id,
                            occurred_at=now, request_id=request_id, safe_metadata={"version_id": str(version.id), "class_ids": [str(row.id) for row in classrooms]}))
            db.flush()
            return result
    except DBAPIError as exc:
        if getattr(exc.orig, "sqlstate", None) in {"23514", "23505", "23503", "40P01", "55P03", "40001"}:
            raise fail(409, "This lesson or class changed. Reload and review before retrying.") from exc
        raise


def read(repo, credential, settings, *, root_id=None, version_id=None, class_id=None, offset=0, limit=20, options=False, subjects=False):
    db = repo.session
    with authenticated_session(repo, credential, settings) as (_, user):
        require_instructor(user)
        if class_id:
            CurriculumRepository(db).class_context(user, class_id)
        db.execute(text("SELECT pg_advisory_xact_lock_shared(78090001)"))
        if subjects:
            return [dict(id=str(row.id), name=row.name) for row in db.scalars(select(Subject).order_by(Subject.name, Subject.id))]
        if root_id:
            # Actor/session exclusive lock serializes owner writes; keep read lock shared globally.
            root = db.scalar(select(TeacherLesson).where(TeacherLesson.id == root_id, TeacherLesson.instructor_id == user.id).execution_options(populate_existing=True))
            if not root:
                raise fail(404, "Lesson not found in your library.")
            rows = versions(db, root)
            version = next((row for row in rows if row.id == version_id), None) if version_id else next(iter(rows), None)
            if version is None:
                raise fail(404, "Lesson version is unavailable.")
            if options:
                rows = list(db.scalars(select(Classroom).where(Classroom.instructor_id == user.id).order_by(Classroom.created_at.desc(), Classroom.id).offset(offset).limit(limit + 1)))
                shares = active_shares()
                current = {row.class_id: str(row.version_id) for row in db.execute(select(shares).where(shares.c.teacher_lesson_id == root.id))}
                items = []
                for row in rows[:limit]:
                    eligible = row.status == "active" and row.archived_at is None and row.grade_level_id == version.grade_level_id and row.language == version.language and row.subject_id in {None, version.subject_id}
                    items.append(dict(id=str(row.id), name=row.class_name, grade=db.get(GradeLevel, row.grade_level_id).number,
                                      language=row.language, eligible=eligible, needs_binding=row.subject_id is None,
                                      shared_version_id=current.get(row.id), reason=None if eligible else "Requires an active class with the same grade, language, and subject."))
                return dict(items=items, has_more=len(rows) > limit, offset=offset, limit=limit)
            return describe(db, root, version)
        query = select(TeacherLesson).where(TeacherLesson.instructor_id == user.id)
        if class_id:
            shares = active_shares()
            query = query.join(shares, shares.c.teacher_lesson_id == TeacherLesson.id).where(shares.c.class_id == class_id)
        roots = list(db.scalars(query.order_by(TeacherLesson.created_at.desc(), TeacherLesson.id).offset(offset).limit(limit + 1)))
        items = []
        for root in roots[:limit]:
            selected = versions(db, root)[0]
            if class_id:
                share = db.execute(select(shares).where(shares.c.teacher_lesson_id == root.id, shares.c.class_id == class_id)).one()
                selected = db.get(TeacherLessonVersion, share.version_id)
            items.append(brief(db, root, selected))
        return dict(items=items, has_more=len(roots) > limit, offset=offset, limit=limit)


def student_read(repo, credential, settings, class_id, *, lesson_id=None, offset=0, limit=20):
    from app.modules.assignments.publication import student_context
    db = repo.session
    with student_context(repo, credential, settings, class_id=class_id) as (_, _, classroom):
        shares = active_shares()
        statement = select(TeacherLessonVersion, TeacherLesson, Lesson).join(TeacherLesson, TeacherLesson.id == TeacherLessonVersion.teacher_lesson_id).join(
            Lesson, Lesson.id == TeacherLessonVersion.lesson_id).join(shares, shares.c.version_id == TeacherLessonVersion.id).where(
            shares.c.class_id == classroom.id, TeacherLesson.instructor_id == classroom.instructor_id,
            TeacherLessonVersion.published_at.is_not(None))
        if lesson_id:
            statement = statement.where(TeacherLessonVersion.lesson_id == lesson_id)
        rows = db.execute(statement.order_by(shares.c.created_at.desc(), TeacherLessonVersion.id).offset(offset).limit(limit + 1)).all()
        if lesson_id and not rows:
            raise fail(404, "This lesson is no longer shared with your class.")
        items = []
        for version, root, leaf in rows[:limit]:
            # Deliberate projection: never serialize question definitions/private keys to this reader.
            from app.models.users import User
            items.append(dict(lesson_id=str(leaf.id), title=leaf.name, introduction=leaf.description,
                              context=context_for_version(db, version, leaf).model_dump(mode="json"), version=version.version,
                              published_at=version.published_at.isoformat(), instructor=db.get(User, classroom.instructor_id).username,
                              sections=version.sections if lesson_id else None, class_id=str(classroom.id)))
        return items[0] if lesson_id else dict(items=items, has_more=len(rows) > limit, offset=offset, limit=limit)
