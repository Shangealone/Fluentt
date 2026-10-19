"""Synthetic disposable PostgreSQL monitoring acceptance checks."""

from uuid import UUID, uuid4
import pytest
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.users import User
from tests.integration.conftest import pg_engine as disposable_engine_fixture
from tests.integration.test_results_postgresql import evaluated, owner, visibility
from tests.integration.test_response_capture_postgresql import capture_case, start  # noqa: F401
from tests.integration.test_assignment_drafts_postgresql import draft_case  # noqa: F401
from tests.integration.test_question_bank_postgresql import bank, context  # noqa: F401
from tests.integration.test_assignment_publication_postgresql import join
from tests.integration.test_grading_postgresql import finalize
from tests.integration.test_progress_postgresql import another

pytestmark = pytest.mark.postgresql


@pytest.fixture(scope="module")
def questions_engine():
    yield from disposable_engine_fixture.__wrapped__()


def read(case, path="", **params):
    client, auth, class_id, _, _ = case[0]
    response = client.get(f"/api/v1/classes/{class_id}/monitoring" + path, headers=auth, params=params)
    assert response.status_code == 200, response.text
    assert "no-store" in response.headers["cache-control"]
    return response.json()


def test_roster_overview_assignment_and_student_pages(capture_case):  # noqa: F811
    case = capture_case
    data = read(case)
    assert data["eligible_students"] == data["available_assignments"] == 1
    assert data["counts"]["not_started"] == 1
    roster = read(case, "/students")["items"]
    assert roster[0]["id"] == str(case[3])
    assert read(case, f"/students/{case[3]}")["items"][0]["submission_status"] == "not_started"
    detail = read(case, f"/assignments/{case[1]['id']}")
    assert detail["items"][0]["submission_status"] == "not_started"
    assert detail["summary"]["mean"]["status"] == "unavailable"
    start(case)
    assert read(case)["counts"]["in_progress"] == 1
    finalize(case, empty=True)
    final = read(case)
    assert final["counts"]["submitted"] == 1 and final["results"]["awaiting_evaluation"] == 1
    another(case)
    assert read(case)["counts"]["available"] == 2
    assert read(case, "/assignments", limit=1)["has_more"] is True
    assert len(read(case, "/contexts")["items"]) == 1
    assert read(case, lesson_id=str(uuid4()))["counts"]["available"] == 0
    assert read(case, "/students", q="%_")["items"] == []


def test_released_mean_and_withdrawal(capture_case, bank):  # noqa: F811
    case = capture_case
    receipt, run = evaluated(case, bank)
    hidden = read(case, "/assignments")["items"][0]
    assert hidden["results"]["withheld"] == 1 and hidden["mean"]["eligible_results"] == 0
    assert visibility(case, receipt, owner(case, receipt)).status_code == 200
    released = read(case, "/assignments")["items"][0]
    assert released["mean"]["mean_points"] == "6.00" and released["mean"]["max_points"] == "9.00"
    assert read(case, f"/assignments/{case[1]['id']}")["items"][0]["released_run_id"] == run["id"]
    assert visibility(case, receipt, owner(case, receipt), False).status_code == 200
    assert read(case, "/assignments")["items"][0]["mean"]["eligible_results"] == 0
    assert not any(
        secret in str(read(case, f"/students/{case[3]}"))
        for secret in ("accepted_answers", "answer_key", "Private synthetic", "responses")
    )


def test_membership_and_role_boundaries(capture_case):  # noqa: F811
    case = capture_case
    client, auth, class_id, _, engine = case[0]
    assert client.get(f"/api/v1/classes/{class_id}/monitoring", headers=case[2]).status_code == 403
    assert client.get(f"/api/v1/classes/{class_id}/monitoring").status_code == 401
    assert client.get(f"/api/v1/classes/{uuid4()}/monitoring", headers=auth).status_code == 404
    assert client.get(f"/api/v1/classes/{class_id}/monitoring/students/{uuid4()}", headers=auth).status_code == 404
    assert client.get("/api/v1/instructor/monitoring/classes", headers=auth).json()["items"][0]["id"] == str(class_id)
    with Session(engine) as db, db.begin():
        student = db.get(User, case[3])
        student.profile_status = "disabled"
    assert read(case)["eligible_students"] == 0
    assert read(case, "/students")["items"] == []
    with Session(engine) as db, db.begin():
        db.get(User, case[3]).profile_status = "active"
    assert read(case)["eligible_students"] == 1
    assert client.get(f"/api/v1/classes/{class_id}/monitoring", headers=auth, params={"limit": 101}).status_code == 422


