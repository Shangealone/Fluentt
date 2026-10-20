"""In-app notifications storage, queries, and dispatch operations."""

from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import select, and_, func, desc
from app.models.operations import Notification
from app.models.users import User, ClassMembership
from app.modules.curriculum.material_schemas import NotificationItem, NotificationPage
from app.modules.identity.errors import IdentityError


def list_notifications(db, user: User, limit: int = 20, offset: int = 0) -> NotificationPage:
    now = datetime.now(timezone.utc)
    
    # Query notifications for user
    stmt = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(desc(Notification.created_at), desc(Notification.id))
        .limit(limit + 1)
        .offset(offset)
    )
    rows = list(db.scalars(stmt))
    has_more = len(rows) > limit
    page_rows = rows[:limit]

    # Count unread notifications
    unread_count = db.scalar(
        select(func.count(Notification.id))
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
    ) or 0

    items = [
        NotificationItem(
            id=n.id,
            event_type=n.event_type if n.event_type in ["assignment_published", "class_announcement", "learning_material_available", "general"] else "general",
            title=n.title,
            message=n.message,
            related_resource_type=n.related_resource_type,
            related_resource_id=n.related_resource_id,
            read_at=n.read_at,
            created_at=n.created_at,
        )
        for n in page_rows
    ]

    return NotificationPage(
        items=items,
        limit=limit,
        offset=offset,
        has_more=has_more,
        unread_count=unread_count,
        as_of=now,
    )


def mark_notification_read(db, user: User, notification_id: UUID) -> NotificationItem:
    now = datetime.now(timezone.utc)
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        ).with_for_update()
    )
    if not notification:
        raise IdentityError(404, "notification_not_found", "Notification not found.")

    if notification.read_at is None:
        notification.read_at = now
        db.flush()

    return NotificationItem(
        id=notification.id,
        event_type=notification.event_type if notification.event_type in ["assignment_published", "class_announcement", "learning_material_available", "general"] else "general",
        title=notification.title,
        message=notification.message,
        related_resource_type=notification.related_resource_type,
        related_resource_id=notification.related_resource_id,
        read_at=notification.read_at,
        created_at=notification.created_at,
    )


def mark_all_notifications_read(db, user: User) -> int:
    now = datetime.now(timezone.utc)
    unreads = list(
        db.scalars(
            select(Notification).where(
                Notification.user_id == user.id,
                Notification.read_at.is_(None),
            ).with_for_update()
        )
    )
    for n in unreads:
        n.read_at = now
    db.flush()
    return len(unreads)


def create_notification_for_class_members(
    db,
    class_id: UUID,
    event_type: str,
    title: str,
    message: str,
    related_resource_type: str | None = None,
    related_resource_id: UUID | None = None,
) -> int:
    """Dispatches in-app notification to all active enrolled students of a class."""
    memberships = list(
        db.scalars(
            select(ClassMembership).where(
                ClassMembership.class_id == class_id,
                ClassMembership.status == "active",
                ClassMembership.ended_at.is_(None),
            )
        )
    )
    count = 0
    now = datetime.now(timezone.utc)
    for m in memberships:
        # Check idempotence / avoid duplicate notification for same user and resource
        if related_resource_id is not None:
            exists_already = db.scalar(
                select(Notification.id).where(
                    Notification.user_id == m.student_id,
                    Notification.event_type == event_type,
                    Notification.related_resource_id == related_resource_id,
                )
            )
            if exists_already:
                continue

        notif = Notification(
            user_id=m.student_id,
            event_type=event_type,
            title=title,
            message=message,
            related_resource_type=related_resource_type,
            related_resource_id=related_resource_id,
            read_at=None,
        )
        db.add(notif)
        count += 1

    db.flush()
    return count
