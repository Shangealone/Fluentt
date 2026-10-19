"""Trusted read projections under the live mobile/classroom boundary."""

from contextlib import contextmanager
from datetime import datetime, timezone
from sqlalchemy import select, text, func, or_, and_
from app.models.users import User, Classroom, ClassMembership
from app.models.curriculum import GradeLevel
from app.modules.identity.errors import IdentityError
from app.modules.identity.session_service import authenticated_session
from app.modules.enrollment.queries import eligible_memberships
from app.modules.assignments.results import result_state
from app.modules.assignments.schemas import Context
from app.modules.progress import queries
from app.modules.progress.metrics import submission_counts
from app.modules.progress.schemas import Summary, ClassOption, Classes, History, HistoryItem


def unavailable(status=404):
    return IdentityError(
        status, "progress_unavailable", "Progress is unavailable. Refresh to verify your classes and activity."
    )


@contextmanager
def authorized(repo, token, settings, class_id=None):
    db = repo.session
    with authenticated_session(repo, token, settings) as (_, user):
        if user.role not in {"school_student", "personal_student"}:
            raise unavailable(403)
        if user.role == "personal_student":
            if class_id:
                raise unavailable()
            yield db, user, []
            return
        discovery = eligible_memberships(user.id).with_only_columns(ClassMembership.class_id, Classroom.instructor_id)
        if class_id:
            discovery = discovery.where(ClassMembership.class_id == class_id)
        references = db.execute(discovery).all()
        # Match student_context: all owners before any class/content lock.
        owner_ids = {row.instructor_id for row in references}
        list(
            db.scalars(
                select(User)
                .where(User.id.in_(owner_ids))
                .order_by(User.id)
                .with_for_update(read=True)
                .execution_options(populate_existing=True)
            )
        )
        candidates = {row.class_id for row in references}
        list(
            db.scalars(
                select(Classroom)
                .where(Classroom.id.in_(candidates))
                .order_by(Classroom.id)
                .with_for_update(read=True)
                .execution_options(populate_existing=True)
            )
        )
        members = list(
            db.scalars(
                eligible_memberships(user.id)
                .where(
                    ClassMembership.class_id.in_(candidates),
                    Classroom.instructor_id.in_(owner_ids),
                )
                .order_by(ClassMembership.class_id, ClassMembership.id)
                .with_for_update(of=ClassMembership, read=True)
                .execution_options(populate_existing=True)
            )
        )
        ids = sorted({row.class_id for row in members})
        if class_id and class_id not in ids:
            raise unavailable()
        db.execute(text("SELECT pg_advisory_xact_lock_shared(78090001)"))
        yield db, user, ids


def base(db, user, ids):
    rows = queries.assignments(user.id, ids).subquery("available_assignments")
    validate_captures(db, rows)
    return rows


def validate_captures(db, rows):
    invalid = db.scalar(
        select(
            select(rows.c.id)
            .where(
                and_(
                    rows.c.attempt_id.is_not(None),
                    or_(
                        rows.c.capture_contract.is_distinct_from("unscored-capture-v1"),
                        rows.c.submission_status.not_in(["in_progress", "submitted"]),
                        rows.c.expires_at.is_not(None),
                        and_(rows.c.submission_status == "submitted", rows.c.submitted_at.is_(None)),
                    ),
                )
            )
            .exists()
        )
    )
    if invalid:
        # No approved conversion of expired/legacy contracts into completion buckets.
        raise unavailable(409)


def execute(repo, token, settings, *, action, class_id=None, query=None):
    if action == "history":
        class_id = query.class_id
    with authorized(repo, token, settings, class_id) as (db, user, ids):
        now = datetime.now(timezone.utc)
        if user.role == "personal_student":
            if action == "summary":
                return Summary(
                    availability="unavailable", as_of=now, class_id=None, class_name=None, class_count=None, counts=None
                )
            if action == "classes":
                return Classes(items=[], limit=query.limit, offset=query.offset, has_more=False)
            return History(
                availability="unavailable", as_of=now, items=[], limit=query.limit, offset=query.offset, has_more=False
            )
        if action == "classes":
            options = (
                db.execute(
                    select(Classroom.id, Classroom.class_name, Classroom.language, GradeLevel.number.label("grade"))
                    .join(GradeLevel, Classroom.grade_level_id == GradeLevel.id)
                    .where(Classroom.id.in_(ids))
                    .order_by(Classroom.class_name, Classroom.id)
                    .limit(query.limit + 1)
                    .offset(query.offset)
                )
                .mappings()
                .all()
            )
            return Classes(
                items=[ClassOption(**row) for row in options[: query.limit]],
                limit=query.limit,
                offset=query.offset,
                has_more=len(options) > query.limit,
            )
        rows = base(db, user, ids)
        if action == "summary":
            result = (
                db.execute(
                    select(
                        func.count().label("available"),
                        func.count().filter(rows.c.submission_status == "not_started").label("not_started"),
                        func.count().filter(rows.c.submission_status == "in_progress").label("in_progress"),
                        func.count().filter(rows.c.submission_status == "submitted").label("submitted"),
                    ).select_from(rows)
                )
                .mappings()
                .one()
            )
            counts = submission_counts(result["available"], result["in_progress"], result["submitted"])
            name = db.scalar(select(Classroom.class_name).where(Classroom.id == class_id)) if class_id else None
            return Summary(
                availability="available",
                as_of=now,
                class_id=class_id,
                class_name=name,
                class_count=len(ids),
                counts=counts,
            )
        statement = select(rows)
        if query.status != "all":
            statement = statement.where(rows.c.submission_status == query.status)
        if query.since:
            statement = statement.where(rows.c.sort_at >= query.since)
        if query.before:
            statement = statement.where(rows.c.sort_at < query.before)
        page = (
            statement.order_by(rows.c.sort_at.desc(), rows.c.id)
            .limit(query.limit + 1)
            .offset(query.offset)
            .subquery("page")
        )
        entries = db.execute(queries.with_results(page)).mappings().all()
        items = [history_item(row) for row in entries[: query.limit]]
        return History(
            availability="available",
            as_of=now,
            items=items,
            limit=query.limit,
            offset=query.offset,
            has_more=len(entries) > query.limit,
        )


def history_item(row):
    try:
        context = Context.model_validate(row["curriculum_snapshot"].get("context"))
    except (ValueError, TypeError, AttributeError):
        raise unavailable(409) from None
    state = result_state(row["submission_status"], row["run_status"], bool(row["released"]))
    return HistoryItem(
        **{
            key: row[key]
            for key in (
                "id",
                "version_id",
                "class_id",
                "class_name",
                "language",
                "title",
                "submission_status",
                "attempt_id",
                "published_at",
                "started_at",
                "last_activity_at",
                "submitted_at",
                "sort_at",
                "released_run_id",
                "policy_version",
                "earned_points",
                "possible_points",
            )
        },
        context=context,
        result_state=state,
    )
