"""Synthetic instructor drafts in their own generated database; no learner delivery."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import UUID, uuid4
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.assessments import AssignmentVersion, AssignmentQuestion, Question
from app.models.users import Classroom, UserSession
from app.models.curriculum import GradeLevel
from tests.integration.conftest import pg_engine as disposable_engine_fixture
from tests.integration.test_question_bank_postgresql import add, publish_curriculum, publish
from tests.integration.test_question_bank_postgresql import bank, context  # noqa: F401 - shared pytest fixtures
from tests.test_question_config import EXAMPLES

pytestmark = pytest.mark.postgresql


@pytest.fixture(scope="module")
def questions_engine():
    yield from disposable_engine_fixture.__wrapped__()


@pytest.fixture
def draft_case(bank, context):  # noqa: F811 - pytest fixture arguments
    client, _, engine = bank
    grade = context[0]  # Resolve the actual published fixture grade; do not invent curriculum IDs.
    with Session(engine) as db:
        from app.models.curriculum import CurriculumGrade, CurriculumVersion

        version = db.get(CurriculumVersion, UUID(context[0]["id"]))
        node = db.scalar(select(CurriculumGrade).where(CurriculumGrade.curriculum_version_id == version.id))
        grade = db.get(GradeLevel, node.grade_level_id).number
    issued = client.post("/api/v1/users", json={"username": "Assign_" + uuid4().hex[:12], "role": "instructor"})
    assert issued.status_code == 201
    auth = {"Authorization": "Bearer " + issued.json()["session"]["credential"]}
    created = client.post(
        "/api/v1/classes",
        headers=auth | {"Idempotency-Key": str(uuid4())},
        json={"class_name": "Synthetic assignment class", "grade_level": grade, "language": "tagalog"},
    )
    assert created.status_code == 201
    class_id = created.json()["id"]
    rows = []
    publish_curriculum(client, context)
    for example in EXAMPLES:
        row, _ = add(client, context, example)
        rows.append(publish(client, row))
    # The standard fixture definitions use Tagalog, matching the explicitly created class.
    return client, auth, class_id, rows, engine


def create(case, body=None, key=None):
    client, auth, class_id, rows, _ = case
    data = body or dict(
        lesson_id=rows[0]["definition"]["lesson_id"],
        title="Synthetic assignment",
        instructions="Fixture only",
        question_revision_ids=[row["id"] for row in rows],
    )
    response = client.post(
        f"/api/v1/classes/{class_id}/assignments", json=data, headers=auth | {"Idempotency-Key": str(key or uuid4())}
    )
    return response, data


def test_all_ten_creation_idempotency_edit_archive_and_hidden_keys(draft_case):
    client, auth, class_id, rows, engine = draft_case
    key = uuid4()
    response, body = create(draft_case, key=key)
    assert response.status_code == 201, response.text
    row = response.json()
    assert row["status"] == "draft" and row["requires_subject"] and row["editable"]
    assert (
        len(row["questions"]) == 10 and "answer_key" not in response.text and "Private synthetic" not in response.text
    )
    assert row["revision"] and "no-store" in response.headers["cache-control"]
    assert create(draft_case, key=key)[0].json()["id"] == row["id"]
    listing = client.get(f"/api/v1/classes/{class_id}/assignments", headers=auth)
    assert listing.status_code == 200, listing.text
    assert listing.json()["items"][0]["question_count"] == 10
    assert "definition" not in listing.text and "answer_key" not in listing.text
    assert create(draft_case, body=body | {"title": "Changed"}, key=key)[0].status_code == 409
    with Session(engine) as db:
        version = db.get(AssignmentVersion, UUID(row["version_id"]))
        assert version.max_attempts is None and version.grading_policy == {}
        assert all(
            q.points is None
            for q in db.scalars(
                select(AssignmentQuestion).where(AssignmentQuestion.assignment_version_id == version.id)
            )
        )
        assert db.get(Classroom, UUID(class_id)).subject_id is None
        with pytest.raises(IntegrityError), db.begin_nested():
            version.locked_at = datetime.now(timezone.utc)
            db.flush()
        with pytest.raises(IntegrityError), db.begin_nested():
            version.max_attempts = 1
            version.locked_at = datetime.now(timezone.utc)
            db.flush()
    path = "/api/v1/assignments/" + row["id"]
    assert client.patch(path, headers=auth, json=body).status_code == 428
    edited = client.patch(
        path,
        headers=auth | {"If-Match": row["revision"]},
        json=body | {"question_revision_ids": list(reversed(body["question_revision_ids"]))},
    )
    assert edited.status_code == 200, edited.text
    assert [q["id"] for q in edited.json()["questions"]] == list(reversed(body["question_revision_ids"]))
    assert client.patch(path, headers=auth | {"If-Match": row["revision"]}, json=body).status_code == 409
    archived = client.post(path + "/archive", headers=auth | {"If-Match": edited.json()["revision"]})
    assert archived.status_code == 200 and archived.json()["status"] == "archived"
    assert client.patch(path, headers=auth | {"If-Match": archived.json()["revision"]}, json=body).status_code == 409
    # Section 19 supplies publication, but never without explicit confirmation/key/freshness.
    assert client.post(path + "/publish", headers=auth).status_code == 422
    assert client.post(path + "/attempts", headers=auth).status_code == 404


def test_eligibility_safe_history_and_role_ownership(draft_case):
    client, auth, class_id, rows, engine = draft_case
    lessons = client.get(f"/api/v1/classes/{class_id}/assignment-lessons", headers=auth)
    assert lessons.status_code == 200 and lessons.json()["items"]
    candidates = client.get(
        f"/api/v1/classes/{class_id}/assignment-questions",
        params={"lesson_id": rows[0]["definition"]["lesson_id"], "limit": 3},
        headers=auth,
    )
    assert candidates.status_code == 200 and len(candidates.json()["items"]) == 3 and candidates.json()["has_more"]
    response, body = create(draft_case)
    assert response.status_code == 201, response.text
    row = response.json()
    path = "/api/v1/assignments/" + row["id"]
    other = client.post("/api/v1/users", json={"username": "Other_" + uuid4().hex[:12], "role": "instructor"}).json()
    outsider = {"Authorization": "Bearer " + other["session"]["credential"]}
    for endpoint in [path, f"/api/v1/classes/{class_id}/assignments", f"/api/v1/classes/{class_id}/assignment-lessons"]:
        assert client.get(endpoint, headers=outsider).status_code == 404
        assert client.get(endpoint).status_code == 401
    student = client.post(
        "/api/v1/users", json={"username": "Student_" + uuid4().hex[:12], "role": "school_student"}
    ).json()
    learner = {"Authorization": "Bearer " + student["session"]["credential"]}
    assert client.get(path, headers=learner).status_code == 403
    assert client.patch(path, headers=outsider | {"If-Match": row["revision"]}, json=body).status_code == 404
    with Session(engine) as db, db.begin():
        item = db.get(Question, UUID(rows[0]["question_id"]))
        item.status = "archived"
        item.archived_at = datetime.now(timezone.utc)
    history = client.get(path, headers=auth).json()
    assert not history["eligible"] and not history["questions"][0]["eligible"]
    assert client.patch(path, headers=auth | {"If-Match": history["revision"]}, json=body).status_code == 422
    assert (
        client.patch(
            path,
            headers=auth | {"If-Match": history["revision"]},
            json=body | {"question_revision_ids": body["question_revision_ids"][1:]},
        ).status_code
        == 200
    )


def test_concurrent_retry_empty_draft_and_expired_session(draft_case):
    client, auth, class_id, rows, engine = draft_case
    body = dict(lesson_id=rows[0]["definition"]["lesson_id"], title="Empty draft", question_revision_ids=[])
    key = uuid4()
    barrier = Barrier(2)

    def submit():
        barrier.wait(timeout=10)
        response, _ = create(draft_case, body=body, key=key)
        assert response.status_code == 201, response.text
        return response.json()["id"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: submit(), range(2)))
    assert results[0] == results[1]
    with Session(engine) as db, db.begin():
        owner = db.get(Classroom, UUID(class_id)).instructor_id
        for session in db.scalars(select(UserSession).where(UserSession.user_id == owner)):
            session.revoked_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    assert client.get("/api/v1/assignments/" + results[0], headers=auth).status_code == 401


def test_invalid_versions_context_duplicates_and_atomic_failure(draft_case):
    client, auth, class_id, rows, engine = draft_case
    response, body = create(draft_case)
    assert response.status_code == 201
    row = response.json()
    path = "/api/v1/assignments/" + row["id"]
    for change in [
        {"lesson_id": str(uuid4())},
        {"question_revision_ids": [str(uuid4())]},
        {"question_revision_ids": [rows[0]["id"], rows[0]["id"]]},
        {"points": 3},
        {"max_attempts": 3},
    ]:
        assert client.patch(path, headers=auth | {"If-Match": row["revision"]}, json=body | change).status_code == 422
    # A newer draft under a published question must never be selectable.
    second = client.post(
        f"/api/v1/admin/questions/{rows[0]['question_id']}/revisions",
        headers={"If-Match": rows[0]["revision"]},
        json={**rows[0]["definition"], "answer_key": EXAMPLES[0][2]},
    )
    assert second.status_code == 201, second.text
    assert create(draft_case, body=body | {"question_revision_ids": [second.json()["id"]]})[0].status_code == 422
    from tests.integration.test_question_bank_postgresql import publish as publish_question

    second = publish_question(client, second.json())
    assert (
        create(draft_case, body=body | {"question_revision_ids": [rows[0]["id"], second["id"]]})[0].status_code == 422
    )
    assert client.get(path, headers=auth).json()["revision"] == row["revision"]
    with Session(engine) as db, db.begin():
        classroom = db.get(Classroom, UUID(class_id))
        classroom.language = "english"
    assert create(draft_case, body=body)[0].status_code == 422
    with Session(engine) as db, db.begin():
        classroom = db.get(Classroom, UUID(class_id))
        classroom.language = "tagalog"
        from app.models.curriculum import Subject

        other = Subject(code="OTHER_" + uuid4().hex[:8], name="Synthetic other subject")
        db.add(other)
        db.flush()
        classroom.subject_id = other.id
    assert client.get(f"/api/v1/classes/{class_id}/assignment-lessons", headers=auth).json()["items"] == []
    assert create(draft_case, body=body)[0].status_code == 422


def test_concurrent_edit_and_archive_class_preserve_history(draft_case):
    client, auth, class_id, _, engine = draft_case
    response, body = create(draft_case)
    row = response.json()
    path = "/api/v1/assignments/" + row["id"]
    barrier = Barrier(2)

    def edit(number):
        barrier.wait(timeout=10)
        return client.patch(
            path, headers=auth | {"If-Match": row["revision"]}, json=body | {"title": f"Concurrent {number}"}
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(edit, [1, 2])) == [200, 409]
    with Session(engine) as db, db.begin():
        classroom = db.get(Classroom, UUID(class_id))
        classroom.status = "archived"
        classroom.archived_at = datetime.now(timezone.utc)
    saved = client.get(path, headers=auth).json()
    assert not saved["editable"]
    assert client.patch(path, headers=auth | {"If-Match": saved["revision"]}, json=body).status_code == 409
    assert client.post(path + "/archive", headers=auth | {"If-Match": saved["revision"]}).status_code == 200
