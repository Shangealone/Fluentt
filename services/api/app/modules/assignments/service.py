"""Authenticate, lock class, coordinate content, then read/write the owned draft atomically."""

import hashlib
import json
from datetime import datetime, timezone
from sqlalchemy import select, text, func
from sqlalchemy.exc import DBAPIError
from app.models.assessments import Assignment, AssignmentVersion, AssignmentQuestion, Question, QuestionRevision
from app.models.curriculum import Lesson, CurriculumGrade, CurriculumSubject, CurriculumVersion, GradeLevel, Subject
from app.models.operations import AuditLog
from app.modules.classrooms.repository import ClassroomRepository
from app.modules.classrooms.service import require_instructor
from app.modules.curriculum.repository import path_statement, visible
from app.modules.identity.errors import IdentityError
from app.modules.identity.session_service import authenticated_session
from app.modules.questions.schemas import PUBLIC_MODELS
from app.modules.assignments.schemas import Context, DraftView, DraftSummary, Item, Page


def fail(status=409, message="This draft or its content changed. Reload before trying again."):
    return IdentityError(status, "assignment_conflict" if status == 409 else "assignment_unavailable", message)


def lesson_path(db, classroom, lesson_id, current=True):
    statement = path_statement(5).where(Lesson.id == lesson_id)
    if current:
        statement = statement.where(*visible(5), CurriculumGrade.grade_level_id == classroom.grade_level_id)
        if classroom.subject_id is not None:
            statement = statement.where(CurriculumSubject.subject_id == classroom.subject_id)
    return db.execute(statement.execution_options(populate_existing=True)).first()


def context_for(path):
    m = path._mapping
    return Context(
        lesson_id=m[Lesson].id,
        lesson_name=m[Lesson].name,
        curriculum_version_id=m[CurriculumVersion].id,
        curriculum_name=m[CurriculumVersion].name,
        grade=m[GradeLevel].number,
        subject_id=m[Subject].id,
        subject_name=m[Subject].name,
    )


def eligible(db, classroom, row):
    item = db.get(Question, row.question_id, populate_existing=True)
    return bool(
        row.locked_at
        and row.language == classroom.language
        and item
        and item.status == "published"
        and item.archived_at is None
        and lesson_path(db, classroom, row.lesson_id)
    )


def public_item(db, classroom, row):
    # Never load the answer-key table. Only locked pinned revisions can be previewed here.
    if row.locked_at is None:
        raise fail(409, "A legacy draft references unlocked content; operator review is required.")
    data = {field: getattr(row, field) for field in PUBLIC_MODELS[row.method].model_fields}
    return Item(
        id=row.id,
        question_id=row.question_id,
        version=row.version,
        definition=data,
        eligible=eligible(db, classroom, row),
    )


def versions(db, item):
    return list(
        db.scalars(
            select(AssignmentVersion)
            .where(AssignmentVersion.assignment_id == item.id)
            .order_by(AssignmentVersion.version.desc())
            .execution_options(populate_existing=True)
        )
    )


def children(db, version):
    return list(
        db.scalars(
            select(AssignmentQuestion)
            .where(AssignmentQuestion.assignment_version_id == version.id)
            .order_by(AssignmentQuestion.position)
            .execution_options(populate_existing=True)
        )
    )


def fingerprint(db, item):
    state = [(str(item.id), str(item.updated_at), item.status)]
    for version in versions(db, item):
        state.append((str(version.id), str(version.updated_at)))
        state.extend((str(row.id), str(row.updated_at)) for row in children(db, version))
    return hashlib.sha256(json.dumps(state).encode()).hexdigest()


def describe(db, classroom, item):
    rows = versions(db, item)
    if not rows:
        raise fail(409, "A legacy draft has no version; operator review is required.")
    version = rows[0]
    path = lesson_path(db, classroom, version.lesson_id, False)
    if path is None:
        raise fail()
    context = version.curriculum_snapshot.get("context") or context_for(path).model_dump(mode="json")
    questions = [
        public_item(db, classroom, db.get(QuestionRevision, child.question_revision_id, populate_existing=True))
        for child in children(db, version)
    ]
    valid = bool(lesson_path(db, classroom, version.lesson_id)) and all(row.eligible for row in questions)
    return DraftView(
        id=item.id,
        class_id=classroom.id,
        version_id=version.id,
        status=item.status,
        revision=fingerprint(db, item),
        title=version.title,
        instructions=version.instructions,
        context=context,
        questions=questions,
        eligible=valid,
        editable=item.status == "draft"
        and classroom.status == "active"
        and classroom.archived_at is None
        and not any(row.locked_at for row in rows),
        requires_subject=classroom.subject_id is None,
    )


