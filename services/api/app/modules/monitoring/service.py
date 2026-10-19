"""Read-only owned-class cohorts, pinned releases and bounded monitoring pages."""

from contextlib import contextmanager
from datetime import datetime, timezone
from sqlalchemy import select, func, text, cast, String
from sqlalchemy.exc import DBAPIError
from app.models.users import User, ClassMembership, Classroom as ClassModel
from app.models.curriculum import GradeLevel
from app.models.assessments import AssignmentAttempt, AssignmentVersion
from app.modules.identity.session_service import authenticated_session
from app.modules.identity.errors import IdentityError
from app.modules.classrooms.service import require_instructor
from app.modules.assignments.results import member_statement, result_state
from app.modules.progress.queries import published_assignments, assignments, with_results
from app.modules.progress.service import validate_captures, history_item
from app.modules.progress.metrics import submission_counts
from app.modules.assignments.schemas import Context
from app.modules.monitoring.schemas import (
    Classroom,
    Overview,
    Results,
    Student,
    Assignment,
    Page,
    ContextOption,
    StudentDetail,
    AssignmentDetail,
    StudentOutcome,
)
from app.modules.monitoring.metrics import released_mean


def fail(status=404):
    return IdentityError(
        status, "monitoring_unavailable", "Monitoring unavailable. Refresh to verify class access and activity."
    )


def classroom_view(db, classroom):
    return Classroom(
        id=classroom.id,
        class_name=classroom.class_name,
        language=classroom.language,
        grade=db.scalar(select(GradeLevel.number).where(GradeLevel.id == classroom.grade_level_id)),
    )


@contextmanager
def authorized(repo, token, settings, class_id=None, student_id=None):
    db = repo.session
    with authenticated_session(repo, token, settings) as (_, user):
        require_instructor(user)
        if class_id is None:
            yield db, user, None, []
            return
        classroom = repo.owned(user.id, class_id)
        if classroom is None:
            raise fail()
        db.refresh(classroom)
        if classroom.status != "active" or classroom.archived_at is not None:
            raise fail()
        db.execute(text("SELECT pg_advisory_xact_lock_shared(78090001)"))
        # Never block on a student while holding its owner. An in-flight student
        # operation may already hold that user and be waiting for this owner.
        statement = select(User).where(User.id.in_(member_statement(class_id).with_only_columns(User.id)))
        if student_id:
            statement = statement.where(User.id == student_id)
        students = list(
            db.scalars(
                statement.order_by(User.id)
                .with_for_update(read=True, nowait=True)
                .execution_options(populate_existing=True)
            )
        )
        ids = [student.id for student in students]
        memberships = list(
            db.scalars(
                select(ClassMembership)
                .where(
                    ClassMembership.class_id == class_id,
                    ClassMembership.student_id.in_(ids),
                    ClassMembership.status == "active",
                    ClassMembership.ended_at.is_(None),
                )
                .order_by(ClassMembership.student_id, ClassMembership.id)
                .with_for_update(read=True)
                .execution_options(populate_existing=True)
            )
        )
        active = {row.student_id for row in memberships}
        students = [student for student in students if student.id in active]
        if student_id and not students:
            raise fail()
        yield db, user, classroom, students


def scoped(statement, query):
    source = statement.subquery("published_scope")
    selected = select(source)
    if query.lesson_id:
        selected = selected.where(source.c.curriculum_snapshot["context"]["lesson_id"].astext == str(query.lesson_id))
    if query.curriculum_version_id:
        selected = selected.where(
            source.c.curriculum_snapshot["context"]["curriculum_version_id"].astext == str(query.curriculum_version_id)
        )
    return selected.subquery("scope")


def records(publications, student_ids):
    return (
        select(
            publications,
            AssignmentAttempt.student_id,
            AssignmentAttempt.id.label("attempt_id"),
            cast(AssignmentAttempt.status, String).label("submission_status"),
            AssignmentAttempt.capture_contract,
            AssignmentAttempt.expires_at,
            AssignmentAttempt.started_at,
            AssignmentAttempt.submitted_at,
            AssignmentAttempt.updated_at.label("last_activity_at"),
            func.coalesce(AssignmentAttempt.submitted_at, AssignmentAttempt.updated_at).label("sort_at"),
        )
        .select_from(publications)
        .join(AssignmentAttempt, AssignmentAttempt.assignment_version_id == publications.c.version_id)
        .where(
            AssignmentAttempt.student_id.in_(student_ids),
            AssignmentAttempt.attempt_number == 1,
        )
        .subquery("recorded_attempts")
    )


