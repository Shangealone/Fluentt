"""Synthetic QA only, on the shared fixture's disposable UUID PostgreSQL database."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.config import Settings
from app.db.session import get_session
from app.main import create_app
from app.models.personal_history import PersonalActivityEvent
from app.models.users import User
from app.modules.administration import service
from app.modules.administration.cli import content_permission
from app.modules.administration.performance import project
from tests.integration.test_admin_postgresql import setup

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/admin/performance"
NOW = datetime(2026, 10, 27, 12, tzinfo=timezone.utc)


def learner(db, name, role="personal_student", status="active"):
    user = User(username=name, role=role, profile_status=status)
    db.add(user)
    db.flush()
    return user


def event(db, user, kind="learn_question", when=NOW):
    db.add(
        PersonalActivityEvent(
            user_id=user.id,
            event_key=uuid4(),
            kind=kind,
            source_id="synthetic-qa",
            title="Synthetic QA only",
            language="english",
            fingerprint="0" * 64,
            recorded_at=when,
        )
    )
    db.flush()


def test_window_counts_current_scope_pagination_and_no_private_content(db):
    first = learner(db, "QA Alpha")
    learner(db, "QA Beta")
    for kind in ("learn_question", "learn_lesson", "voice_phrase", "tutor_reply", "tutor_session"):
        event(db, first, kind)
    # Historical receipts from now-ineligible profiles must not be included.
    disabled = learner(db, "QA Disabled")
    event(db, disabled)
    disabled.profile_status = "disabled"
    changed = learner(db, "QA Changed")
    event(db, changed)
    changed.role = "school_student"
    archived = learner(db, "QA Archived")
    event(db, archived)
    archived.archived_at = NOW
    learner(db, "QA Teacher", role="instructor")
    event(db, first, when=NOW - timedelta(days=7))
    event(db, first, when=NOW + timedelta(seconds=1))
    db.flush()
    before = db.scalar(select(func.count()).select_from(PersonalActivityEvent))
    report = project(db, days=7, now=NOW, limit=1)
    assert report.learners == 2 and report.learners_with_activity == 1
    assert set(report.counts.model_dump().values()) == {1}
    assert report.timeline[0].count == 5 and len(report.timeline) == 1
    assert report.window_start == datetime(2026, 10, 21, tzinfo=timezone.utc)
    assert report.items[0].username == "QA Alpha" and report.has_more
    second = project(db, days=7, now=NOW, offset=1, limit=1)
    assert second.items[0].username == "QA Beta" and not second.has_more
    assert second.items[0].last_activity is None and second.items[0].learn_question == 0
    assert "synthetic-qa" not in report.model_dump_json()
    assert "fingerprint" not in report.model_dump_json() and "prompt" not in report.model_dump_json()
    assert db.scalar(select(func.count()).select_from(PersonalActivityEvent)) == before


def test_empty_and_literal_search_scope(db):
    empty = project(db, now=NOW)
    assert empty.learners == 0 and empty.timeline == [] and empty.items == []
    assert set(empty.counts.model_dump().values()) == {0}
    learner(db, "QA_One")
    learner(db, "QA One")
    assert len(project(db, q="_", now=NOW).items) == 1
    assert project(db, q="%", now=NOW).items == []
    assert project(db, q="!", now=NOW).items == []
    matched = project(db, q="qa one", now=NOW)
    assert matched.items[0].username == "QA One" and matched.learners == 2


def test_inclusive_utc_calendar_boundary(db):
    user = learner(db, "QA Boundary")
    start = datetime(2026, 10, 21, tzinfo=timezone.utc)
    event(db, user, when=start - timedelta(microseconds=1))
    event(db, user, when=start)
    # Oct 22 in Manila is still Oct 21 UTC.
    event(db, user, when=datetime(2026, 10, 22, 1, tzinfo=timezone(timedelta(hours=8))))
    report = project(db, now=NOW, days=7)
    assert report.counts.learn_question == 2
    assert [(day.date, day.count) for day in report.timeline] == [("2026-10-21", 2)]


def test_real_admin_permission_live_revocation_transport_bounds_and_no_store(db):
    repo = setup(db)
    token = service.issue_session(repo, "https://id.example", "approved-subject")
    app = create_app(Settings(_env_file=None, environment="test"))
    app.app.dependency_overrides[get_session] = lambda: db
    with TestClient(app) as client:
        anonymous = client.get(BASE)
        assert anonymous.status_code == 401 and "no-store" in anonymous.headers["cache-control"]
        assert client.get(BASE, headers={"Authorization": "Bearer " + token}).status_code == 401
        client.cookies.set("fluentt_admin", token)
        assert client.get(BASE).status_code == 403
        content_permission(repo, "SyntheticAdmin", grant=True, access="reader", domain="performance")
        for days in (7, 30, 90):
            response = client.get(BASE, params={"days": days})
            assert response.status_code == 200, response.text
            assert response.json()["days"] == days and response.json()["learners"] == 0
            assert "no-store" in response.headers["cache-control"]
        for params in ({"days": 8}, {"limit": 51}, {"offset": -1}, {"q": "a" * 101}):
            assert client.get(BASE, params=params).status_code == 422
        content_permission(repo, "SyntheticAdmin", grant=False, access="reader", domain="performance")
        denied = client.get(BASE)
        assert denied.status_code == 403 and "no-store" in denied.headers["cache-control"]
        with pytest.raises(ValueError):
            content_permission(repo, "SyntheticAdmin", grant=True, access="editor", domain="performance")
