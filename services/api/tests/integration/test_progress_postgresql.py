"""Real student-owned projections over synthetic, disposable classroom activity."""

from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from uuid import UUID, uuid4
import pytest
from sqlalchemy import select, event
from sqlalchemy.orm import Session
from app.models.users import ClassMembership, UserSession, Classroom, User
from tests.integration.conftest import pg_engine as disposable_engine_fixture
from tests.integration.test_results_postgresql import evaluated, owner, visibility
from tests.integration.test_grading_postgresql import finalize, grant, evaluate
from tests.integration.test_response_capture_postgresql import capture_case, start  # noqa: F401
from tests.integration.test_assignment_drafts_postgresql import draft_case, create  # noqa: F401
from tests.integration.test_assignment_publication_postgresql import publish
from tests.integration.test_question_bank_postgresql import bank, context  # noqa: F401
from tests.integration.test_enrollment_postgresql import account

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/me"


@pytest.fixture(scope="module")
def questions_engine():
    yield from disposable_engine_fixture.__wrapped__()


def read(case, path="/progress", **params):
    result = case[0][0].get(BASE + path, headers=case[2], params=params)
    assert result.status_code == 200, result.text
    assert "no-store" in result.headers["cache-control"]
    return result.json()


def another(case, title="Synthetic pending assignment"):
    response, body = create(case[0])
    draft = response.json()
    body["title"] = title
    if title != draft["title"]:
        draft = (
            case[0][0]
            .patch(
                f"/api/v1/assignments/{draft['id']}", headers=case[0][1] | {"If-Match": draft["revision"]}, json=body
            )
            .json()
        )
    published = publish(case[0], draft)
    assert published.status_code == 200, published.text
    return case[0], published.json(), case[2], case[3]


def test_counts_empty_started_incomplete_final_and_retry_do_not_imply_mastery(capture_case):  # noqa: F811
    original = read(capture_case)
    assert original["counts"] == dict(available=1, not_started=1, in_progress=0, submitted=0, pending=1)
    initial = read(capture_case, "/learning-history")["items"][0]
    assert initial["attempt_id"] is None and initial["last_activity_at"] is None and initial["published_at"]
    attempt = start(capture_case)
    assert read(capture_case)["counts"]["in_progress"] == 1
    assert start(capture_case)["id"] == attempt["id"]
    receipt = finalize(capture_case, empty=True)
    assert read(capture_case)["counts"] == dict(available=1, not_started=0, in_progress=0, submitted=1, pending=0)
    history = read(capture_case, "/learning-history")["items"][0]
    assert history["attempt_id"] == receipt["id"] and history["result_state"] == "submitted"
    assert history["submitted_at"] and history["earned_points"] is None and history["released_run_id"] is None
    replay = capture_case[0][0].post(
        f"/api/v1/assignments/attempts/{receipt['id']}/submit",
        headers=capture_case[2]
        | {
            "If-Match": attempt["revision"],
            "Idempotency-Key": str(uuid4()),
        },
        json={"position": 1, "responses": [], "confirm": True},
    )
    assert replay.status_code == 200, replay.text
    assert read(capture_case)["counts"]["submitted"] == 1
    another(capture_case)
    assert read(capture_case)["counts"]["available"] == 2
    assert (
        read(capture_case, "/learning-history", status="not_started")["items"][0]["submission_status"] == "not_started"
    )


def test_released_withheld_withdrawn_and_newer_evaluations_respect_pinning(capture_case, bank, monkeypatch):  # noqa: F811
    receipt, first = evaluated(capture_case, bank)
    hidden = read(capture_case, "/learning-history")["items"][0]
    assert (
        hidden["result_state"] == "withheld" and hidden["earned_points"] is None and hidden["released_run_id"] is None
    )
    assert visibility(capture_case, receipt, owner(capture_case, receipt)).status_code == 200
    item = read(capture_case, "/learning-history")["items"][0]
    assert (
        item["earned_points"] == "6.00" and item["possible_points"] == "9.00" and item["released_run_id"] == first["id"]
    )
    assert not any(
        value in str(item)
        for value in ("accepted_answers", "A synthetic answer", "response_id", "answer_key", "Private synthetic")
    )
    from app.modules.grading import service

    monkeypatch.setattr(service, "ENGINE_VERSION", "synthetic-progress-engine-fixture")
    assert evaluate(capture_case[0][0], receipt).status_code == 200
    assert read(capture_case, "/learning-history")["items"][0]["released_run_id"] == first["id"]
    assert visibility(capture_case, receipt, owner(capture_case, receipt), False).status_code == 200
    withdrawn = read(capture_case, "/learning-history")["items"][0]
    assert withdrawn["result_state"] == "withheld" and withdrawn["earned_points"] is None
    assert read(capture_case)["counts"]["submitted"] == 1