def test_multiple_members_denominators(capture_case):  # noqa: F811
    case = capture_case
    join(case[0])
    start(case)
    assert read(case)["counts"] == dict(available=2, not_started=1, in_progress=1, submitted=0, pending=2)
    roster = read(case, "/students")["items"]
    assert len(roster) == 2 and all(row["counts"]["available"] == 1 for row in roster)
    assert read(case, "/assignments")["items"][0]["counts"]["available"] == 2


def test_comparable_released_cohort_mean_and_heterogeneous_engine(capture_case, bank, monkeypatch):  # noqa: F811
    from app.modules.grading import service
    from tests.integration.test_grading_postgresql import evaluate

    case = capture_case
    receipt, first = evaluated(case, bank)
    assert visibility(case, receipt, owner(case, receipt)).status_code == 200
    auth, student = join(case[0])
    other = case[0], case[1], auth, student
    second_receipt = finalize(other, empty=True)
    response = evaluate(case[0][0], second_receipt)
    assert response.status_code == 200, response.text
    assert visibility(other, second_receipt, owner(other, second_receipt)).status_code == 200
    mean = read(case, "/assignments")["items"][0]["mean"]
    assert mean["mean_points"] == "3.00" and mean["eligible_results"] == 2
    # A third student's newly evaluated engine differs; first two pinned runs stay fixed.
    third_auth, third_id = join(case[0])
    third = case[0], case[1], third_auth, third_id
    third_receipt = finalize(third, empty=True)
    monkeypatch.setattr(service, "ENGINE_VERSION", "synthetic-monitoring-engine-fixture")
    assert evaluate(case[0][0], third_receipt).status_code == 200
    assert visibility(third, third_receipt, owner(third, third_receipt)).status_code == 200
    mixed = read(case, "/assignments")["items"][0]["mean"]
    assert mixed["status"] == "not_comparable" and mixed["mean_points"] is None and mixed["eligible_results"] == 3
    assert read(case, f"/students/{case[3]}")["items"][0]["released_run_id"] == first["id"]


def test_current_roster_leaving_rejoin_and_empty_class(capture_case):  # noqa: F811
    from datetime import datetime, timezone
    from app.models.users import ClassMembership

    case = capture_case
    finalize(case, empty=True)
    engine = case[0][4]
    with Session(engine) as db, db.begin():
        membership = db.scalar(
            select(ClassMembership).where(
                ClassMembership.class_id == UUID(case[0][2]),
                ClassMembership.student_id == case[3],
                ClassMembership.status == "active",
            )
        )
        membership.status = "left"
        membership.ended_at = datetime.now(timezone.utc)
    assert read(case)["counts"]["available"] == 0
    assert read(case, f"/assignments/{case[1]['id']}")["items"] == []
    assert (
        case[0][0].get(f"/api/v1/classes/{case[0][2]}/monitoring/students/{case[3]}", headers=case[0][1]).status_code
        == 404
    )
    with Session(engine) as db, db.begin():
        db.add(
            ClassMembership(
                class_id=UUID(case[0][2]), student_id=case[3], status="active", joined_at=datetime.now(timezone.utc)
            )
        )
    assert read(case)["counts"]["submitted"] == 1
    empty = case[0][0].post(
        "/api/v1/classes",
        headers=case[0][1] | {"Idempotency-Key": str(uuid4())},
        json={"class_name": "Synthetic empty monitor class", "grade_level": 5, "language": "tagalog"},
    )
    assert empty.status_code == 201, empty.text
    result = case[0][0].get(f"/api/v1/classes/{empty.json()['id']}/monitoring", headers=case[0][1]).json()
    assert result["available_assignments"] == result["eligible_students"] == result["counts"]["available"] == 0


