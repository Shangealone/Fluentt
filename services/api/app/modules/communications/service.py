"""Live class authorization and immutable, idempotent plain-text communication."""

from contextlib import contextmanager
from datetime import datetime, timezone
from sqlalchemy import select, and_, or_
from sqlalchemy.exc import DBAPIError
from sqlalchemy.dialects.postgresql import insert
from app.models.users import User, Classroom, ClassMembership
from app.models.operations import Message, MessageRead, AuditLog
from app.modules.identity.session_service import authenticated_session
from app.modules.identity.errors import IdentityError
from app.modules.assignments.results import member_statement
from app.modules.enrollment.queries import eligible_memberships
from app.modules.communications.schemas import Person, Context, Classroom as ClassView, MessageView, Page

CONTRACT = "class-text-v1"


def fail(status=404):
    return IdentityError(
        status,
        "communication_unavailable",
        "Communication unavailable. Refresh to verify class access before retrying.",
    )


@contextmanager
def authorized(repo, token, settings, class_id=None):
    db = repo.session
    with authenticated_session(repo, token, settings) as (_, user):
        if user.role not in {"instructor", "school_student"}:
            raise fail(403)
        if class_id is None:
            yield db, user, None, None
            return
        if user.role == "instructor":
            classroom = repo.owned(user.id, class_id)
            owner = user
        else:
            owner_id = db.scalar(select(Classroom.instructor_id).where(Classroom.id == class_id))
            owner = db.scalar(
                select(User)
                .where(User.id == owner_id)
                .with_for_update(read=True)
                .execution_options(populate_existing=True)
            )
            classroom = db.scalar(
                select(Classroom)
                .where(Classroom.id == class_id)
                .with_for_update(read=True)
                .execution_options(populate_existing=True)
            )
        if classroom:
            db.refresh(classroom)
        if (
            not classroom
            or classroom.status != "active"
            or classroom.archived_at is not None
            or not owner
            or owner.role != "instructor"
            or owner.profile_status not in {"active", "onboarding"}
            or owner.archived_at is not None
            or classroom.instructor_id != owner.id
        ):
            raise fail()
        if user.role == "school_student":
            if user.profile_status != "active":
                raise fail()
            membership(db, class_id, user.id)
        yield db, user, classroom, owner


def membership(db, class_id, student_id):
    row = db.scalar(
        select(ClassMembership)
        .where(
            ClassMembership.class_id == class_id,
            ClassMembership.student_id == student_id,
            ClassMembership.status == "active",
            ClassMembership.ended_at.is_(None),
        )
        .with_for_update(read=True)
        .execution_options(populate_existing=True)
    )
    if row is None:
        raise fail()


def participant(db, user, classroom, student_id):
    if user.role == "school_student":
        if student_id != user.id:
            raise fail()
        return user
    # Match existing owner-result NOWAIT ordering; never wait for a student who may wait for this owner.
    student = db.scalar(
        member_statement(classroom.id)
        .where(User.id == student_id)
        .with_for_update(of=User, read=True, nowait=True)
        .execution_options(populate_existing=True)
    )
    if student is None:
        raise fail()
    membership(db, classroom.id, student.id)
    return student


def person(user):
    return Person(id=user.id, username=user.username)


def projection(user_id):
    return (
        select(Message, User.username, MessageRead.read_at)
        .join(User, User.id == Message.sender_id)
        .outerjoin(MessageRead, and_(MessageRead.message_id == Message.id, MessageRead.user_id == user_id))
    )


def view(row, user):
    message, username, read_at = row
    return MessageView(
        id=message.id,
        class_id=message.context_class_id,
        kind=message.message_type,
        sender=Person(id=message.sender_id, username=username),
        recipient_id=message.recipient_id,
        content=message.content,
        sent_at=message.sent_at,
        read=message.sender_id == user.id or read_at is not None,
    )


def allowed_statement(user, classroom, kind, student_id=None):
    statement = projection(user.id).where(
        Message.communication_contract == CONTRACT,
        Message.context_class_id == classroom.id,
        Message.message_type == kind,
    )
    if kind == "direct":
        statement = statement.where(
            or_(
                and_(Message.sender_id == classroom.instructor_id, Message.recipient_id == student_id),
                and_(Message.sender_id == student_id, Message.recipient_id == classroom.instructor_id),
            )
        )
    else:
        statement = statement.where(Message.sender_id == classroom.instructor_id, Message.class_id == classroom.id)
    return statement