def groups(db, source, key=None):
    enriched = with_results(source).order_by(None).subquery("outcomes")
    keys = [enriched.c[key]] if key else []
    rows = (
        db.execute(
            select(
                *keys, enriched.c.submission_status, enriched.c.run_status, enriched.c.released, func.count().label("n")
            ).group_by(*keys, enriched.c.submission_status, enriched.c.run_status, enriched.c.released)
        )
        .mappings()
        .all()
    )
    result = {}
    for row in rows:
        bucket = result.setdefault(row[key] if key else None, {"in_progress": 0, "submitted": 0, "results": Results()})
        bucket[row["submission_status"]] += row["n"]
        if row["submission_status"] == "submitted":
            state = result_state("submitted", row["run_status"], bool(row["released"]))
            field = "awaiting_evaluation" if state == "submitted" else state
            setattr(bucket["results"], field, getattr(bucket["results"], field) + row["n"])
    return result


def bucket(values, key=None):
    return values.get(key, {"in_progress": 0, "submitted": 0, "results": Results()})


def counts(total, value):
    return submission_counts(total, value["in_progress"], value["submitted"])


def overview(db, classroom, publications, source, size):
    total = db.scalar(select(func.count()).select_from(publications))
    value = bucket(groups(db, source))
    return Overview(
        classroom=classroom_view(db, classroom),
        as_of=datetime.now(timezone.utc),
        available_assignments=total,
        eligible_students=size,
        counts=counts(total * size, value),
        results=value["results"],
    )


def mean_groups(db, source):
    enriched = with_results(source).order_by(None).subquery("released_outcomes")
    result = {}
    for row in db.execute(
        select(
            enriched.c.version_id,
            enriched.c.engine_version,
            enriched.c.policy_version,
            enriched.c.possible_points,
            func.count().label("n"),
            func.sum(enriched.c.earned_points).label("points"),
        )
        .where(enriched.c.released.is_(True))
        .group_by(
            enriched.c.version_id, enriched.c.engine_version, enriched.c.policy_version, enriched.c.possible_points
        )
    ).mappings():
        result.setdefault(row["version_id"], []).append(row)
    return result


def assignment_view(row, value, size, means):
    try:
        context = Context.model_validate(row["curriculum_snapshot"].get("context"))
    except (ValueError, TypeError, AttributeError):
        raise fail(409) from None
    return Assignment(
        id=row["id"],
        version_id=row["version_id"],
        title=row["title"],
        context=context,
        published_at=row["published_at"],
        counts=counts(size, value),
        results=value["results"],
        mean=released_mean(means),
    )


