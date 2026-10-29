from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.modules.classrooms.router import get_classroom_repository
from app.modules.enrollment.router import get_enrollment_repository
from app.modules.identity.dependencies import get_identity_repository
from tests.enrollment_support import MemoryEnrollmentRepository
from tests.test_classrooms import account, create

PREVIEW = "/api/v1/class-enrollment-previews"
JOIN = "/api/v1/class-memberships"
MINE = JOIN + "/mine"


@pytest.fixture
def enrollment_api():
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=None,
        user_creation_limit=1000,
        class_creation_limit=1000,
        enrollment_peer_limit=1000,
        enrollment_session_limit=1000,
        mobile_session_request_limit=1000,
    )
    app = create_app(settings)
    repo = MemoryEnrollmentRepository()
    for dependency in (get_identity_repository, get_classroom_repository, get_enrollment_repository):
        app.app.dependency_overrides[dependency] = lambda: repo
    with TestClient(app, raise_server_exceptions=False) as client:
        owner = account(client)
        classroom = create(client, owner).json()
        student = account(client, "school_student")
        yield client, repo, student, classroom, owner


def preview(client, student, classroom):
    return client.post(PREVIEW, headers=student, json={"code": classroom["join_code"]})


def body(client, student, classroom):
    return {
        "code": classroom["join_code"],
        "class_version": preview(client, student, classroom).json()["class_version"],
    }


def test_explicit_confirmation_multiple_classes_restore_and_privacy(enrollment_api):
    client, repo, student, classroom, owner = enrollment_api
    assert client.get("/api/v1/sessions/me", headers=student).json()["profile_status"] == "onboarding"
    response = preview(client, student, classroom)
    assert response.status_code == 200
    assert set(response.json()) == {"class_name", "grade_level", "language", "instructor_display_name", "class_version"}
    assert response.headers["cache-control"] == "no-store"
    assert not repo.memberships
    request = {"code": classroom["join_code"], "class_version": response.json()["class_version"]}
    first = client.post(JOIN, headers=student, json=request)
    assert first.status_code == 200 and first.headers["cache-control"] == "no-store"
    assert client.post(JOIN, headers=student, json=request).json() == first.json()
    assert len(repo.memberships) == len(repo.audit) == 1
    another = create(client, owner).json()
    assert client.post(JOIN, headers=student, json=body(client, student, another)).status_code == 200
    rows = client.get(MINE, headers=student).json()
    assert {row["class_id"] for row in rows} == {classroom["id"], another["id"]}
    assert len(client.get(MINE + "?limit=1&offset=1", headers=student).json()) == 1
    assert set(rows[0]) == {
        "id",
        "class_id",
        "joined_at",
        "status",
        "class_name",
        "grade_level",
        "language",
        "instructor_display_name",
    }
    assert client.get("/api/v1/sessions/me", headers=student).json()["onboarding_step"] is None
    outsider = account(client, "school_student")
    assert client.get(MINE, headers=outsider).json() == []
    assert client.get("/api/v1/classes/" + classroom["id"], headers=student).status_code == 403
    assert client.get(MINE + "?student_id=" + str(uuid4()), headers=outsider).json() == []
    assert len(repo.users) == 3  # teacher, student, outsider; enrollment creates no identity


@pytest.mark.parametrize("value", ["", "12345", "1234567", "12 345", "１２３４５６", "12345a", 123456, None])
def test_malformed_codes_rejected(enrollment_api, value):
    client, repo, student, _, _ = enrollment_api
    response = client.post(PREVIEW, headers=student, json={"code": value})
    assert response.status_code == 422 and response.headers["cache-control"] == "no-store"
    assert not repo.memberships


