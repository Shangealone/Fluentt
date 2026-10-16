from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from app.core.config import Settings
from app.main import create_app
from app.modules.identity.dependencies import get_identity_repository
from app.modules.classrooms.router import get_classroom_repository
from app.modules.classrooms import service
from tests.classroom_support import MemoryClassroomRepository


@pytest.fixture
def classroom_api():
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=None,
        user_creation_limit=1000,
        class_creation_limit=1000,
        mobile_session_request_limit=1000,
    )
    app = create_app(settings)
    repo = MemoryClassroomRepository()
    app.app.dependency_overrides[get_identity_repository] = lambda: repo
    app.app.dependency_overrides[get_classroom_repository] = lambda: repo
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, repo


def account(client, role="instructor"):
    response = client.post("/api/v1/users", json={"username": "Teacher_" + uuid4().hex[:12], "role": role})
    assert response.status_code == 201
    return {"Authorization": "Bearer " + response.json()["session"]["credential"]}


def payload(**changes):
    return {
        "class_name": " Grade 5 English A ",
        "grade_level": 5,
        "language": "english",
        "description": " Vocabulary practice ",
        **changes,
    }


def create(client, headers, body=None, key=None):
    return client.post(
        "/api/v1/classes", headers={**headers, "Idempotency-Key": str(key or uuid4())}, json=body or payload()
    )


def test_create_multiple_list_details_and_restore(classroom_api, monkeypatch):
    client, repo = classroom_api
    headers = account(client)
    assert client.get("/api/v1/sessions/me", headers=headers).json()["onboarding_step"] == "first_class"
    monkeypatch.setattr(service, "generate_code", lambda: "000001")
    first = create(client, headers)
    assert first.status_code == 201
    row = first.json()
    assert row["join_code"] == "000001" and row["class_name"] == "Grade 5 English A"
    assert row["description"] == "Vocabulary practice" and row["status"] == "active"
    assert first.headers["Cache-Control"] == "no-store"
    assert "credential" not in row and "instructor_id" not in row
    assert client.get("/api/v1/classes/" + row["id"], headers=headers).json() == row
    assert client.get("/api/v1/sessions/me", headers=headers).json()["profile_status"] == "active"
    monkeypatch.setattr(service, "generate_code", lambda: "999999")
    second = create(client, headers, payload(class_name="Second class", grade_level=12, language="tagalog"))
    assert second.status_code == 201 and second.json()["id"] != row["id"]
    listed = client.get("/api/v1/classes/mine", headers=headers).json()
    assert len(listed) == 2 and {r["join_code"] for r in listed} == {"000001", "999999"}
    assert len(client.get("/api/v1/classes/mine?limit=1&offset=1", headers=headers).json()) == 1
    assert len(repo.classes) == 2


@pytest.mark.parametrize("role", ["school_student", "personal_student"])
def test_students_denied_all_management(classroom_api, role):
    client, _ = classroom_api
    headers = account(client, role)
    assert create(client, headers).status_code == 403
    assert client.get("/api/v1/classes/mine", headers=headers).status_code == 403
    assert client.get(f"/api/v1/classes/{uuid4()}", headers=headers).status_code == 403
    assert client.patch(f"/api/v1/classes/{uuid4()}", headers=headers, json={"class_name": "Other"}).status_code == 403


def test_unauthenticated_expired_revoked_and_cross_owner(classroom_api):
    client, repo = classroom_api
    assert create(client, {}).status_code == 401
    first, second = account(client), account(client)
    row = create(client, first).json()
    assert client.get("/api/v1/classes/mine", headers=second).json() == []
    path = "/api/v1/classes/" + row["id"]
    for unknown in (row["id"], str(uuid4())):
        assert client.get("/api/v1/classes/" + unknown, headers=second).status_code == 404
        assert (
            client.patch("/api/v1/classes/" + unknown, headers=second, json={"class_name": "Other"}).status_code == 404
        )
    client.post("/api/v1/sessions/revoke", headers=first)
    assert client.get(path, headers=first).status_code == 401
    assert create(client, first).status_code == 401


@pytest.mark.parametrize(
    "change",
    [
        {"class_name": ""},
        {"class_name": "   "},
        {"class_name": "a" * 151},
        {"class_name": 3},
        {"grade_level": 0},
        {"grade_level": 13},
        {"grade_level": "5"},
        {"grade_level": True},
        {"language": "filipino"},
        {"description": "x" * 501},
        {"instructor_id": str(uuid4())},
        {"join_code": "123456"},
        {"status": "active"},
    ],
)
def test_invalid_creation(classroom_api, change):
    client, repo = classroom_api
    assert create(client, account(client), payload(**change)).status_code == 422
    assert not repo.classes and not repo.codes


