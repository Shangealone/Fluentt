"""Real distribution tests; synthetic fixtures in a generated disposable database."""

from concurrent.futures import ThreadPoolExecutor, TimeoutError
from datetime import datetime, timezone, timedelta
from threading import Barrier, Event
from uuid import UUID, uuid4
import pytest
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.assessments import Assignment, AssignmentVersion, AssignmentQuestion, AssignmentAttempt, Question
from app.models.users import Classroom, ClassMembership, User, UserSession
from app.models.operations import AuditLog
from tests.integration.conftest import pg_engine as disposable_engine_fixture
from tests.integration.test_assignment_drafts_postgresql import draft_case, create  # noqa: F401
from tests.integration.test_question_bank_postgresql import bank, context  # noqa: F401
from tests.integration.test_enrollment_postgresql import account, confirmation

pytestmark = pytest.mark.postgresql


@pytest.fixture(scope="module")
def questions_engine():
    yield from disposable_engine_fixture.__wrapped__()


def publish(case, row, key=None, **overrides):
    client, auth, _, _, _ = case
    return client.post(
        f"/api/v1/assignments/{row['id']}/publish",
        headers=auth | {"If-Match": row["revision"], "Idempotency-Key": str(key or uuid4())},
        json={"confirm": True, "bind_subject_id": row["context"]["subject_id"]} | overrides,
    )


def join(case):
    client, auth, class_id, _, _ = case
    student, user_id = account(client, "school_student")
    classroom = client.get(f"/api/v1/classes/{class_id}", headers=auth).json()
    response = client.post("/api/v1/class-memberships", headers=student, json=confirmation(client, student, classroom))
    assert response.status_code == 200, response.text
    return student, user_id


def test_publication_visibility_immutable_versions_retry_and_no_attempts(draft_case):  # noqa: F811
    client, auth, class_id, _, engine = draft_case
    student, student_id = join(draft_case)
    row = create(draft_case)[0].json()
    listing = f"/api/v1/classes/{class_id}/published-assignments"
    detail = f"/api/v1/assignments/{row['id']}/published"
    assert client.get(listing, headers=student).json()["items"] == []
    assert client.get(detail, headers=student).status_code == 404
    key = uuid4()
    result = publish(draft_case, row, key)
    assert result.status_code == 200, result.text
    saved = result.json()
    assert saved["status"] == "published" and not saved["editable"] and not saved["requires_subject"]
    assert publish(draft_case, row, key).json() == saved
    assert publish(draft_case, row).status_code == 409
    assert (
        client.patch(
            f"/api/v1/assignments/{row['id']}", headers=auth | {"If-Match": saved["revision"]}, json=create_body(row)
        ).status_code
        == 409
    )
    assert (
        client.post(
            f"/api/v1/assignments/{row['id']}/archive", headers=auth | {"If-Match": saved["revision"]}
        ).status_code
        == 409
    )
    assert (
        client.get(f"/api/v1/classes/{class_id}/assignments", headers=auth).json()["items"][0]["status"] == "published"
    )
    for response in [client.get(listing, headers=student), client.get(detail, headers=student)]:
        assert response.status_code == 200, response.text
        assert "no-store" in response.headers["cache-control"]
        assert all(
            key not in response.text
            for key in ['"questions"', '"prompt"', '"content"', '"answer_key"', '"back"', "Private synthetic"]
        )
    assert client.get(detail, headers=student).json()["question_count"] == 10
    later, _ = join(draft_case)
    assert client.get(detail, headers=later).status_code == 200
    with Session(engine) as db, db.begin():
        version = db.get(AssignmentVersion, UUID(row["version_id"]))
        assert version.max_attempts is None and version.publication_contract == "distribution-only-v1"
        assert db.get(Classroom, UUID(class_id)).subject_id == UUID(row["context"]["subject_id"])
        assert (
            db.scalar(
                select(func.count())
                .select_from(AuditLog)
                .where(AuditLog.entity_id == UUID(row["id"]), AuditLog.action == "assignments.publish")
            )
            == 1
        )
        child = db.scalar(select(AssignmentQuestion).where(AssignmentQuestion.assignment_version_id == version.id))
        assert child.points is None
        with pytest.raises(IntegrityError), db.begin_nested():
            version.title = "Forbidden history change"
            db.flush()
        with pytest.raises(IntegrityError), db.begin_nested():
            child.position = 99
            db.flush()
        with pytest.raises(IntegrityError), db.begin_nested():
            db.add(
                AssignmentAttempt(
                    assignment_version_id=version.id,
                    student_id=student_id,
                    attempt_number=1,
                    started_at=datetime.now(timezone.utc),
                )
            )
            db.flush()
        with pytest.raises(IntegrityError), db.begin_nested():
            db.add(
                AssignmentVersion(
                    assignment_id=UUID(row["id"]), version=2, lesson_id=version.lesson_id, title="Forbidden new edition"
                )
            )
            db.flush()
        with pytest.raises(IntegrityError), db.begin_nested():
            db.get(Assignment, UUID(row["id"])).status = "archived"
            db.flush()