def test_manual_unsupported_and_flashcards_have_no_fabricated_final_score(capture_case, bank, monkeypatch):  # noqa: F811
    receipt = finalize(capture_case, empty=True)
    grant(bank)
    from app.modules.grading import service
    from app.modules.grading.engine import Outcome

    original = service.evaluate

    def flagged(method, *args, **kwargs):
        if method == "identification":
            return Outcome("MANUAL_REVIEW_REQUIRED", "synthetic_review_fixture")
        if method == "multiple_select":
            return Outcome("UNSUPPORTED", "synthetic_unsupported_fixture")
        return original(method, *args, **kwargs)

    monkeypatch.setattr(service, "evaluate", flagged)
    assert evaluate(capture_case[0][0], receipt).status_code == 200
    item = read(capture_case, "/learning-history")["items"][0]
    assert item["result_state"] == "awaiting_manual_review" and item["possible_points"] is None
    assert read(capture_case)["counts"]["submitted"] == 1
    client, auth, _, rows, _ = capture_case[0]
    flash = next(row for row in rows if row["definition"]["method"] == "flashcards")
    draft = create(
        capture_case[0],
        dict(
            title="Synthetic Flashcard history",
            lesson_id=flash["definition"]["lesson_id"],
            question_revision_ids=[flash["id"]],
        ),
    )[0].json()
    assert publish(capture_case[0], draft).status_code == 200
    flash_case = capture_case[0], draft, capture_case[2], capture_case[3]
    flash_receipt = finalize(flash_case, empty=True)
    assert evaluate(client, flash_receipt).status_code == 200
    item = next(row for row in read(capture_case, "/learning-history")["items"] if row["id"] == draft["id"])
    assert item["result_state"] == "not_applicable" and item["earned_points"] is None


def test_personal_empty_school_and_owner_role_scope(capture_case):  # noqa: F811
    client, _, _, _, engine = capture_case[0]
    personal, personal_id = account(client, "personal_student")
    from app.models.learning import LearningContext, LearnerProgress

    with Session(engine) as db, db.begin():
        legacy_context = LearningContext(kind="personal", student_id=personal_id)
        db.add(legacy_context)
        db.flush()
        legacy = LearnerProgress(
            context_id=legacy_context.id,
            lesson_id=UUID(capture_case[1]["context"]["lesson_id"]),
            status="completed",
            completed_at=datetime.now(timezone.utc),
            metrics={"fixture_only": True, "unapproved_metric": 99},
        )
        db.add(legacy)
        db.flush()
        legacy_id = legacy.id
    other, other_id = account(client, "school_student")
    teacher, _ = account(client, "instructor")
    assert client.get(BASE + "/progress", headers=personal).json()["counts"] is None
    assert client.get(BASE + "/learning-history", headers=personal).json()["availability"] == "unavailable"
    with Session(engine) as db:
        assert db.get(LearnerProgress, legacy_id).metrics == {"fixture_only": True, "unapproved_metric": 99}
    assert client.get(BASE + "/progress", headers=other).json()["counts"]["available"] == 0
    assert client.get(BASE + "/learning-history", headers=other).json()["items"] == []
    for path in ("/progress", "/learning-history", "/progress/classes"):
        assert client.get(BASE + path, headers=teacher).status_code == 403
        client.cookies.clear()
        assert client.get(BASE + path).status_code == 401
    assert client.get(BASE + "/progress", headers=other, params={"class_id": capture_case[0][2]}).status_code == 404
    assert (
        client.get(BASE + "/learning-history", headers=personal, params={"class_id": capture_case[0][2]}).status_code
        == 404
    )
    assert (
        client.get(BASE + "/learning-history", headers=other, params={"student_id": str(capture_case[3])}).status_code
        == 422
    )
    with Session(engine) as db, db.begin():
        for row in db.scalars(select(UserSession).where(UserSession.user_id == other_id)):
            row.created_at = datetime.now(timezone.utc) - timedelta(days=2)
            row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    assert client.get(BASE + "/progress", headers=other).status_code == 401


