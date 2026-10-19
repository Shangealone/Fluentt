"""Explicit, immutable classroom distribution; no question delivery or attempts."""

from datetime import datetime, timezone
from contextlib import contextmanager
from sqlalchemy import select, text
from app.models.assessments import Assignment, AssignmentVersion, AssignmentQuestion, QuestionRevision
from app.models.learning import LearningContext, LearnerProgress
from app.models.users import Classroom, ClassMembership, User
from app.models.operations import AuditLog
from app.modules.assignments.schemas import Page, PublishedView
from app.modules.assignments.service import (
    children,
    context_for,
    describe,
    eligible,
    fail,
    fingerprint,
    lesson_path,
    versions,
)
from app.modules.identity.session_service import authenticated_session
from app.modules.identity.errors import IdentityError
from app.modules.enrollment.service import require_student

CONTRACT = "distribution-only-v1"


def publish(db, classroom, item, user, payload, expected, key, request_id):
    if not expected:
        raise IdentityError(428, "assignment_revision_required", "Reload the assignment before publishing.")
    rows = list(
        db.scalars(
            select(AssignmentVersion)
            .where(AssignmentVersion.assignment_id == item.id)
            .order_by(AssignmentVersion.version.desc())
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    )
    if len(rows) != 1:
        raise fail(409, "Publication requires one draft version; legacy versions need operator review.")
    version = rows[0]
    if (
        item.status == "published"
        and version.publication_contract == CONTRACT
        and version.publication_request_id == key
    ):
        if payload.bind_subject_id not in {None, classroom.subject_id}:
            raise fail()
        return describe(db, classroom, item)
    if expected.strip('"') != fingerprint(db, item) or item.status != "draft" or version.locked_at:
        raise fail()
    if classroom.status != "active" or classroom.archived_at is not None:
        raise fail(409, "Only active classes can publish assignments.")
    path = lesson_path(db, classroom, version.lesson_id)
    entries = children(db, version)
    if (
        path is None
        or not entries
        or len(entries) > 200
        or not version.title.strip()
        or len(version.title) > 200
        or len(version.instructions or "") > 8000
    ):
        raise fail(422, "Choose a compatible published lesson and at least one eligible question.")
    selected = [db.get(QuestionRevision, child.question_revision_id, populate_existing=True) for child in entries]
    if (
        [child.position for child in entries] != list(range(1, len(entries) + 1))
        or any(
            row is None or row.lesson_id != version.lesson_id or not eligible(db, classroom, row) for row in selected
        )
        or len({row.question_id for row in selected}) != len(selected)
    ):
        raise fail(422, "Review question eligibility, unique identities and ordering before publishing.")
    if (
        any(
            value is not None
            for value in (version.max_attempts, version.starts_at, version.due_at, version.time_limit_seconds)
        )
        or version.grading_policy
        or any(child.points is not None for child in entries)
    ):
        raise fail(409, "Configured legacy policies require operator review; publication cannot rewrite them.")
    context = context_for(path)
    binding = classroom.subject_id is None
    if classroom.subject_id is None:
        if payload.bind_subject_id != context.subject_id:
            raise fail(422, "Explicitly confirm this lesson's subject as the class subject.")
        # Review retained assignment and learning history before binding, without rewriting it.
        lesson_ids = set(
            db.scalars(select(AssignmentVersion.lesson_id).join(Assignment).where(Assignment.class_id == classroom.id))
        )
        lesson_ids.update(
            db.scalars(
                select(LearnerProgress.lesson_id).join(LearningContext).where(LearningContext.class_id == classroom.id)
            )
        )
        for lesson_id in lesson_ids:
            old = lesson_path(db, classroom, lesson_id, False)
            if old is None or context_for(old).subject_id != context.subject_id:
                raise fail(409, "Existing class content conflicts with this subject; operator review is required.")
        classroom.subject_id = context.subject_id
    elif classroom.subject_id != context.subject_id or payload.bind_subject_id not in {None, classroom.subject_id}:
        raise fail(422, "The assignment must match the explicit class subject.")
    version.curriculum_snapshot = {"schema_version": 1, "context": context.model_dump(mode="json")}
    version.publication_contract = CONTRACT
    version.publication_request_id = key
    version.locked_at = datetime.now(timezone.utc)
    db.flush()  # Freeze the exact version/items before exposing the root as published.
    item.status = "published"
    db.add(
        AuditLog(
            actor_id=user.id,
            action="assignments.publish",
            entity_type="assignment",
            entity_id=item.id,
            occurred_at=version.locked_at,
            request_id=request_id,
            safe_metadata={
                "contract": CONTRACT,
                "class_id": str(classroom.id),
                "version_id": str(version.id),
                "subject_id": str(context.subject_id),
                "subject_bound": binding,
            },
        )
    )
    db.flush()
    return describe(db, classroom, item)


def student_view(db, classroom, item):
    rows = versions(db, item)
    if len(rows) != 1 or rows[0].publication_contract != CONTRACT or rows[0].locked_at is None:
        raise fail(404, "Published assignment unavailable.")
    version = rows[0]
    context = version.curriculum_snapshot.get("context", {})
    if context.get("subject_id") != str(classroom.subject_id):
        raise fail(404, "Published assignment unavailable.")
    # Fetch only method identifiers from question rows; never load their content or keys.
    methods = list(
        db.scalars(
            select(QuestionRevision.method)
            .join(AssignmentQuestion, AssignmentQuestion.question_revision_id == QuestionRevision.id)
            .where(AssignmentQuestion.assignment_version_id == version.id)
            .order_by(AssignmentQuestion.position)
        )
    )
    return PublishedView(
        id=item.id,
        class_id=classroom.id,
        version_id=version.id,
        title=version.title,
        instructions=version.instructions,
        context=version.curriculum_snapshot["context"],
        published_at=version.locked_at.isoformat(),
        question_count=len(methods),
        methods=methods,
    )


@contextmanager
def student_context(repo, token, settings, *, class_id=None, assignment_id=None):
    db = repo.session
    with authenticated_session(repo, token, settings) as (_, user):
        require_student(user)
        if callable(assignment_id):
            assignment_id = assignment_id(user)
            if assignment_id is None:
                raise fail(404, "Assignment attempt unavailable.")
        if assignment_id:
            class_id = db.scalar(
                select(Assignment.class_id).where(Assignment.id == assignment_id, Assignment.status == "published")
            )
        owner_id = db.scalar(select(Classroom.instructor_id).where(Classroom.id == class_id))
        owner = db.scalar(
            select(User).where(User.id == owner_id).with_for_update(read=True).execution_options(populate_existing=True)
        )
        classroom = db.scalar(
            select(Classroom)
            .where(Classroom.id == class_id)
            .with_for_update(read=True)
            .execution_options(populate_existing=True)
        )
        if (
            not owner
            or owner.role != "instructor"
            or owner.profile_status not in {"active", "onboarding"}
            or owner.archived_at
            or not classroom
            or classroom.instructor_id != owner.id
            or classroom.status != "active"
            or classroom.archived_at
        ):
            raise fail(404, "Published assignment unavailable.")
        membership = db.scalar(
            select(ClassMembership)
            .where(
                ClassMembership.class_id == class_id,
                ClassMembership.student_id == user.id,
                ClassMembership.status == "active",
                ClassMembership.ended_at.is_(None),
            )
            .with_for_update(read=True)
            .execution_options(populate_existing=True)
        )
        if membership is None:
            raise fail(404, "Published assignment unavailable.")
        db.execute(text("SELECT pg_advisory_xact_lock_shared(78090001)"))
        yield db, user, classroom


def student_read(repo, token, settings, *, class_id=None, assignment_id=None, query=None):
    with student_context(repo, token, settings, class_id=class_id, assignment_id=assignment_id) as (db, _, classroom):
        class_id = classroom.id
        statement = (
            select(Assignment)
            .join(AssignmentVersion)
            .where(
                Assignment.class_id == class_id,
                Assignment.instructor_id == classroom.instructor_id,
                Assignment.status == "published",
                AssignmentVersion.publication_contract == CONTRACT,
                AssignmentVersion.locked_at.is_not(None),
            )
        )
        if assignment_id:
            item = db.scalar(statement.where(Assignment.id == assignment_id).execution_options(populate_existing=True))
            if item is None:
                raise fail(404, "Published assignment unavailable.")
            result = student_view(db, classroom, item)
        else:
            rows = list(
                db.scalars(
                    statement.order_by(AssignmentVersion.locked_at.desc(), Assignment.id)
                    .offset(query.offset)
                    .limit(query.limit + 1)
                )
            )
            result = Page(
                items=[student_view(db, classroom, item) for item in rows[: query.limit]],
                has_more=len(rows) > query.limit,
                offset=query.offset,
                limit=query.limit,
            )
    return result