def test_large_roster_pagination_safe_queries_and_retained_curriculum(capture_case, monkeypatch):  # noqa: F811
    from sqlalchemy import event
    from sqlalchemy.engine import Engine

    case = capture_case
    settings = case[0][0].app.app.state.settings
    for name in (
        "mobile_session_request_limit",
        "user_creation_limit",
        "enrollment_peer_limit",
        "enrollment_session_limit",
    ):
        monkeypatch.setattr(settings, name, 1000)
    for _ in range(21):
        join(case[0])
    first, second = read(case, "/students"), read(case, "/students", offset=20)
    assert len(first["items"]) == 20 and first["has_more"] and len(second["items"]) == 2
    assert len({row["id"] for row in first["items"] + second["items"]}) == 22
    detail1, detail2 = (
        read(case, f"/assignments/{case[1]['id']}"),
        read(case, f"/assignments/{case[1]['id']}", offset=20),
    )
    assert len({row["id"] for row in detail1["items"] + detail2["items"]}) == 22
    assert all(row["submission_status"] == "not_started" for row in detail1["items"])
    statements = []

    def observe(conn, cursor, statement, parameters, execution_context, many):
        statements.append(statement.lower())

    event.listen(Engine, "before_cursor_execute", observe)
    try:
        read(case, "/assignments")
    finally:
        event.remove(Engine, "before_cursor_execute", observe)
    assert len(statements) < 20
    assert not any(
        table in sql
        for sql in statements
        for table in (
            "question_answer_keys",
            "student_responses",
            "research_private",
            "learner_progress",
            "vocabulary_review",
        )
    )
    version = case[1]["context"]["curriculum_version_id"]
    current = case[0][0].get(f"/api/v1/admin/curriculum/manage/versions/{version}").json()
    retired = case[0][0].post(
        f"/api/v1/admin/curriculum/manage/versions/{version}/retire", headers={"If-Match": current["revision"]}
    )
    assert retired.status_code == 200, retired.text
    retained = read(case, "/assignments", curriculum_version_id=version)["items"][0]
    assert retained["context"]["curriculum_version_id"] == version


def test_busy_student_retry_cross_instructor_and_session_revocation(capture_case):  # noqa: F811
    from app.models.users import UserSession
    from tests.integration.test_enrollment_postgresql import account

    case = capture_case
    client, auth, class_id, _, engine = case[0]
    with Session(engine) as db, db.begin():
        db.scalar(select(User).where(User.id == case[3]).with_for_update())
        result = client.get(f"/api/v1/classes/{class_id}/monitoring", headers=auth)
        assert result.status_code == 409, result.text
    assert read(case)["eligible_students"] == 1
    other, _ = account(client, "instructor")
    assert client.get(f"/api/v1/classes/{class_id}/monitoring", headers=other).status_code == 404
    assert client.get("/api/v1/instructor/monitoring/classes", headers=other).json()["items"] == []
    with Session(engine) as db, db.begin():
        from datetime import datetime, timezone
        from app.models.users import Classroom

        teacher = db.get(Classroom, UUID(class_id)).instructor_id
        for session in db.scalars(select(UserSession).where(UserSession.user_id == teacher)):
            session.revoked_at = datetime.now(timezone.utc)
    invalid = client.get(f"/api/v1/classes/{class_id}/monitoring", headers=auth)
    assert invalid.status_code == 401 and "no-store" in invalid.headers["cache-control"]


def test_review_required_and_not_applicable_excluded_from_means(capture_case, bank, monkeypatch):  # noqa: F811
    from app.modules.grading import service
    from app.modules.grading.engine import Outcome
    from tests.integration.test_grading_postgresql import grant, evaluate

    case = capture_case
    receipt = finalize(case, empty=True)
    grant(bank)
    original = service.evaluate

    def review(method, *args, **kwargs):
        return (
            Outcome("MANUAL_REVIEW_REQUIRED", "synthetic_fixture")
            if method == "identification"
            else original(method, *args, **kwargs)
        )

    monkeypatch.setattr(service, "evaluate", review)
    assert evaluate(case[0][0], receipt).status_code == 200
    assert read(case)["results"]["awaiting_manual_review"] == 1
    assert read(case, "/assignments")["items"][0]["mean"]["status"] == "unavailable"
    # A separate student's all-N/A synthetic engine outcome, never a real scoring rule.
    auth, student = join(case[0])
    other = case[0], case[1], auth, student
    second = finalize(other, empty=True)
    monkeypatch.setattr(service, "evaluate", lambda *args, **kwargs: Outcome("NOT_APPLICABLE", "synthetic_fixture"))
    assert evaluate(case[0][0], second).status_code == 200
    row = read(case, "/assignments")["items"][0]
    assert row["results"]["not_applicable"] == 1 and row["results"]["awaiting_manual_review"] == 1
    assert row["mean"]["eligible_results"] == 0 and row["counts"]["submitted"] == 2