def create_body(row):
    return {
        "title": row["title"],
        "lesson_id": row["context"]["lesson_id"],
        "question_revision_ids": [q["id"] for q in row["questions"]],
    }


def test_permissions_membership_revocation_retirement_and_expiry(draft_case):  # noqa: F811
    client, auth, class_id, rows, engine = draft_case
    row = create(draft_case)[0].json()
    assert publish(draft_case, row).status_code == 200
    student, student_id = join(draft_case)
    detail = f"/api/v1/assignments/{row['id']}/published"
    other, _ = account(client, "school_student")
    personal, _ = account(client, "personal_student")
    instructor, _ = account(client, "instructor")
    assert client.get(detail).status_code == 401
    assert client.get(detail, headers=other).status_code == 404
    assert client.get(detail, headers=personal).status_code == 403
    assert client.get(detail, headers=instructor).status_code == 403
    assert (
        client.post(
            f"/api/v1/assignments/{row['id']}/publish",
            headers=student | {"If-Match": row["revision"], "Idempotency-Key": str(uuid4())},
            json={"confirm": True},
        ).status_code
        == 403
    )
    with Session(engine) as db, db.begin():
        question = db.get(Question, UUID(rows[0]["question_id"]))
        question.status = "archived"
        question.archived_at = datetime.now(timezone.utc)
    assert client.get(detail, headers=student).status_code == 200
    for status in ("left", "removed"):
        with Session(engine) as db, db.begin():
            membership = db.scalar(select(ClassMembership).where(ClassMembership.student_id == student_id))
            membership.status = status
            membership.ended_at = datetime.now(timezone.utc)
        assert client.get(detail, headers=student).status_code == 404
    with Session(engine) as db, db.begin():
        membership = db.scalar(select(ClassMembership).where(ClassMembership.student_id == student_id))
        membership.status = "active"
        membership.ended_at = None
        owner = db.get(User, db.get(Classroom, UUID(class_id)).instructor_id)
        owner.profile_status = "disabled"
    assert client.get(detail, headers=student).status_code == 404
    with Session(engine) as db, db.begin():
        owner = db.get(User, db.get(Classroom, UUID(class_id)).instructor_id)
        owner.profile_status = "active"
        classroom = db.get(Classroom, UUID(class_id))
        classroom.status = "archived"
    assert client.get(detail, headers=student).status_code == 404
    with Session(engine) as db, db.begin():
        db.get(Classroom, UUID(class_id)).status = "active"
        session = db.scalar(select(UserSession).where(UserSession.user_id == student_id))
        session.created_at = datetime.now(timezone.utc) - timedelta(days=1)
        session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    assert client.get(detail, headers=student).status_code == 401