def test_leading_zero_unknown_and_tampering(enrollment_api):
    client, repo, student, classroom, _ = enrollment_api
    code = repo.codes.pop(classroom["join_code"])
    code.code = "000001"
    repo.codes[code.code] = code
    classroom["join_code"] = code.code
    assert preview(client, student, classroom).status_code == 200
    assert client.post(PREVIEW, headers=student, json={"code": "999999"}).status_code == 404
    request = body(client, student, classroom)
    assert client.post(JOIN, headers=student, json={**request, "class_version": "f" * 64}).status_code == 409
    assert client.post(JOIN, headers=student, json={**request, "class_id": str(uuid4())}).status_code == 422
    assert client.post(JOIN, headers=student, json={"code": code.code}).status_code == 422
    assert not repo.memberships


@pytest.mark.parametrize(
    "state", ["expired", "revoked", "deadline", "archived_class", "archived_at", "disabled_owner", "archived_owner"]
)
def test_unavailable_between_preview_and_confirmation(enrollment_api, state):
    client, repo, student, classroom, _ = enrollment_api
    request = body(client, student, classroom)
    code = repo.codes[classroom["join_code"]]
    row = repo.classes[UUID(classroom["id"])]
    owner = next(user for user in repo.users.values() if user.id == row.instructor_id)
    if state == "deadline":
        code.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    elif state == "archived_class":
        row.status = "archived"
    elif state == "archived_at":
        row.archived_at = datetime.now(timezone.utc)
    elif state.endswith("owner"):
        owner.profile_status = state.split("_")[0]
    else:
        code.status = state
    unavailable = client.post(JOIN, headers=student, json=request)
    assert unavailable.status_code == 404
    assert preview(client, student, classroom).json()["error"]["code"] == "invitation_unavailable"
    assert not repo.memberships


def test_changed_preview_requires_review(enrollment_api):
    client, repo, student, classroom, owner = enrollment_api
    request = body(client, student, classroom)
    client.patch("/api/v1/classes/" + classroom["id"], headers=owner, json={"language": "tagalog"})
    assert client.post(JOIN, headers=student, json=request).status_code == 409
    assert not repo.memberships
    assert client.post(JOIN, headers=student, json=body(client, student, classroom)).status_code == 200
    assert client.patch("/api/v1/classes/" + classroom["id"], headers=owner, json={"grade_level": 6}).status_code == 409


@pytest.mark.parametrize("role", ["personal_student", "instructor"])
def test_wrong_role_denied(enrollment_api, role):
    client, _, student, classroom, _ = enrollment_api
    request = body(client, student, classroom)
    headers = account(client, role)
    assert client.post(PREVIEW, headers=headers, json={"code": request["code"]}).status_code == 403
    assert client.post(JOIN, headers=headers, json=request).status_code == 403
    assert client.get(MINE, headers=headers).status_code == 403


@pytest.mark.parametrize("state", ["missing", "expired", "absolute", "revoked", "disabled", "archived"])
def test_session_enforced_everywhere(enrollment_api, state):
    client, repo, student, classroom, _ = enrollment_api
    request = body(client, student, classroom)
    session = list(repo.sessions.values())[-1]
    user = next(user for user in repo.users.values() if user.id == session.user_id)
    before = datetime.now(timezone.utc) - timedelta(seconds=1)
    if state == "missing":
        student = {}
    elif state == "expired":
        session.expires_at = before
    elif state == "absolute":
        session.absolute_expires_at = before
    elif state == "revoked":
        session.revoked_at = before
    else:
        user.profile_status = state
    assert client.post(PREVIEW, headers=student, json={"code": request["code"]}).status_code == 401
    assert client.post(JOIN, headers=student, json=request).status_code == 401
    assert client.get(MINE, headers=student).status_code == 401