def test_idempotent_request_and_conflicting_body(classroom_api):
    client, repo = classroom_api
    headers = account(client)
    key = uuid4()
    first = create(client, headers, key=key)
    assert create(client, headers, key=key).json() == first.json()
    assert create(client, headers, payload(class_name="Changed"), key).status_code == 409
    assert len(repo.classes) == len(repo.codes) == 1
    assert client.post("/api/v1/classes", headers=headers, json=payload()).status_code == 422


def test_collisions_retry_and_exhaustion_roll_back_everything(classroom_api, monkeypatch):
    client, repo = classroom_api
    headers = account(client)
    monkeypatch.setattr(service, "generate_code", lambda: "000007")
    assert create(client, headers).status_code == 201
    codes = iter(["000007", "000008"])
    monkeypatch.setattr(service, "generate_code", lambda: next(codes))
    assert create(client, headers).json()["join_code"] == "000008"
    new_headers = account(client)
    monkeypatch.setattr(service, "generate_code", lambda: "000007")
    failure = create(client, new_headers)
    assert failure.status_code == 503 and len(repo.classes) == 2 and len(repo.codes) == 2
    assert client.get("/api/v1/sessions/me", headers=new_headers).json()["onboarding_step"] == "first_class"


def test_unexpected_code_failure_rolls_back(classroom_api):
    client, repo = classroom_api
    headers = account(client)
    repo.fail_code = True
    assert create(client, headers).status_code == 500
    assert not repo.classes and not repo.codes
    assert client.get("/api/v1/sessions/me", headers=headers).json()["onboarding_step"] == "first_class"


def test_metadata_edit_keeps_code_and_context_changes_are_guarded(classroom_api):
    client, repo = classroom_api
    headers = account(client)
    row = create(client, headers).json()
    path = "/api/v1/classes/" + row["id"]
    saved = client.patch(
        path,
        headers=headers,
        json={"class_name": " Renamed ", "description": None, "grade_level": 1, "language": "tagalog"},
    )
    assert saved.status_code == 200 and saved.json()["join_code"] == row["join_code"]
    assert saved.json()["class_name"] == "Renamed" and saved.json()["description"] is None
    repo.contexts.add(next(iter(repo.classes)))
    assert client.patch(path, headers=headers, json={"grade_level": 2}).status_code == 409
    assert client.patch(path, headers=headers, json={"language": "english"}).status_code == 409
    assert client.patch(path, headers=headers, json={"class_name": "Still allowed"}).status_code == 200
    assert client.patch(path, headers=headers, json={"instructor_id": str(uuid4())}).status_code == 422
    assert client.patch(path, headers=headers, json={"class_name": None}).status_code == 422


def test_code_generator_secure_format_and_leading_zeros(monkeypatch):
    monkeypatch.setattr(service.secrets, "randbelow", lambda bound: 42 if bound == 1_000_000 else None)
    assert service.generate_code() == "000042"


@pytest.mark.parametrize("reason", ["expired", "disabled", "archived"])
def test_invalidated_instructor_cannot_manage(classroom_api, reason):
    from datetime import datetime, timedelta, timezone
    from app.core.security import credential_digest

    client, repo = classroom_api
    headers = account(client)
    record = repo.sessions[credential_digest(headers["Authorization"].split(" ", 1)[1])]
    user = next(user for user in repo.users.values() if user.id == record.user_id)
    if reason == "expired":
        record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    elif reason == "disabled":
        user.profile_status = "disabled"
    else:
        user.archived_at = datetime.now(timezone.utc)
    assert create(client, headers).status_code == 401
    assert client.get("/api/v1/classes/mine", headers=headers).status_code == 401
    assert not repo.classes


def test_creation_rate_limit_and_inactive_code_nonreuse(classroom_api, monkeypatch):
    client, repo = classroom_api
    headers = account(client)
    monkeypatch.setattr(service, "generate_code", lambda: "000004")
    assert create(client, headers).status_code == 201
    repo.codes["000004"].status = "expired"
    assert create(client, headers).status_code == 503
    assert len(repo.classes) == 1
    client.app.app.state.settings.class_creation_limit = 1
    limited = create(client, headers)
    assert limited.status_code == 429 and "Retry-After" in limited.headers