def test_multi_class_isolation_membership_rejoin_and_inactive_owner(capture_case):  # noqa: F811
    client, auth, first_id, rows, engine = capture_case[0]
    finalize(capture_case, empty=True)
    second = client.post(
        "/api/v1/classes",
        headers=auth | {"Idempotency-Key": str(uuid4())},
        json={
            "class_name": "Synthetic second class",
            "grade_level": capture_case[1]["context"]["grade"],
            "language": "tagalog",
        },
    ).json()
    new_owner_case = client, auth, second["id"], rows, engine
    new_draft = create(new_owner_case)[0].json()
    assert publish(new_owner_case, new_draft).status_code == 200
    from tests.integration.test_enrollment_postgresql import confirmation

    enrolled = client.post(
        "/api/v1/class-memberships", headers=capture_case[2], json=confirmation(client, capture_case[2], second)
    )
    assert enrolled.status_code == 200, enrolled.text
    assert read(capture_case)["counts"] == dict(available=2, not_started=1, in_progress=0, submitted=1, pending=1)
    assert read(capture_case, class_id=second["id"])["counts"]["submitted"] == 0
    assert len(read(capture_case, "/progress/classes")["items"]) == 2
    with Session(engine) as db, db.begin():
        membership = db.scalar(
            select(ClassMembership).where(
                ClassMembership.class_id == UUID(first_id),
                ClassMembership.student_id == capture_case[3],
                ClassMembership.status == "active",
            )
        )
        membership.status = "left"
        membership.ended_at = datetime.now(timezone.utc)
    assert read(capture_case)["counts"]["submitted"] == 0
    assert len(read(capture_case, "/learning-history")["items"]) == 1
    assert (
        client.get(BASE + "/learning-history", headers=capture_case[2], params={"class_id": first_id}).status_code
        == 404
    )
    with Session(engine) as db, db.begin():
        db.add(
            ClassMembership(
                class_id=UUID(first_id),
                student_id=capture_case[3],
                status="active",
                joined_at=datetime.now(timezone.utc),
            )
        )
    assert read(capture_case)["counts"]["available"] == 2 and read(capture_case)["counts"]["submitted"] == 1
    with Session(engine) as db, db.begin():
        classroom = db.get(Classroom, UUID(first_id))
        classroom.status = "archived"
    assert read(capture_case)["class_count"] == 1
    with Session(engine) as db, db.begin():
        teacher = db.get(User, db.get(Classroom, UUID(first_id)).instructor_id)
        teacher.profile_status = "disabled"
    assert read(capture_case)["class_count"] == 0
    assert read(capture_case, "/learning-history")["items"] == []