def test_left_can_rejoin_removed_cannot_and_restoration_rechecks(enrollment_api):
    client, repo, student, classroom, _ = enrollment_api
    request = body(client, student, classroom)
    first = client.post(JOIN, headers=student, json=request).json()
    row = repo.memberships[UUID(first["id"])]
    row.status = "left"
    row.ended_at = datetime.now(timezone.utc)
    assert client.get("/api/v1/sessions/me", headers=student).json()["profile_status"] == "onboarding"
    assert client.post(JOIN, headers=student, json=request).status_code == 409
    second = client.post(JOIN, headers=student, json=body(client, student, classroom)).json()
    assert second["id"] != first["id"] and len(repo.memberships) == 2
    active = repo.memberships[UUID(second["id"])]
    active.status = "removed"
    active.ended_at = datetime.now(timezone.utc)
    assert preview(client, student, classroom).status_code == 404
    assert client.post(JOIN, headers=student, json=request).status_code == 404
    assert client.get(MINE, headers=student).json() == []


def test_atomic_rollback_and_concurrent_retry(enrollment_api):
    client, repo, student, classroom, _ = enrollment_api
    request = body(client, student, classroom)
    repo.fail_enroll = True
    assert client.post(JOIN, headers=student, json=request).status_code == 500
    assert not repo.memberships and not repo.audit
    assert client.get("/api/v1/sessions/me", headers=student).json()["profile_status"] == "onboarding"
    repo.fail_enroll = False
    barrier = Barrier(2)

    def submit():
        barrier.wait(timeout=5)
        return client.post(JOIN, headers=student, json=request)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: submit(), range(2)))
    assert all(result.status_code == 200 for result in results)
    assert results[0].json() == results[1].json() and len(repo.memberships) == len(repo.audit) == 1


def test_peer_and_session_throttles_and_safe_logs(enrollment_api, caplog):
    client, repo, student, classroom, _ = enrollment_api
    settings = client.app.app.state.settings
    settings.enrollment_session_limit = 1
    assert preview(client, student, classroom).status_code == 200
    limited = preview(client, student, classroom)
    assert limited.status_code == 429 and "retry-after" in limited.headers
    other = account(client, "school_student")
    assert preview(client, other, classroom).status_code == 200
    settings.enrollment_peer_limit = 1
    assert preview(client, other, classroom).status_code == 429
    assert classroom["join_code"] not in caplog.text
    assert student["Authorization"] not in caplog.text
    assert not repo.memberships


def test_restore_filters_archived_classes_and_unavailable_owners(enrollment_api):
    client, repo, student, classroom, owner = enrollment_api
    client.post(JOIN, headers=student, json=body(client, student, classroom))
    second = create(client, owner).json()
    client.post(JOIN, headers=student, json=body(client, student, second))
    repo.classes[UUID(classroom["id"])].status = "archived"
    assert len(client.get(MINE, headers=student).json()) == 1
    assert client.get("/api/v1/sessions/me", headers=student).json()["profile_status"] == "active"
    teacher = next(user for user in repo.users.values() if user.role == "instructor")
    teacher.profile_status = "disabled"
    assert client.get(MINE, headers=student).json() == []
    assert client.get("/api/v1/sessions/me", headers=student).json()["profile_status"] == "onboarding"


def test_preview_for_another_class_is_not_authorization(enrollment_api):
    client, repo, student, classroom, owner = enrollment_api
    request = body(client, student, classroom)
    second = create(client, owner).json()
    assert client.post(JOIN, headers=student, json={**request, "code": second["join_code"]}).status_code == 409
    assert not repo.memberships
    client.post(JOIN, headers=student, json=request)
    assert (
        client.patch(
            "/api/v1/classes/" + classroom["id"], headers=student, json={"class_name": "Forbidden"}
        ).status_code
        == 403
    )


def test_runtime_without_database_fails_closed():
    from app.core.security import issue_credential

    settings = Settings(_env_file=None, environment="test", database_url=None)
    with TestClient(create_app(settings)) as client:
        headers = {"Authorization": "Bearer " + issue_credential().raw}
        assert client.post(PREVIEW, headers=headers, json={"code": "000001"}).status_code == 503
        assert client.post(JOIN, headers=headers, json={"code": "000001", "class_version": "a" * 64}).status_code == 503
        assert client.get(MINE, headers=headers).status_code == 503
