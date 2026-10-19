"""Real management HTTP contracts using synthetic admin identities in the UUID test DB."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.models.curriculum import CurriculumVersion
from app.models.operations import AuditLog
from app.modules.administration.cli import provision, curriculum_permission, revoke
from app.modules.administration.repository import AdminRepository
from app.modules.administration.service import issue_session, resolve_session
from tests.integration.conftest import pg_engine as disposable_engine_fixture

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/admin/curriculum/manage"


@pytest.fixture
def manager(management_engine):
    pg_engine = management_engine
    name = "Fixture_" + uuid4().hex[:12]
    subject = uuid4().hex
    with Session(pg_engine) as db:
        repo = AdminRepository(db)
        provision(repo, name, "https://id.example", subject)
        curriculum_permission(repo, name, grant=True, access="editor")
        curriculum_permission(repo, name, grant=True, access="publisher")
        token = issue_session(repo, "https://id.example", subject)
        profile = resolve_session(repo, token)
    settings = Settings(
        _env_file=None, environment="test", database_url=pg_engine.url.render_as_string(hide_password=False)
    )
    with TestClient(create_app(settings)) as client:
        client.cookies.set("fluentt_admin", token)
        client.headers.update({"Origin": settings.admin_web_origin, "X-CSRF-Token": profile.csrf_token})
        yield client, name, pg_engine


@pytest.fixture(scope="module")
def management_engine():
    # Published API fixtures deliberately persist. Keep them out of the older
    # shared database whose migration round-trip test requires no frozen roots.
    yield from disposable_engine_fixture.__wrapped__()


def create(client, kind, values, parent=None):
    headers = {"If-Match": parent["revision"]} if parent else {}
    body = {"values": values}
    if parent:
        body["parent_id"] = parent["id"]
    result = client.post(f"{BASE}/{kind}", headers=headers, json=body)
    assert result.status_code == 201, result.text
    return result.json()


def get(client, node):
    response = client.get(f"{BASE}/{node['kind']}/{node['id']}")
    assert response.status_code == 200, response.text
    return response.json()


def hierarchy(client):
    version = create(client, "versions", {"code": "fixture-" + uuid4().hex, "name": "Synthetic edition"})
    global_subject = create(
        client, "global-subjects", {"code": "fixture-" + uuid4().hex[:12], "name": "Synthetic Filipino subject"}
    )
    grade = create(client, "grades", {"number": 8}, version)
    subject = create(client, "subjects", {"subject_id": global_subject["id"]}, grade)
    quarter = create(client, "quarters", {"number": 1, "name": "Synthetic quarter"}, subject)
    topic = create(client, "topics", {"position": 1, "name": "Synthetic topic"}, quarter)
    lesson = create(client, "lessons", {"position": 1, "name": "Synthetic lesson"}, topic)
    competency = create(client, "competencies", {"position": 1, "description": "Synthetic fixture competency"}, lesson)
    return [get(client, node) for node in [version, grade, subject, quarter, topic, lesson, competency, global_subject]]


REVIEW = {
    "confirmed": True,
    "source_reference": "Synthetic fixture source",
    "licensing_reference": "Test-only fixture",
    "review_note": "Synthetic administrative review; no academic verification",
}


def test_complete_publish_read_visibility_retire_and_immutability(manager):
    client, _, engine = manager
    nodes = hierarchy(client)
    version, grade, subject, quarter, topic, lesson, competency, global_subject = nodes
    mobile = client.post("/api/v1/users", json={"username": "Fixture_" + uuid4().hex[:12], "role": "personal_student"})
    headers = {"Authorization": "Bearer " + mobile.json()["session"]["credential"]}
    mobile_path = f"/api/v1/curriculum/versions/{version['id']}"
    assert client.get(mobile_path, headers=headers).status_code == 404
    published = client.post(
        f"{BASE}/versions/{version['id']}/publish", headers={"If-Match": version["revision"]}, json=REVIEW
    )
    assert published.status_code == 200, published.text
    result = published.json()
    assert result["values"]["status"] == "published" and result["values"]["published_at"]
    assert result["values"]["verification_status"] == "unverified" and result["frozen"]
    assert get(client, lesson)["values"]["status"] == "published"
    assert client.get(mobile_path, headers=headers).status_code == 200
    assert client.get(f"/api/v1/curriculum/lessons/{lesson['id']}", headers=headers).status_code == 200
    assert "review_note" not in client.get(f"/api/v1/admin/curriculum/versions/{version['id']}").text
    for node in [version, lesson, global_subject]:
        fresh = get(client, node)
        assert (
            client.patch(
                f"{BASE}/{node['kind']}/{node['id']}",
                headers={"If-Match": fresh["revision"]},
                json={"values": {"name": "Changed"}},
            ).status_code
            == 409
        )
        assert (
            client.delete(f"{BASE}/{node['kind']}/{node['id']}", headers={"If-Match": fresh["revision"]}).status_code
            == 409
        )
    retired = client.post(f"{BASE}/versions/{version['id']}/retire", headers={"If-Match": result["revision"]})
    assert retired.status_code == 200 and retired.json()["values"]["status"] == "archived"
    assert client.get(mobile_path, headers=headers).status_code == 404
    assert (
        client.post(
            f"{BASE}/versions/{version['id']}/publish", headers={"If-Match": retired.json()["revision"]}, json=REVIEW
        ).status_code
        == 409
    )
    with Session(engine) as db:
        stored = db.get(CurriculumVersion, version["id"])
        assert stored.source_metadata["administrative_review"]["review_note"] == REVIEW["review_note"]
        assert list(db.scalars(select(AuditLog).where(AuditLog.entity_id == stored.id, AuditLog.actor_id.is_not(None))))


def test_empty_publication_and_review_validation(manager):
    client, _, _ = manager
    version = create(client, "versions", {"code": "fixture-" + uuid4().hex, "name": "Synthetic incomplete"})
    path = f"{BASE}/versions/{version['id']}/publish"
    assert client.post(path, headers={"If-Match": version["revision"]}, json=REVIEW).status_code == 409
    for body in [{}, REVIEW | {"confirmed": False}, REVIEW | {"confirmed": 1}, REVIEW | {"review_note": " "}]:
        assert client.post(path, headers={"If-Match": version["revision"]}, json=body).status_code == 422


def test_updates_duplicates_delete_references_and_stale_revision(manager):
    client, _, _ = manager
    nodes = hierarchy(client)
    version, grade, subject, quarter, topic, lesson, competency, _ = nodes
    path = f"{BASE}/lessons/{lesson['id']}"
    updated = client.patch(
        path, headers={"If-Match": lesson["revision"]}, json={"values": {"name": "Synthetic corrected"}}
    )
    assert updated.status_code == 200
    assert (
        client.patch(path, headers={"If-Match": lesson["revision"]}, json={"values": {"name": "Stale"}}).status_code
        == 409
    )
    assert client.patch(path, json={"values": {"name": "Missing revision"}}).status_code == 428
    assert client.delete(path, headers={"If-Match": updated.json()["revision"]}).status_code == 409
    topic = get(client, topic)
    duplicate = client.post(
        f"{BASE}/lessons",
        headers={"If-Match": topic["revision"]},
        json={"parent_id": topic["id"], "values": {"name": "Duplicate", "position": 1}},
    )
    assert duplicate.status_code == 409
    competency = get(client, competency)
    assert (
        client.delete(
            f"{BASE}/competencies/{competency['id']}", headers={"If-Match": competency["revision"]}
        ).status_code
        == 200
    )
    lesson = get(client, lesson)
    assert client.delete(path, headers={"If-Match": lesson["revision"]}).status_code == 200
    assert client.get(path).status_code == 404


def test_permissions_csrf_origin_revocation_and_no_implicit_grants(manager):
    client, name, engine = manager
    body = {"values": {"code": "fixture-" + uuid4().hex, "name": "Synthetic restricted"}}
    assert client.post(f"{BASE}/versions", json=body, headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post(f"{BASE}/versions", json=body, headers={"X-CSRF-Token": "bad"}).status_code == 403
    assert (
        client.post(f"{BASE}/versions", json=body, headers={"Authorization": "Bearer flt_invalid"}).status_code == 401
    )
    with Session(engine) as db:
        repo = AdminRepository(db)
        curriculum_permission(repo, name, grant=False, access="editor")
    assert client.get(f"{BASE}/versions").status_code == 200  # Publisher retains read, not write.
    assert client.post(f"{BASE}/versions", json=body).status_code == 403
    with Session(engine) as db:
        revoke(AdminRepository(db), name)
    assert client.get(f"{BASE}/versions").status_code == 401


def test_publisher_permission_required_even_for_editor(manager):
    client, name, engine = manager
    version = hierarchy(client)[0]
    with Session(engine) as db:
        curriculum_permission(AdminRepository(db), name, grant=False, access="publisher")
    assert (
        client.post(
            f"{BASE}/versions/{version['id']}/publish", headers={"If-Match": version["revision"]}, json=REVIEW
        ).status_code
        == 403
    )


def test_concurrent_updates_have_one_winner(manager):
    client, _, _ = manager
    version = create(client, "versions", {"code": "fixture-" + uuid4().hex, "name": "Synthetic concurrent"})
    barrier = Barrier(2)

    def submit(name):
        barrier.wait(timeout=10)
        return client.patch(
            f"{BASE}/versions/{version['id']}",
            headers={"If-Match": version["revision"]},
            json={"values": {"name": name}},
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(submit, ["Synthetic A", "Synthetic B"])) == [200, 409]


def test_search_pagination_invalid_fields_parent_and_moving(manager):
    client, _, _ = manager
    nodes = hierarchy(client)
    version, grade, subject, quarter, topic, lesson, competency, _ = nodes
    other_topic = create(client, "topics", {"name": "Synthetic destination", "position": 2}, quarter)
    lesson = get(client, lesson)
    path = f"{BASE}/lessons/{lesson['id']}"
    assert (
        client.patch(
            path, headers={"If-Match": lesson["revision"]}, json={"parent_id": other_topic["id"], "values": {}}
        ).status_code
        == 428
    )
    moved = client.patch(
        path,
        headers={"If-Match": lesson["revision"]},
        json={"parent_id": other_topic["id"], "target_revision": other_topic["revision"], "values": {}},
    )
    assert moved.status_code == 200 and moved.json()["parent_id"] == other_topic["id"]
    response = client.get(f"{BASE}/topics", params={"parent_id": quarter["id"], "q": "destination", "limit": 1})
    assert response.status_code == 200 and len(response.json()["items"]) == 1
    for values in [{"name": "Injected", "status": "published"}, {"position": 0}, {"position": True}]:
        assert (
            client.patch(path, headers={"If-Match": moved.json()["revision"]}, json={"values": values}).status_code
            == 422
        )
    assert client.get(f"{BASE}/versions?limit=101").status_code == 422
    assert client.get(f"{BASE}/versions?unknown=value").status_code == 422
    assert client.get(f"{BASE}/lessons").status_code == 422


def test_existing_dashboard_only_admin_gains_no_authoring_permission(manager):
    client, _, engine = manager
    name = "Fixture_" + uuid4().hex[:12]
    with Session(engine) as db:
        repo = AdminRepository(db)
        provision(repo, name, "https://id.example", name)
        token = issue_session(repo, "https://id.example", name)
        profile = resolve_session(repo, token)
        assert profile.permissions == ["dashboard.view"]
    headers = {"Cookie": "fluentt_admin=" + token, "X-CSRF-Token": profile.csrf_token}
    assert client.get(f"{BASE}/versions", headers=headers).status_code == 403
    assert (
        client.post(
            f"{BASE}/versions", headers=headers, json={"values": {"name": "Synthetic", "code": name}}
        ).status_code
        == 403
    )


def test_incomplete_added_branch_blocks_publish_and_global_subject_changes_stale_drafts(manager):
    client, _, _ = manager
    version, grade, subject, quarter, topic, lesson, competency, global_subject = hierarchy(client)
    fresh = client.patch(
        f"{BASE}/global-subjects/{global_subject['id']}",
        headers={"If-Match": global_subject["revision"]},
        json={"values": {"description": "Synthetic updated reference"}},
    )
    assert fresh.status_code == 200
    assert len(client.get(f"{BASE}/global-subjects", params={"q": "Synthetic updated reference"}).json()["items"]) == 1
    assert (
        len(client.get(f"{BASE}/global-subjects", params={"q": global_subject["values"]["code"]}).json()["items"]) == 1
    )
    assert (
        client.patch(
            f"{BASE}/versions/{version['id']}",
            headers={"If-Match": version["revision"]},
            json={"values": {"name": "Stale edition"}},
        ).status_code
        == 409
    )
    version = get(client, version)
    create(client, "grades", {"number": 9}, version)
    version = get(client, version)
    assert (
        client.post(
            f"{BASE}/versions/{version['id']}/publish", headers={"If-Match": version["revision"]}, json=REVIEW
        ).status_code
        == 409
    )