def test_history_pagination_dates_query_count_and_retired_versions(capture_case, monkeypatch):  # noqa: F811
    # Fixture-only budget for bulk publication; runtime/default throttle coverage is unchanged.
    monkeypatch.setattr(capture_case[0][0].app.app.state.settings, "mobile_session_request_limit", 1000)
    for index in range(24):
        another(capture_case, f"Synthetic page item {index:02}")
    one = read(capture_case, "/learning-history")
    two = read(capture_case, "/learning-history", offset=20)
    assert len(one["items"]) == 20 and one["has_more"] and len(two["items"]) == 5 and not two["has_more"]
    assert len({row["id"] for row in one["items"] + two["items"]}) == 25
    assert read(capture_case, "/learning-history", offset=100)["items"] == []
    instant = one["items"][0]["sort_at"]
    assert read(capture_case, "/learning-history", since=instant)["items"][0]["id"] == one["items"][0]["id"]
    before = read(capture_case, "/learning-history", before=instant)
    assert all(row["sort_at"] < instant for row in before["items"])
    assert read(capture_case, "/learning-history", since="2099-01-01T00:00:00Z")["items"] == []
    client, _, _, _, engine = capture_case[0]
    assert (
        client.get(BASE + "/learning-history", headers=capture_case[2], params={"since": "2026-10-19"}).status_code
        == 422
    )
    assert client.get(BASE + "/learning-history", headers=capture_case[2], params={"limit": 101}).status_code == 422
    assert (
        client.get(
            BASE + "/learning-history",
            headers=capture_case[2],
            params={"since": "2026-10-20T00:00:00Z", "before": "2026-10-19T00:00:00Z"},
        ).status_code
        == 422
    )
    statements = []

    def observe(conn, cursor, statement, parameters, execution_context, many):
        statements.append(statement.lower())

    # The app's pooled engine is separate from the fixture engine: observe all Engine SQL during this request.
    from sqlalchemy.engine import Engine

    event.listen(Engine, "before_cursor_execute", observe)
    try:
        read(capture_case, "/learning-history")
    finally:
        event.remove(Engine, "before_cursor_execute", observe)
    assert len(statements) < 20
    assert not any(
        table in sql
        for sql in statements
        for table in (
            "question_answer_keys",
            "student_responses",
            "learner_progress",
            "research_private",
            "vocabulary_review",
        )
    )
    version = capture_case[1]["context"]["curriculum_version_id"]
    current = client.get(f"/api/v1/admin/curriculum/manage/versions/{version}")
    # Use the accepted management route/whole-version retirement, retaining original snapshot IDs.
    assert current.status_code == 200, current.text
    retired = client.post(
        f"/api/v1/admin/curriculum/manage/versions/{version}/retire", headers={"If-Match": current.json()["revision"]}
    )
    assert retired.status_code == 200, retired.text
    assert read(capture_case, "/learning-history")["items"][0]["context"]["curriculum_version_id"] == version
    from tests.integration.test_curriculum_management_postgresql import hierarchy, REVIEW

    newer = hierarchy(client)
    published = client.post(
        f"/api/v1/admin/curriculum/manage/versions/{newer[0]['id']}/publish",
        headers={"If-Match": newer[0]["revision"]},
        json=REVIEW,
    )
    assert published.status_code == 200, published.text
    assert newer[0]["id"] != version
    pinned = read(capture_case, "/learning-history")["items"][0]["context"]
    assert pinned["curriculum_version_id"] == version and pinned["lesson_id"] != newer[5]["id"]


def test_waiting_history_revalidates_a_disabled_owner_before_disclosure(capture_case):  # noqa: F811
    from fastapi.testclient import TestClient
    from sqlalchemy.engine import Engine
    from app.main import create_app
    from app.core.config import Settings

    engine = capture_case[0][4]
    settings = Settings(
        _env_file=None, environment="test", database_url=engine.url.render_as_string(hide_password=False)
    )
    waiting = Event()

    def observe(conn, cursor, statement, parameters, execution_context, many):
        if "FOR SHARE" in statement and "users.id IN" in statement:
            waiting.set()

    def reader():
        with TestClient(create_app(settings)) as client:
            return client.get(BASE + "/learning-history", headers=capture_case[2])

    with ThreadPoolExecutor(1) as pool, Session(engine) as db:
        teacher_id = db.get(Classroom, UUID(capture_case[0][2])).instructor_id
        teacher = db.scalar(select(User).where(User.id == teacher_id).with_for_update())
        event.listen(Engine, "before_cursor_execute", observe)
        try:
            future = pool.submit(reader)
            assert waiting.wait(timeout=10)
            teacher.profile_status = "disabled"
            db.commit()
            result = future.result(timeout=15)
            assert result.status_code == 200, result.text
            assert result.json()["items"] == []
        finally:
            db.rollback()
            event.remove(Engine, "before_cursor_execute", observe)
