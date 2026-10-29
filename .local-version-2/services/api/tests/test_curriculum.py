"""Read-contract/security checks; PostgreSQL persistence is tested separately, never via SQLite."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest
from sqlalchemy.dialects.postgresql import dialect

from app.core.config import Settings
from app.core.security import issue_credential, credential_digest
from app.main import create_app
from app.models.curriculum import CurriculumVersion, GradeLevel, Subject, CurriculumGrade, CurriculumSubject
from app.models.users import User, UserSession
from app.modules.administration.service import issue_session
from app.modules.curriculum.repository import (
    KINDS,
    MODELS,
    VIEWS,
    path_statement,
    visible,
    filters,
    project,
    unavailable,
)
from app.modules.curriculum.router import get_repository, get_admin_repository
from app.modules.curriculum.schemas import BrowseQuery, ClassContext, VersionView
from tests.admin_support import MemoryAdminRepository
from tests.identity_support import MemoryIdentityRepository


class ReadDouble(MemoryIdentityRepository):
    """No runtime fallback; reports service inputs, not a SQL/database emulation."""

    def __init__(self):
        super().__init__()
        self.record = VersionView(
            id=uuid4(),
            code="synthetic-fixture-only",
            name="Synthetic fixture curriculum",
            description=None,
            status="published",
            verification_status="unverified",
            published_at=None,
        )
        self.calls = []
        self.context = ClassContext(
            class_id=uuid4(), grade_level_id=uuid4(), subject_id=None, language="tagalog", requires_subject=True
        )

    def structure_read_lock(self):
        self.calls.append("structure_lock")

    def class_context(self, user, class_id):
        if class_id != self.context.class_id or user.role not in {"instructor", "school_student"}:
            raise unavailable()
        return self.context

    def rows(self, kind, parent_id, query, context, admin):
        self.calls.append((kind, parent_id, admin))
        return ([] if context and context.requires_subject else [self.record]), False

    def detail(self, kind, node_id, query, context, admin):
        self.calls.append((kind, node_id, admin))
        if node_id != self.record.id:
            raise unavailable()
        return self.record


@pytest.fixture
def setup():
    repo = ReadDouble()
    admin = MemoryAdminRepository()
    settings = Settings(_env_file=None, environment="test", database_url=None)
    app = create_app(settings)
    app.app.dependency_overrides[get_repository] = lambda: repo
    app.app.dependency_overrides[get_admin_repository] = lambda: admin
    with TestClient(app) as client:
        yield client, repo, admin


def mobile(repo, role="personal_student", **changes):
    now = datetime.now(timezone.utc)
    user = User(id=uuid4(), username="Synthetic_" + uuid4().hex[:8], role=role, profile_status="active")
    repo.add_user(user)
    token = issue_credential().raw
    session = UserSession(
        id=uuid4(),
        user_id=user.id,
        credential_digest=credential_digest(token),
        created_at=now,
        expires_at=now + timedelta(days=1),
        absolute_expires_at=now + timedelta(days=2),
    )
    for field, value in changes.items():
        setattr(session, field, value)
    repo.add_session(session)
    return {"Authorization": "Bearer " + token}


@pytest.mark.parametrize("role", ["personal_student", "school_student", "instructor"])
def test_all_mobile_roles_browse_published_structure(setup, role):
    client, repo, _ = setup
    result = client.get("/api/v1/curriculum/versions", headers=mobile(repo, role))
    assert result.status_code == 200 and result.headers["cache-control"] == "no-store"
    assert result.json()["items"][0]["verification_status"] == "unverified"
    assert repo.calls == ["structure_lock", ("versions", None, False)]
    assert result.json()["has_more"] is False


@pytest.mark.parametrize(
    "change",
    [{}, {"expires_at": datetime(2000, 1, 1, tzinfo=timezone.utc)}, {"revoked_at": datetime.now(timezone.utc)}],
)
def test_mobile_anonymous_expired_and_revoked(setup, change):
    client, repo, _ = setup
    headers = mobile(repo, **change) if change else {}
    assert client.get("/api/v1/curriculum/versions", headers=headers).status_code == 401
    assert not repo.calls


@pytest.mark.parametrize(
    "query",
    ["limit=0", "limit=101", "offset=-1", "grade=13", "grade=0", "subject_id=bad", "class_id=bad", "language=filipino"],
)
def test_query_bounds_and_unknown_fields_are_rejected(setup, query):
    client, repo, _ = setup
    response = client.get("/api/v1/curriculum/versions?" + query, headers=mobile(repo))
    assert response.status_code == 422
    assert not repo.calls


def test_no_mobile_draft_filter_or_admin_cookie_fallback(setup):
    client, repo, admin = setup
    token = issue_session(admin, "https://id.example", "approved-subject")
    client.cookies.set("fluentt_admin", token)
    assert client.get("/api/v1/curriculum/versions").status_code == 401
    assert client.get("/api/v1/curriculum/versions?status=draft", headers=mobile(repo)).status_code == 422
    assert not repo.calls


def test_admin_requires_explicit_live_permission_and_rejects_mobile_bearer(setup):
    client, repo, admin = setup
    assert client.get("/api/v1/admin/curriculum/versions", headers=mobile(repo)).status_code == 401
    token = issue_session(admin, "https://id.example", "approved-subject")
    client.cookies.set("fluentt_admin", token)
    assert client.get("/api/v1/admin/curriculum/versions").status_code == 403
    admin.granted.add("curriculum.read")
    result = client.get("/api/v1/admin/curriculum/versions?status=draft")
    assert result.status_code == 200 and repo.calls[-1][-1] is True
    admin.granted.remove("curriculum.read")
    assert client.get("/api/v1/admin/curriculum/versions").status_code == 403
    admin.granted.add("curriculum.read")
    admin.account.profile_status = "disabled"
    assert client.get("/api/v1/admin/curriculum/versions").status_code == 401


def test_class_empty_state_no_subject_inference_and_private_denial(setup):
    client, repo, _ = setup
    headers = mobile(repo, "school_student")
    response = client.get(f"/api/v1/curriculum/versions?class_id={repo.context.class_id}", headers=headers)
    assert response.status_code == 200 and response.json()["items"] == []
    context = response.json()["class_context"]
    assert context["language"] == "tagalog" and context["subject_id"] is None and context["requires_subject"]
    assert client.get(f"/api/v1/curriculum/versions?class_id={uuid4()}", headers=headers).status_code == 404
    assert (
        client.get(f"/api/v1/curriculum/versions?class_id={repo.context.class_id}", headers=mobile(repo)).status_code
        == 404
    )


def test_detail_missing_and_read_only_routes(setup):
    client, repo, _ = setup
    headers = mobile(repo)
    assert client.get(f"/api/v1/curriculum/versions/{uuid4()}", headers=headers).status_code == 404
    assert client.get(f"/api/v1/curriculum/versions/{repo.record.id}", headers=headers).status_code == 200
    assert client.post("/api/v1/curriculum/versions", headers=headers, json={}).status_code == 405


@pytest.mark.parametrize("depth", range(7))
def test_actual_queries_recheck_all_published_ancestors_and_context(depth):
    query = BrowseQuery(grade=3, subject_id=uuid4())
    context = ClassContext(
        class_id=uuid4(),
        grade_level_id=uuid4(),
        subject_id=query.subject_id,
        language="tagalog",
        requires_subject=False,
    )
    statement = path_statement(depth).where(*visible(depth), *filters(depth, query, context))
    sql = str(statement.compile(dialect=dialect(), compile_kwargs={"literal_binds": True}))
    assert "curriculum_versions.status = 'published'" in sql
    assert "grade_levels.number = 3" in sql and str(context.grade_level_id) in sql
    assert str(query.subject_id) in sql
    if depth >= 4:
        assert "curriculum_topics.status = 'published'" in sql
    if depth >= 5:
        assert "lessons.status = 'published'" in sql and "lessons.archived_at IS NULL" in sql


def test_projection_excludes_private_provenance_and_all_delivery_payloads():
    root = CurriculumVersion(
        id=uuid4(),
        code="synthetic",
        name="Fixture",
        description=None,
        status="published",
        verification_status="unverified",
        source_metadata={"private": "must-not-appear"},
    )
    grade = GradeLevel(id=uuid4(), number=3, name="Fixture grade")
    cg = CurriculumGrade(id=uuid4(), curriculum_version_id=root.id, grade_level_id=grade.id)
    subject = Subject(id=uuid4(), code="synthetic-filipino", name="Filipino", description=None)
    cs = CurriculumSubject(id=uuid4(), curriculum_grade_id=cg.id, subject_id=subject.id)
    row = SimpleNamespace(
        _mapping={
            CurriculumVersion: root,
            GradeLevel: grade,
            CurriculumGrade: cg,
            Subject: subject,
            CurriculumSubject: cs,
        }
    )
    assert "must-not-appear" not in project("versions", row).model_dump_json()
    assert project("subjects", row).name == "Filipino"
    for view in VIEWS:
        assert not {"source_metadata", "configuration", "prompt", "content", "answer_key", "research_id"} & set(
            view.model_fields
        )
    assert len(KINDS) == len(MODELS) == 7


def test_anonymous_protected_routes_no_database_required():
    with TestClient(create_app(Settings(_env_file=None, database_url=None))) as client:
        assert client.get("/api/v1/curriculum/versions").status_code == 401
        assert client.get("/api/v1/admin/curriculum/versions").status_code == 401


def test_admin_cannot_use_curriculum_permission_to_read_class_context(setup):
    client, repo, admin = setup
    admin.granted.add("curriculum.read")
    client.cookies.set("fluentt_admin", issue_session(admin, "https://id.example", "approved-subject"))
    assert client.get(f"/api/v1/admin/curriculum/versions?class_id={repo.context.class_id}").status_code == 422
    assert client.get(f"/api/v1/admin/curriculum/grades/{uuid4()}?status=published").status_code == 422
    assert not repo.calls


def test_new_contracts_expose_only_get_operations():
    paths = create_app(Settings(_env_file=None, database_url=None)).app.openapi()["paths"]
    curriculum = {path: methods for path, methods in paths.items() if "/curriculum/" in path and "/manage/" not in path}
    assert len(curriculum) == 28
    assert all(set(methods) == {"get"} for methods in curriculum.values())
