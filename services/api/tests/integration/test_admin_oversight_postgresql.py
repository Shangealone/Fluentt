"""Explicitly synthetic QA; migrations and records use the disposable UUID database only."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import Settings
from app.db.session import get_session
from app.main import create_app
from app.models.operations import AuditLog
from app.models.users import User, UserSession, ClassMembership
from app.modules.administration import service
from app.modules.administration.cli import content_permission
from app.modules.administration.oversight import page, revision
from tests.integration.test_admin_postgresql import setup

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/admin/oversight"


def account(db, name, role="school_student", status="active"):
    row = User(username=name, role=role, profile_status=status)
    db.add(row)
    db.flush()
    return row


def client_for(db):
    repo = setup(db)
    token = service.issue_session(repo, "https://id.example", "approved-subject")
    csrf = service.resolve_session(repo, token).csrf_token
    app = create_app(Settings(_env_file=None, environment="test"))
    app.app.dependency_overrides[get_session] = lambda: db
    client = TestClient(app)
    client.cookies.set("fluentt_admin", token)
    return repo, client, csrf


def test_school_projection_search_paging_and_personal_isolation(db, graph):
    graph["student"].profile_status = graph["instructor"].profile_status = "active"
    db.add(ClassMembership(class_id=graph["classroom"].id, student_id=graph["student"].id))
    account(db, "QA Other")
    personal = account(db, "QA Personal", "personal_student")
    account(db, "QA_Disabled", status="disabled")
    archived = account(db, "QA Archived")
    archived.archived_at = datetime.now(timezone.utc)
    db.flush()
    summary = page(db, "summary").summary
    assert summary == dict(
        active_students=2, active_instructors=1, active_classes=1, enrolled_students=1, eligible_memberships=1
    )
    first = page(db, "users", limit=1)
    assert first.has_more and len(first.items) == 1
    assert len(page(db, "users", offset=1, limit=50).items) == 3
    assert page(db, "users", q="%").items == []
    assert page(db, "users", q="_").items[0]["username"] == "QA_Disabled"
    assert len(page(db, "users", role="instructor").items) == 1
    assert len(page(db, "users", status="disabled").items) == 1
    assert "QA Personal" not in page(db, "users").model_dump_json()
    assert "password" not in page(db, "users").model_dump_json()
    classes = page(db, "classes").items
    assert classes[0]["eligible_memberships"] == 1
    assert classes[0]["subject"] == "Filipino"
    assert page(db, "classwork", class_id=graph["classroom"].id).items == []
    from app.models.assessments import Assignment, AssignmentVersion

    assignment = Assignment(class_id=graph["classroom"].id, instructor_id=graph["instructor"].id)
    db.add(assignment)
    db.flush()
    db.add(
        AssignmentVersion(
            assignment_id=assignment.id,
            lesson_id=graph["lesson"].id,
            version=1,
            title="Synthetic draft activity",
            instructions="Private instructions must remain excluded",
            max_attempts=None,
            curriculum_snapshot={"schema_version": 1, "context": {"lesson_name": "Pinned synthetic lesson"}},
        )
    )
    db.flush()
    activities = page(db, "classwork", class_id=graph["classroom"].id)
    assert activities.items[0]["lesson"] == "Pinned synthetic lesson"
    assert activities.items[0]["submitted_captures"] == 0
    assert "Private instructions" not in activities.model_dump_json()
    assert page(db, "speech").items == []
    assert personal.profile_status == "active"


@pytest.mark.parametrize(
    "view,domain",
    [
        ("summary", "oversight"),
        ("users", "users"),
        ("classes", "classrooms"),
        ("algorithms", "algorithms"),
        ("speech", "speech"),
        ("audit", "audit"),
    ],
)
def test_real_session_permissions_live_revocation_and_validation(db, view, domain):
    repo, client, _ = client_for(db)
    with client:
        assert client.get(BASE + "/" + view).status_code == 403
        content_permission(repo, "SyntheticAdmin", grant=True, domain=domain, access="reader")
        response = client.get(BASE + "/" + view)
        assert response.status_code == 200, response.text
        assert "no-store" in response.headers["cache-control"]
        assert response.json()["metric_version"] == "admin-school-oversight-v1"
        for params in ({"limit": 51}, {"offset": -1}, {"q": "x" * 101}, {"role": "administrator"}):
            assert client.get(BASE + "/" + view, params=params).status_code == 422
        content_permission(repo, "SyntheticAdmin", grant=False, domain=domain, access="reader")
        assert client.get(BASE + "/" + view).status_code == 403
        client.cookies.clear()
        assert client.get(BASE + "/" + view).status_code == 401
        assert client.get(BASE + "/" + view, headers={"Authorization": "Bearer invalid"}).status_code == 401
    if domain not in {"users", "oversight"}:
        with pytest.raises(ValueError):
            content_permission(repo, "SyntheticAdmin", grant=True, domain=domain, access="editor")


def test_status_change_csrf_freshness_audit_and_late_retry(db):
    user = account(db, "QA Status")
    personal = account(db, "QA Personal", "personal_student")
    onboarding = account(db, "QA Onboarding", status="onboarding")
    now = datetime.now(timezone.utc)
    session = UserSession(
        user_id=user.id,
        credential_digest="a" * 64,
        expires_at=now + timedelta(days=1),
        absolute_expires_at=now + timedelta(days=2),
    )
    db.add(session)
    db.commit()
    repo, client, csrf = client_for(db)
    content_permission(repo, "SyntheticAdmin", grant=True, domain="users", access="editor")
    content_permission(repo, "SyntheticAdmin", grant=True, domain="users", access="reader")
    headers = {
        "Origin": "http://localhost:3000",
        "X-CSRF-Token": csrf,
        "Idempotency-Key": str(uuid4()),
        "If-Match": revision(user),
    }
    path = BASE + f"/users/{user.id}/status"
    body = {"status": "disabled", "confirm": True}
    with client:
        assert client.post(path, json=body).status_code == 403
        assert client.post(path, json=body, headers={**headers, "X-CSRF-Token": "bad"}).status_code == 403
        assert client.post(path, json={**body, "role": "administrator"}, headers=headers).status_code == 422
        assert client.post(path, json={**body, "confirm": False}, headers=headers).status_code == 422
        assert (
            client.post(path, json=body, headers={k: v for k, v in headers.items() if k != "If-Match"}).status_code
            == 428
        )
        assert client.post(path, json=body, headers={**headers, "If-Match": "stale"}).status_code == 409
        for target, expected in ((personal, 404), (onboarding, 409)):
            target_path = BASE + f"/users/{target.id}/status"
            target_headers = {**headers, "Idempotency-Key": str(uuid4()), "If-Match": revision(target)}
            db.commit()
            r = client.post(target_path, json=body, headers=target_headers)
            assert r.status_code == expected, r.text
        changed = client.post(path, json=body, headers=headers)
        assert changed.status_code == 200, changed.text
        assert changed.json()["status"] == "disabled"
        db.refresh(session)
        assert session.revoked_at is not None
        db.commit()
        again_headers = {**headers, "Idempotency-Key": str(uuid4()), "If-Match": changed.json()["revision"]}
        assert client.post(path, json={"status": "active", "confirm": True}, headers=again_headers).status_code == 200
        assert client.post(path, json=body, headers=headers).json() == changed.json()
        db.refresh(user)
        assert user.profile_status == "active"  # old retry cannot undo later reactivation
        db.commit()
        assert client.post(path, json={"status": "active", "confirm": True}, headers=headers).status_code == 409
        assert personal.profile_status == "active"
        audit = db.scalars(select(AuditLog).where(AuditLog.action == "admin.school_user_status_changed")).all()
        assert len(audit) == 2


def test_export_permission_auditing_and_private_metadata_exclusion(db):
    repo, client, _ = client_for(db)
    with client:
        assert client.get(BASE + "/summary.csv").status_code == 403
        content_permission(repo, "SyntheticAdmin", grant=True, domain="oversight", access="exporter")
        content_permission(repo, "SyntheticAdmin", grant=True, domain="oversight", access="reader")
        exported = client.get(BASE + "/summary.csv")
        assert exported.status_code == 200, exported.text
        assert "active_students" in exported.text and "SyntheticAdmin" not in exported.text
        assert "no-store" in exported.headers["cache-control"]
        content_permission(repo, "SyntheticAdmin", grant=True, domain="audit", access="reader")
        audit = client.get(BASE + "/audit").json()
        assert any(row["action"] == "admin.operational_summary_exported" for row in audit["items"])
        assert "safe_metadata" not in str(audit) and "csrf" not in str(audit)
        algorithms = page(db, "algorithms")
        assert "SIMULATED" in algorithms.summary["hybrid"]
        assert "fsrs6" in algorithms.summary["registered"]
        db.commit()
        assert client.post(BASE + "/users", json={}).status_code == 405


def test_speech_provenance_excludes_personal_contexts_and_ineligible_members(db, graph):
    from app.models.ai import PronunciationActivity, PronunciationAttempt
    from app.models.learning import LearningContext

    graph["student"].profile_status = graph["instructor"].profile_status = "active"
    db.add(ClassMembership(class_id=graph["classroom"].id, student_id=graph["student"].id))
    ordinary = LearningContext(kind="classroom", student_id=graph["student"].id, class_id=graph["classroom"].id)
    personal = LearningContext(kind="personal", student_id=graph["student"].id)
    activity = PronunciationActivity(target_text="Private synthetic phrase", language="english")
    db.add_all([ordinary, personal, activity])
    db.flush()
    for context in [ordinary, personal]:
        db.add(
            PronunciationAttempt(
                context_id=context.id,
                activity_id=activity.id,
                attempted_at=datetime.now(timezone.utc),
                scoring_status="unscored",
                transcription="Private synthetic transcript",
                result={"assessment": {"simulated": True}},
                simulated=False,
            )
        )
    db.flush()
    report = page(db, "speech")
    assert len(report.items) == 1 and report.items[0]["attempt_count"] == 1
    assert report.items[0]["simulated"] is True
    assert report.summary["verified_score_average"] is None
    assert "Private synthetic" not in report.model_dump_json()
    graph["student"].profile_status = "disabled"
    db.flush()
    assert page(db, "speech").items == []


def test_algorithm_parameters_allowlist_never_exposes_artifacts_or_secrets():
    from app.modules.administration.oversight import public_parameters

    assert public_parameters(
        {
            "weights": [1, 2],
            "desired_retention": 0.9,
            "artifact_reference": "private/path",
            "api_key": "secret",
            "maximum_interval_days": float("inf"),
            "fusion_sensitivity": True,
        }
    ) == {"weights": [1, 2], "desired_retention": 0.9}