def test_validation_stale_publish_concurrency_and_atomic_failure(draft_case, monkeypatch):  # noqa: F811
    client, auth, class_id, rows, engine = draft_case
    empty = create(
        draft_case,
        {"title": "Empty fixture", "lesson_id": rows[0]["definition"]["lesson_id"], "question_revision_ids": []},
    )[0].json()
    assert publish(draft_case, empty).status_code == 422
    row = create(draft_case)[0].json()
    assert publish(draft_case, row, bind_subject_id=None).status_code == 422
    assert publish(draft_case, row, bind_subject_id=str(uuid4())).status_code == 422
    assert (
        client.post(
            f"/api/v1/assignments/{row['id']}/publish",
            headers=auth | {"Idempotency-Key": str(uuid4())},
            json={"confirm": True},
        ).status_code
        == 428
    )
    # Inject failure after freeze/root DML and prove transaction rolls all changes back.
    from app.modules.assignments import publication

    original = publication.describe

    def interrupted(*args):
        raise RuntimeError("Synthetic failure after publication flush")

    monkeypatch.setattr(publication, "describe", interrupted)
    with pytest.raises(RuntimeError, match="Synthetic failure"):
        publish(draft_case, row)
    monkeypatch.setattr(publication, "describe", original)
    with Session(engine) as db:
        assert db.get(Assignment, UUID(row["id"])).status == "draft"
        assert db.get(AssignmentVersion, UUID(row["version_id"])).locked_at is None
        assert db.get(Classroom, UUID(class_id)).subject_id is None
    key, barrier = uuid4(), Barrier(2)

    def concurrent():
        barrier.wait()
        return publish(draft_case, row, key)

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda _: concurrent(), range(2)))
    assert [r.status_code for r in results] == [200, 200], [r.text for r in results]
    second = create(draft_case)[0].json()
    with Session(engine) as db, db.begin():
        db.get(AssignmentVersion, UUID(second["version_id"])).title = "Changed concurrently"
    assert publish(draft_case, second).status_code == 409
    fresh = client.get(f"/api/v1/assignments/{second['id']}", headers=auth).json()
    barrier = Barrier(2)

    def competing():
        barrier.wait()
        return publish(draft_case, fresh)

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda _: competing(), range(2)))
    assert sorted(r.status_code for r in results) == [200, 409]


def test_publication_rejects_foreign_owner_configured_or_ineligible_content_and_subject_conflicts(draft_case):  # noqa: F811
    client, auth, class_id, rows, engine = draft_case
    row = create(draft_case)[0].json()
    stranger, _ = account(client, "instructor")
    endpoint = f"/api/v1/assignments/{row['id']}/publish"
    assert (
        client.post(
            endpoint,
            headers=stranger | {"If-Match": row["revision"], "Idempotency-Key": str(uuid4())},
            json={"confirm": True},
        ).status_code
        == 404
    )
    with Session(engine) as db, db.begin():
        db.get(AssignmentVersion, UUID(row["version_id"])).max_attempts = 1
    current = client.get(f"/api/v1/assignments/{row['id']}", headers=auth).json()
    assert publish(draft_case, current).status_code == 409
    with Session(engine) as db, db.begin():
        db.get(AssignmentVersion, UUID(row["version_id"])).max_attempts = None
        question = db.get(Question, UUID(rows[0]["question_id"]))
        question.status = "archived"
        question.archived_at = datetime.now(timezone.utc)
    current = client.get(f"/api/v1/assignments/{row['id']}", headers=auth).json()
    assert publish(draft_case, current).status_code == 422
    # A second published lesson in another subject may be selected for an unbound
    # draft, but publication must not silently overwrite that retained context.
    from tests.integration.test_curriculum_management_postgresql import hierarchy
    from tests.integration.test_question_bank_postgresql import publish_curriculum

    nodes = hierarchy(client)
    publish_curriculum(client, nodes)
    alternate = create(
        draft_case, {"title": "Other subject fixture", "lesson_id": nodes[5]["id"], "question_revision_ids": []}
    )[0]
    assert alternate.status_code == 201, alternate.text
    second = create(
        draft_case,
        {
            "title": "Eligible subset fixture",
            "lesson_id": row["context"]["lesson_id"],
            "question_revision_ids": [rows[1]["id"]],
        },
    )[0].json()
    assert publish(draft_case, second).status_code == 409
    with Session(engine) as db:
        assert db.get(Classroom, UUID(class_id)).subject_id is None


def test_student_read_waits_for_owner_and_revalidates_after_disable(draft_case):  # noqa: F811
    client, _, class_id, _, engine = draft_case
    row = create(draft_case)[0].json()
    assert publish(draft_case, row).status_code == 200
    student, _ = join(draft_case)
    started = Event()
    with Session(engine) as db, ThreadPoolExecutor(1) as pool:
        owner_id = db.get(Classroom, UUID(class_id)).instructor_id
        owner = db.scalar(select(User).where(User.id == owner_id).with_for_update())

        def read():
            started.set()
            return client.get(f"/api/v1/assignments/{row['id']}/published", headers=student)

        future = pool.submit(read)
        assert started.wait(2)
        with pytest.raises(TimeoutError):
            future.result(timeout=0.15)
        owner.profile_status = "disabled"
        db.commit()
        assert future.result(timeout=5).status_code == 404
