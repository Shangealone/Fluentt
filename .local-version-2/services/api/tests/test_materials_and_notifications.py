from datetime import datetime, timezone
from uuid import uuid4
import pytest
from app.models.operations import Notification
from app.modules.curriculum.material_schemas import (
    MaterialView,
    MaterialPage,
    NotificationItem,
    NotificationPage,
)
from app.modules.curriculum.material_service import get_lesson_materials
from app.modules.curriculum.notification_service import (
    list_notifications,
    mark_notification_read,
    mark_all_notifications_read,
    create_notification_for_class_members,
)


def test_material_schemas_valid():
    now = datetime.now(timezone.utc)
    lesson_id = uuid4()
    mat_id = uuid4()
    view = MaterialView(
        id=mat_id,
        lesson_id=lesson_id,
        title="Baitang 7 Kuwentong Bayan Guide",
        description="Mga gabay sa pagbabasa",
        resource_type="reading",
        content_text="Narito ang teksto ng aralin...",
        is_required=True,
    )
    assert view.id == mat_id
    assert view.resource_type == "reading"

    page = MaterialPage(
        items=[view],
        lesson_id=lesson_id,
        lesson_name="Kuwentong Bayan",
        total_count=1,
        as_of=now,
    )
    assert page.total_count == 1
    assert len(page.items) == 1


def test_notification_schemas_valid():
    now = datetime.now(timezone.utc)
    notif_id = uuid4()
    item = NotificationItem(
        id=notif_id,
        event_type="assignment_published",
        title="New Assignment: Filipino 7",
        message="A new assignment was published.",
        created_at=now,
    )
    assert item.id == notif_id
    assert item.read_at is None

    page = NotificationPage(
        items=[item],
        limit=20,
        offset=0,
        has_more=False,
        unread_count=1,
        as_of=now,
    )
    assert page.unread_count == 1
    assert len(page.items) == 1