def summary(db, classroom, item):
    rows = versions(db, item)
    if not rows:
        raise fail(409, "A legacy draft has no version; operator review is required.")
    version = rows[0]
    context = version.curriculum_snapshot.get("context") or context_for(
        lesson_path(db, classroom, version.lesson_id, False)
    ).model_dump(mode="json")
    count = db.scalar(
        select(func.count())
        .select_from(AssignmentQuestion)
        .where(AssignmentQuestion.assignment_version_id == version.id)
    )
    return DraftSummary(
        id=item.id,
        class_id=classroom.id,
        status=item.status,
        title=version.title,
        context=context,
        question_count=count,
    )


def execute(
    repo: ClassroomRepository,
    token,
    settings,
    *,
    action,
    class_id=None,
    assignment_id=None,
    payload=None,
    query=None,
    lesson_id=None,
    expected=None,
    request_key=None,
    request_id=None,
):
    db = repo.session
    write = action in {"create", "replace", "archive", "publish"}
    try:
        with authenticated_session(repo, token, settings) as (_, user):
            require_instructor(user)
            item = None
            if assignment_id:
                class_id = db.scalar(
                    select(Assignment.class_id).where(
                        Assignment.id == assignment_id, Assignment.instructor_id == user.id
                    )
                )
                if class_id is None:
                    raise fail(404, "Assignment draft not found.")
            classroom = repo.owned(user.id, class_id)
            if classroom is None:
                raise fail(404, "Class not found.")
            db.refresh(classroom)  # Revalidate the locked class after any wait/earlier ORM load.
            db.execute(
                text(
                    "SELECT pg_advisory_xact_lock(78090001)"
                    if write
                    else "SELECT pg_advisory_xact_lock_shared(78090001)"
                )
            )
            if assignment_id:
                item = db.scalar(
                    select(Assignment)
                    .where(
                        Assignment.id == assignment_id,
                        Assignment.class_id == class_id,
                        Assignment.instructor_id == user.id,
                    )
                    .with_for_update(read=not write)
                    .execution_options(populate_existing=True)
                )
                if item is None or item.status not in {"draft", "archived", "published"}:
                    raise fail(404, "Assignment draft not found.")
            if action == "list":
                statement = select(Assignment).where(
                    Assignment.class_id == class_id,
                    Assignment.instructor_id == user.id,
                    Assignment.status.in_(["draft", "archived", "published"]),
                )
                rows = list(
                    db.scalars(
                        statement.order_by(Assignment.created_at.desc(), Assignment.id)
                        .limit(query.limit + 1)
                        .offset(query.offset)
                    )
                )
                result = Page(
                    items=[summary(db, classroom, row) for row in rows[: query.limit]],
                    has_more=len(rows) > query.limit,
                    offset=query.offset,
                    limit=query.limit,
                )
            elif action == "read":
                result = describe(db, classroom, item)
            elif action == "publish":
                from app.modules.assignments.publication import publish

                result = publish(db, classroom, item, user, payload, expected, request_key, request_id)
            elif action in {"lessons", "questions"}:
                if classroom.status != "active" or classroom.archived_at is not None:
                    raise fail(409, "Archived classes cannot select assignment content.")
                statement = path_statement(5).where(
                    *visible(5), CurriculumGrade.grade_level_id == classroom.grade_level_id
                )
                if classroom.subject_id is not None:
                    statement = statement.where(CurriculumSubject.subject_id == classroom.subject_id)
                if action == "lessons":
                    if query.q:
                        statement = statement.where(Lesson.name.icontains(query.q, autoescape=True))
                    paths = db.execute(
                        statement.order_by(CurriculumVersion.created_at.desc(), Lesson.id)
                        .limit(query.limit + 1)
                        .offset(query.offset)
                    ).all()
                    result = Page(
                        items=[context_for(path) for path in paths[: query.limit]],
                        has_more=len(paths) > query.limit,
                        limit=query.limit,
                        offset=query.offset,
                    )
                else:
                    if not lesson_path(db, classroom, lesson_id):
                        raise fail(404, "Eligible lesson not found.")
                    statement = (
                        select(QuestionRevision)
                        .join(Question)
                        .where(
                            Question.status == "published",
                            Question.archived_at.is_(None),
                            QuestionRevision.locked_at.is_not(None),
                            QuestionRevision.lesson_id == lesson_id,
                            QuestionRevision.language == classroom.language,
                        )
                    )
                    if query.q:
                        statement = statement.where(QuestionRevision.prompt.icontains(query.q, autoescape=True))
                    if query.method:
                        statement = statement.where(QuestionRevision.method == query.method)
                    rows = list(
                        db.scalars(
                            statement.order_by(
                                QuestionRevision.question_id, QuestionRevision.version.desc(), QuestionRevision.id
                            )
                            .limit(query.limit + 1)
                            .offset(query.offset)
                        )
                    )
                    result = Page(
                        items=[public_item(db, classroom, row) for row in rows[: query.limit]],
                        has_more=len(rows) > query.limit,
                        limit=query.limit,
                        offset=query.offset,
                    )
            else:
                digest = (
                    hashlib.sha256(
                        json.dumps(
                            {"class_id": str(class_id), "payload": payload.model_dump(mode="json")}, sort_keys=True
                        ).encode()
                    ).hexdigest()
                    if payload
                    else None
                )
                if action == "create":
                    existing = db.scalar(
                        select(Assignment).where(
                            Assignment.instructor_id == user.id, Assignment.creation_request_id == request_key
                        )
                    )
                    if existing:
                        if existing.class_id != class_id or existing.creation_fingerprint != digest:
                            raise fail(409, "This creation key was used for another draft. Reload before retrying.")
                        return describe(db, classroom, existing)
                else:
                    if not expected:
                        raise IdentityError(428, "assignment_revision_required", "Reload the draft before changing it.")
                    if expected.strip('"') != fingerprint(db, item):
                        raise fail()
                    if item.status != "draft" or any(row.locked_at for row in versions(db, item)):
                        raise fail(409, "Only unlocked assignment drafts may change.")
                if action == "archive":
                    item.status = "archived"
                    item.archived_at = datetime.now(timezone.utc)
                else:
                    if classroom.status != "active" or classroom.archived_at is not None:
                        raise fail(409, "Archived classes cannot create or edit assignment drafts.")
                    path = lesson_path(db, classroom, payload.lesson_id)
                    if path is None:
                        raise fail(422, "Choose a published lesson compatible with this class grade and subject.")
                    selected = []
                    identities = set()
                    for row_id in payload.question_revision_ids:
                        row = db.get(QuestionRevision, row_id, populate_existing=True)
                        if row is None or row.lesson_id != payload.lesson_id or not eligible(db, classroom, row):
                            raise fail(
                                422, "Choose eligible published question versions from this lesson and language."
                            )
                        if row.question_id in identities:
                            raise fail(422, "Use each stable question only once, even across revisions.")
                        identities.add(row.question_id)
                        selected.append(row)
                    if action == "create":
                        retained_points = {}
                        item = Assignment(
                            class_id=class_id,
                            instructor_id=user.id,
                            creation_request_id=request_key,
                            creation_fingerprint=digest,
                            status="draft",
                        )
                        db.add(item)
                        db.flush()
                        version = AssignmentVersion(
                            assignment_id=item.id,
                            version=1,
                            max_attempts=None,
                            lesson_id=payload.lesson_id,
                            title=payload.title,
                        )
                        db.add(version)
                    else:
                        version = versions(db, item)[0]
                        retained_points = {child.question_revision_id: child.points for child in children(db, version)}
                        for child in children(db, version):
                            db.delete(child)
                        db.flush()
                    version.lesson_id = payload.lesson_id
                    version.title = payload.title
                    version.instructions = payload.instructions
                    version.curriculum_snapshot = {
                        "schema_version": 1,
                        "context": context_for(path).model_dump(mode="json"),
                    }
                    db.flush()
                    for position, row in enumerate(selected, 1):
                        db.add(
                            AssignmentQuestion(
                                assignment_version_id=version.id,
                                question_revision_id=row.id,
                                position=position,
                                points=retained_points.get(row.id),
                            )
                        )
                db.add(
                    AuditLog(
                        actor_id=user.id,
                        action="assignments." + action,
                        entity_type="assignment",
                        entity_id=item.id,
                        occurred_at=datetime.now(timezone.utc),
                        request_id=request_id,
                        safe_metadata={},
                    )
                )
                db.flush()
                result = describe(db, classroom, item)
        return result
    except DBAPIError as exc:
        if getattr(exc.orig, "sqlstate", None) in {"23503", "23505", "23514", "40001", "40P01"}:
            raise fail() from exc
        raise