def execute(
    repo,
    token,
    settings,
    *,
    action,
    class_id=None,
    student_id=None,
    message_id=None,
    payload=None,
    key=None,
    query=None,
    request_id=None,
):
    try:
        with authorized(repo, token, settings, class_id) as (db, user, classroom, owner):
            now = datetime.now(timezone.utc)
            if action == "classes":
                statement = select(Classroom.id, Classroom.class_name)
                if user.role == "instructor":
                    statement = statement.where(
                        Classroom.instructor_id == user.id,
                        Classroom.status == "active",
                        Classroom.archived_at.is_(None),
                    )
                else:
                    statement = statement.where(
                        Classroom.id.in_(eligible_memberships(user.id).with_only_columns(ClassMembership.class_id))
                    )
                if query.q:
                    statement = statement.where(Classroom.class_name.icontains(query.q, autoescape=True))
                rows = (
                    db.execute(
                        statement.order_by(Classroom.class_name, Classroom.id)
                        .limit(query.limit + 1)
                        .offset(query.offset)
                    )
                    .mappings()
                    .all()
                )
                return Page[ClassView](
                    items=[ClassView(**row) for row in rows[: query.limit]],
                    limit=query.limit,
                    offset=query.offset,
                    has_more=len(rows) > query.limit,
                    as_of=now,
                )
            if action == "context":
                peer = participant(db, user, classroom, student_id) if student_id else None
                return Context(
                    classroom=ClassView(id=classroom.id, class_name=classroom.class_name),
                    instructor=person(owner),
                    viewer=person(user),
                    peer=person(peer) if peer else (person(owner) if user.role == "school_student" else None),
                    role=user.role,
                )
            if action == "participants":
                if user.role != "instructor":
                    raise fail(403)
                statement = member_statement(class_id)
                if query.q:
                    statement = statement.where(User.username.icontains(query.q, autoescape=True))
                students = list(
                    db.scalars(
                        statement.order_by(User.canonical_username, User.id).limit(query.limit + 1).offset(query.offset)
                    )
                )
                return Page[Person](
                    items=[person(row) for row in students[: query.limit]],
                    limit=query.limit,
                    offset=query.offset,
                    has_more=len(students) > query.limit,
                    as_of=now,
                )
            kind = "direct" if student_id else "announcement"
            if message_id:
                item = db.scalar(
                    select(Message).where(
                        Message.id == message_id,
                        Message.context_class_id == class_id,
                        Message.communication_contract == CONTRACT,
                    )
                )
                if item is None:
                    raise fail()
                kind = item.message_type
                if kind == "direct":
                    student_id = item.recipient_id if item.sender_id == owner.id else item.sender_id
            if kind == "direct":
                target = participant(db, user, classroom, student_id)
            if action == "send" and kind == "announcement" and user.role != "instructor":
                raise fail(403)
            statement = allowed_statement(user, classroom, kind, student_id)
            if action == "send":
                recipient_id = (target.id if user.role == "instructor" else owner.id) if kind == "direct" else None
                previous = db.scalar(
                    select(Message).where(Message.sender_id == user.id, Message.send_request_id == key)
                )
                if previous:
                    if (
                        previous.communication_contract != CONTRACT
                        or previous.context_class_id != class_id
                        or previous.message_type != kind
                        or previous.recipient_id != recipient_id
                        or previous.content != payload.content
                    ):
                        raise fail(409)
                    return view(db.execute(statement.where(Message.id == previous.id)).one(), user)
                message = Message(
                    sender_id=user.id,
                    recipient_id=recipient_id,
                    class_id=class_id if kind == "announcement" else None,
                    context_class_id=class_id,
                    communication_contract=CONTRACT,
                    send_request_id=key,
                    message_type=kind,
                    content=payload.content,
                    sent_at=now,
                )
                db.add(message)
                db.flush()
                db.add(
                    AuditLog(
                        actor_id=user.id,
                        action="communication.send",
                        entity_type="message",
                        entity_id=message.id,
                        occurred_at=now,
                        request_id=request_id,
                        safe_metadata={"contract": CONTRACT, "class_id": str(class_id), "kind": kind},
                    )
                )
                db.flush()
                return view(db.execute(statement.where(Message.id == message.id)).one(), user)
            if message_id:
                row = db.execute(statement.where(Message.id == message_id)).one_or_none()
                if row is None:
                    raise fail()
                if action == "read" and item.sender_id != user.id:
                    db.execute(
                        insert(MessageRead)
                        .values(message_id=item.id, user_id=user.id, read_at=now)
                        .on_conflict_do_nothing(index_elements=[MessageRead.message_id, MessageRead.user_id])
                    )
                    db.flush()
                    row = db.execute(statement.where(Message.id == message_id)).one()
                return view(row, user)
            anchor = min(query.before, now) if query.before else now
            rows = db.execute(
                statement.where(Message.sent_at <= anchor)
                .order_by(Message.sent_at.desc(), Message.id.desc())
                .limit(query.limit + 1)
                .offset(query.offset)
            ).all()
            return Page[MessageView](
                items=[view(row, user) for row in rows[: query.limit]],
                limit=query.limit,
                offset=query.offset,
                has_more=len(rows) > query.limit,
                as_of=anchor,
            )
    except DBAPIError as exc:
        if getattr(exc.orig, "sqlstate", None) in {"40001", "40P01", "55P03"}:
            raise fail(409) from exc
        raise