def execute(repo, token, settings, *, action, class_id=None, student_id=None, assignment_id=None, query):
    try:
        with authorized(repo, token, settings, class_id, student_id) as (db, user, classroom, students):
            if action == "classes":
                statement = select(
                    ClassModel.id, ClassModel.class_name, ClassModel.language, GradeLevel.number.label("grade")
                )
                statement = statement.join(GradeLevel, ClassModel.grade_level_id == GradeLevel.id).where(
                    ClassModel.instructor_id == user.id, ClassModel.status == "active", ClassModel.archived_at.is_(None)
                )
                if query.q:
                    statement = statement.where(ClassModel.class_name.icontains(query.q, autoescape=True))
                rows = (
                    db.execute(
                        statement.order_by(ClassModel.class_name, ClassModel.id)
                        .limit(query.limit + 1)
                        .offset(query.offset)
                    )
                    .mappings()
                    .all()
                )
                return Page[Classroom](
                    items=[Classroom(**row) for row in rows[: query.limit]],
                    limit=query.limit,
                    offset=query.offset,
                    has_more=len(rows) > query.limit,
                )
            ids = [student.id for student in students]
            publications = scoped(published_assignments([class_id]), query)
            source = records(publications, ids)
            validate_captures(db, source)
            if action == "overview":
                return overview(db, classroom, publications, source, len(ids))
            if action == "contexts":
                field = "lesson" if query.kind == "lesson" else "curriculum_version"
                name = "lesson_name" if query.kind == "lesson" else "curriculum_name"
                options = (
                    select(
                        publications.c.curriculum_snapshot["context"][field + "_id"].astext.label("id"),
                        publications.c.curriculum_snapshot["context"][name].astext.label("label"),
                    )
                    .distinct()
                    .subquery()
                )
                rows = (
                    db.execute(
                        select(options)
                        .order_by(options.c.label, options.c.id)
                        .limit(query.limit + 1)
                        .offset(query.offset)
                    )
                    .mappings()
                    .all()
                )
                return Page[ContextOption](
                    items=[ContextOption(**row) for row in rows[: query.limit]],
                    limit=query.limit,
                    offset=query.offset,
                    has_more=len(rows) > query.limit,
                )
            if action == "roster":
                roster = select(User.id, User.username).where(User.id.in_(ids))
                if query.q:
                    roster = roster.where(User.username.icontains(query.q, autoescape=True))
                rows = (
                    db.execute(
                        roster.order_by(User.canonical_username, User.id).limit(query.limit + 1).offset(query.offset)
                    )
                    .mappings()
                    .all()
                )
                page_ids = [row["id"] for row in rows[: query.limit]]
                values = groups(db, records(publications, page_ids), "student_id")
                total = db.scalar(select(func.count()).select_from(publications))
                return Page[Student](
                    items=[
                        Student(
                            id=row["id"],
                            username=row["username"],
                            counts=counts(total, bucket(values, row["id"])),
                            results=bucket(values, row["id"])["results"],
                        )
                        for row in rows[: query.limit]
                    ],
                    limit=query.limit,
                    offset=query.offset,
                    has_more=len(rows) > query.limit,
                )
            if action == "student":
                info = overview(db, classroom, publications, source, 1)
                values = bucket(groups(db, source))
                student = students[0]
                summary = Student(
                    id=student.id,
                    username=student.username,
                    counts=counts(info.available_assignments, values),
                    results=values["results"],
                )
                rows = scoped(assignments(student.id, [class_id]), query)
                statement = select(rows)
                if query.q:
                    statement = statement.where(rows.c.title.icontains(query.q, autoescape=True))
                if query.status != "all":
                    statement = statement.where(rows.c.submission_status == query.status)
                page = (
                    statement.order_by(rows.c.sort_at.desc(), rows.c.id)
                    .limit(query.limit + 1)
                    .offset(query.offset)
                    .subquery("page")
                )
                entries = db.execute(with_results(page)).mappings().all()
                return StudentDetail(
                    summary=summary,
                    overview=info,
                    items=[history_item(row) for row in entries[: query.limit]],
                    limit=query.limit,
                    offset=query.offset,
                    has_more=len(entries) > query.limit,
                )
            statement = select(publications)
            if assignment_id:
                statement = statement.where(publications.c.id == assignment_id)
            if query.q and action == "assignments":
                statement = statement.where(publications.c.title.icontains(query.q, autoescape=True))
            rows = (
                db.execute(
                    statement.order_by(publications.c.published_at.desc(), publications.c.id)
                    .limit(query.limit + 1 if not assignment_id else 1)
                    .offset(query.offset if not assignment_id else 0)
                )
                .mappings()
                .all()
            )
            if assignment_id and not rows:
                raise fail()
            chosen = [row["version_id"] for row in rows[: query.limit]]
            scoped_records = select(source).where(source.c.version_id.in_(chosen)).subquery("chosen_attempts")
            values = groups(db, scoped_records, "version_id")
            means = mean_groups(db, scoped_records)
            items = [
                assignment_view(row, bucket(values, row["version_id"]), len(ids), means.get(row["version_id"], []))
                for row in rows[: query.limit]
            ]
            if action == "assignments":
                return Page[Assignment](
                    items=items, limit=query.limit, offset=query.offset, has_more=len(rows) > query.limit
                )
            selected = rows[0]
            # One assignment × current roster, rather than an all-assignment Cartesian product.
            roster = select(User.id.label("student_id"), User.username).where(User.id.in_(ids)).subquery("roster")
            own = assignments(roster.c.student_id, [class_id], student_source=roster).add_columns(
                roster.c.student_id, roster.c.username
            )
            own = own.where(AssignmentVersion.id == selected["version_id"]).subquery("student_outcomes")
            filtered = select(own)
            if query.q:
                filtered = filtered.where(own.c.username.icontains(query.q, autoescape=True))
            if query.status != "all":
                filtered = filtered.where(own.c.submission_status == query.status)
            page = (
                filtered.order_by(func.lower(own.c.username), own.c.student_id)
                .limit(query.limit + 1)
                .offset(query.offset)
                .subquery("page")
            )
            entries = (
                db.execute(with_results(page).order_by(None).order_by(func.lower(page.c.username), page.c.student_id))
                .mappings()
                .all()
            )
            details = [
                StudentOutcome(
                    id=row["student_id"],
                    username=row["username"],
                    submission_status=row["submission_status"],
                    result_state=result_state(row["submission_status"], row["run_status"], bool(row["released"])),
                    attempt_id=row["attempt_id"],
                    submitted_at=row["submitted_at"],
                    released_run_id=row["released_run_id"],
                    earned_points=row["earned_points"],
                    possible_points=row["possible_points"],
                )
                for row in entries[: query.limit]
            ]
            info = overview(db, classroom, publications, source, len(ids))
            return AssignmentDetail(
                summary=items[0],
                overview=info,
                items=details,
                limit=query.limit,
                offset=query.offset,
                has_more=len(entries) > query.limit,
            )
    except DBAPIError as exc:
        if getattr(exc.orig, "sqlstate", None) in {"40001", "40P01", "55P03"}:
            raise fail(409) from exc
        raise
