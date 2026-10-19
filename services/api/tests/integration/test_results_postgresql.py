"""Synthetic classroom result visibility through real HTTP and disposable PostgreSQL."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import UUID, uuid4
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.main import create_app
from app.models.result_release import AssessmentResultRelease as Release
from app.models.users import ClassMembership, Classroom, UserSession
from app.models.operations import AuditLog
from app.modules.grading.engine import Outcome
from tests.integration.conftest import pg_engine as disposable_engine_fixture
from tests.integration.test_grading_postgresql import finalize, grant, evaluate
from tests.integration.test_response_capture_postgresql import capture_case, start  # noqa: F401
from tests.integration.test_assignment_drafts_postgresql import draft_case, create  # noqa: F401
from tests.integration.test_assignment_publication_postgresql import join, publish
from tests.integration.test_question_bank_postgresql import bank, context  # noqa: F401
from tests.integration.test_enrollment_postgresql import account

pytestmark = pytest.mark.postgresql


@pytest.fixture(scope="module")
def questions_engine():
    yield from disposable_engine_fixture.__wrapped__()


def owner_url(receipt):
    return f"/api/v1/assignments/results/{receipt['id']}"


def student_url(case):
    return f"/api/v1/assignments/{case[1]['id']}/result"


def owner(case, receipt):
    response = case[0][0].get(owner_url(receipt), headers=case[0][1])
    assert response.status_code == 200, response.text
    return response.json()


def visibility(case, receipt, row, released=True, key=None, **extra):
    return case[0][0].post(
        owner_url(receipt) + "/release",
        headers=case[0][1]
        | {
            "If-Match": row["revision"],
            "Idempotency-Key": str(key or uuid4()),
        },
        json={"run_id": row["evaluation"]["id"], "released": released, "confirm": True} | extra,
    )


def evaluated(case, bank_data):
    receipt = finalize(case)
    grant(bank_data)
    response = evaluate(case[0][0], receipt)
    assert response.status_code == 200, response.text
    return receipt, response.json()


def private_absent(response):
    assert "no-store" in response.headers["cache-control"]
    assert all(
        value not in response.text
        for value in (
            '"answer_key"',
            '"configuration"',
            '"back"',
            '"accepted_answers"',
            '"key_id"',
            '"correct_option_id"',
            '"policy_snapshot"',
            '"automatic_earned_points"',
            "A synthetic answer",
            "Private synthetic",
        )
    )


def test_release_review_withdraw_rerelease_and_replay(capture_case, bank):  # noqa: F811
    client, auth, _, _, engine = capture_case[0]
    not_started = client.get(student_url(capture_case), headers=capture_case[2])
    assert not_started.status_code == 200 and not_started.json()["state"] == "not_submitted"
    receipt, run = evaluated(capture_case, bank)
    withheld = client.get(student_url(capture_case), headers=capture_case[2])
    assert withheld.json()["state"] == "withheld" and withheld.json()["earned_points"] is None
    assert withheld.json()["items"] == [] and withheld.json()["pinned_run_id"] is None
    private_absent(withheld)
    row = owner(capture_case, receipt)
    assert row["earned_points"] == "6.00" and row["possible_points"] == "9.00" and len(row["items"]) == 10
    assert row["student_id"] == str(capture_case[3])
    key = uuid4()
    result = visibility(capture_case, receipt, row, key=key)
    assert result.status_code == 200, result.text
    released = result.json()
    assert released["released"] and released["pinned_run_id"] == run["id"]
    assert visibility(capture_case, receipt, row, key=key).json() == released
    seen = client.get(student_url(capture_case), headers=capture_case[2])
    private_absent(seen)
    assert seen.json()["earned_points"] == "6.00" and len(seen.json()["items"]) == 10
    assert seen.json()["student_id"] is None and seen.json()["student_username"] is None
    # Retirement preserves the exact front/version already assigned and released.
    question = capture_case[0][3][0]
    retired = client.post(
        f"/api/v1/admin/questions/{question['question_id']}/retire", headers={"If-Match": question["revision"]}
    )
    assert retired.status_code == 200, retired.text
    historical = client.get(student_url(capture_case), headers=capture_case[2]).json()
    assert historical["items"][0]["question_revision_id"] == question["id"]
    assert historical["items"][0]["question"]["eligible"] is False
    original_text = next(
        item["answer"]["text"]
        for item in seen.json()["items"]
        if item["question"]["definition"]["method"] == "identification"
    )
    assert original_text == "  ñ😀 e\u0301  "
    assert visibility(capture_case, receipt, row).status_code == 409
    withdrawn = visibility(capture_case, receipt, released, False)
    assert withdrawn.status_code == 200 and not withdrawn.json()["released"]
    hidden = client.get(student_url(capture_case), headers=capture_case[2]).json()
    assert hidden["state"] == "withheld" and hidden["items"] == [] and hidden["earned_points"] is None
    assert not visibility(capture_case, receipt, row, key=key).json()["released"]  # No resurrection on retry.
    again = visibility(capture_case, receipt, withdrawn.json())
    assert again.status_code == 200 and again.json()["released"]
    with Session(engine) as db, db.begin():
        events = list(
            db.scalars(select(Release).where(Release.attempt_id == UUID(receipt["id"])).order_by(Release.sequence))
        )
        assert [event.released for event in events] == [True, False, True]
        assert len({event.run_id for event in events}) == 1
        with pytest.raises(IntegrityError), db.begin_nested():
            events[0].released = False
            db.flush()
        with pytest.raises(IntegrityError), db.begin_nested():
            db.delete(db.get(Release, events[1].id))
            db.flush()
        assert (
            db.scalar(
                select(func.count())
                .select_from(AuditLog)
                .where(AuditLog.action.in_(["results.release", "results.withdraw"]))
            )
            == 3
        )
    assert client.get(owner_url(receipt), headers=auth).json()["pinned_run_id"] == run["id"]


def test_current_membership_ownership_roles_and_revoked_session(capture_case, bank):  # noqa: F811
    receipt, _ = evaluated(capture_case, bank)
    client, auth, class_id, _, engine = capture_case[0]
    row = owner(capture_case, receipt)
    assert visibility(capture_case, receipt, row).status_code == 200
    other_student, _ = account(client, "school_student")
    other_teacher, _ = account(client, "instructor")
    assert client.get(student_url(capture_case), headers=other_student).status_code == 404
    assert client.get(owner_url(receipt), headers=other_student).status_code == 403
    assert client.get(owner_url(receipt), headers=other_teacher).status_code == 404
    assert client.get(student_url(capture_case), headers=auth).status_code == 403
    client.cookies.clear()
    assert client.get(student_url(capture_case)).status_code == 401
    assert client.get(owner_url(receipt)).status_code == 401
    list_url = f"/api/v1/assignments/{capture_case[1]['id']}/results"
    assert len(client.get(list_url, headers=auth).json()["items"]) == 1
    with Session(engine) as db, db.begin():
        member = db.scalar(select(ClassMembership).where(ClassMembership.student_id == capture_case[3]))
        member.status = "left"
        member.ended_at = datetime.now(timezone.utc)
    assert client.get(student_url(capture_case), headers=capture_case[2]).status_code == 404
    assert client.get(owner_url(receipt), headers=auth).status_code == 404
    assert client.get(list_url, headers=auth).json()["items"] == []
    with Session(engine) as db, db.begin():
        db.add(
            ClassMembership(
                class_id=UUID(class_id),
                student_id=capture_case[3],
                status="active",
                joined_at=datetime.now(timezone.utc),
            )
        )
    assert client.get(student_url(capture_case), headers=capture_case[2]).json()["released"]
    with Session(engine) as db, db.begin():
        classroom = db.get(Classroom, UUID(class_id))
        classroom.status = "archived"
    assert client.get(owner_url(receipt), headers=auth).status_code == 404
    assert client.get(student_url(capture_case), headers=capture_case[2]).status_code == 404
    with Session(engine) as db, db.begin():
        classroom = db.get(Classroom, UUID(class_id))
        classroom.status = "active"
        for session in db.scalars(select(UserSession).where(UserSession.user_id == capture_case[3])):
            session.revoked_at = datetime.now(timezone.utc)
    assert client.get(student_url(capture_case), headers=capture_case[2]).status_code == 401


def test_pending_manual_unsupported_not_applicable_and_no_implicit_grading(capture_case, bank, monkeypatch):  # noqa: F811
    client = capture_case[0][0]
    receipt = finalize(capture_case, empty=True)
    pending = client.get(student_url(capture_case), headers=capture_case[2]).json()
    assert pending["state"] == "submitted" and pending["evaluation"] is None
    grant(bank)
    from app.modules.grading import service

    original = service.evaluate

    def review(method, *args, **kwargs):
        if method == "identification":
            return Outcome("MANUAL_REVIEW_REQUIRED", "synthetic_review_fixture")
        if method == "multiple_select":
            return Outcome("UNSUPPORTED", "synthetic_unsupported_fixture")
        return original(method, *args, **kwargs)

    monkeypatch.setattr(service, "evaluate", review)
    assert evaluate(client, receipt).status_code == 200
    row = owner(capture_case, receipt)
    assert row["state"] == "awaiting_manual_review" and row["earned_points"] is None
    assert visibility(capture_case, receipt, row).status_code == 409
    student = client.get(student_url(capture_case), headers=capture_case[2])
    assert student.json()["state"] == "awaiting_manual_review" and student.json()["items"] == []
    private_absent(student)


def test_flashcards_no_denominator(draft_case, bank):  # noqa: F811
    row, body = create(draft_case)
    body["question_revision_ids"] = [
        item["id"] for item in draft_case[3] if item["definition"]["method"] == "flashcards"
    ]
    client, auth = draft_case[:2]
    saved = client.patch(
        f"/api/v1/assignments/{row.json()['id']}", json=body, headers=auth | {"If-Match": row.json()["revision"]}
    ).json()
    assert publish(draft_case, saved).status_code == 200
    student, student_id = join(draft_case)
    case = draft_case, saved, student, student_id
    receipt = finalize(case, empty=True)
    grant(bank)
    assert evaluate(client, receipt).status_code == 200
    seen = client.get(student_url(case), headers=student)
    assert (
        seen.json()["state"] == "not_applicable" and seen.json()["earned_points"] is None and not seen.json()["items"]
    )
    assert visibility(case, receipt, owner(case, receipt)).status_code == 409


def test_release_validation_pinning_rollback_and_database_guards(capture_case, bank, monkeypatch):  # noqa: F811
    receipt, run = evaluated(capture_case, bank)
    client, auth, _, _, engine = capture_case[0]
    row = owner(capture_case, receipt)
    path = owner_url(receipt) + "/release"
    body = {"run_id": run["id"], "released": True, "confirm": True}
    assert client.post(path, headers=auth | {"Idempotency-Key": str(uuid4())}, json=body).status_code == 428
    assert visibility(capture_case, receipt, row, confirm=False).status_code == 422
    assert visibility(capture_case, receipt, row, score=100).status_code == 422
    assert visibility(capture_case, receipt, row, run_id=str(uuid4())).status_code == 404
    assert visibility(capture_case, receipt, row, False).status_code == 409
    from app.modules.assignments import results

    original = results.describe

    def interrupted(*args, **kwargs):
        raise RuntimeError("Synthetic visibility failure")

    monkeypatch.setattr(results, "describe", interrupted)
    with pytest.raises(RuntimeError, match="Synthetic visibility failure"):
        visibility(capture_case, receipt, row)
    with Session(engine) as db:
        assert (
            db.scalar(select(func.count()).select_from(Release).where(Release.attempt_id == UUID(receipt["id"]))) == 0
        )
    monkeypatch.setattr(results, "describe", original)
    assert visibility(capture_case, receipt, row).status_code == 200
    assert client.get(owner_url(receipt) + f"?run_id={uuid4()}", headers=auth).status_code == 409
    with Session(engine) as db, db.begin():
        event = db.scalar(select(Release).where(Release.attempt_id == UUID(receipt["id"])))
        with pytest.raises(IntegrityError), db.begin_nested():
            db.add(
                Release(
                    attempt_id=event.attempt_id,
                    run_id=event.run_id,
                    assignment_version_id=event.assignment_version_id,
                    actor_id=event.actor_id,
                    request_key=uuid4(),
                    sequence=3,
                    released=False,
                )
            )
            db.flush()
    assert client.get(f"/api/v1/assignments/attempts/{receipt['id']}", headers=capture_case[2]).json() == receipt


def test_concurrent_release_single_event_and_conflicting_request(capture_case, bank):  # noqa: F811
    receipt, _ = evaluated(capture_case, bank)
    client, auth, _, _, engine = capture_case[0]
    row = owner(capture_case, receipt)
    from app.core.config import Settings

    settings = Settings(
        _env_file=None, environment="test", database_url=engine.url.render_as_string(hide_password=False)
    )
    barrier, key = Barrier(2), uuid4()

    def worker():
        with TestClient(create_app(settings)) as peer:
            barrier.wait(timeout=10)
            return peer.post(
                owner_url(receipt) + "/release",
                headers=auth | {"If-Match": row["revision"], "Idempotency-Key": str(key)},
                json={"run_id": row["evaluation"]["id"], "released": True, "confirm": True},
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: worker(), range(2)))
    assert [response.status_code for response in results] == [200, 200], [response.text for response in results]
    assert results[0].json() == results[1].json()
    with Session(engine) as db:
        assert (
            db.scalar(select(func.count()).select_from(Release).where(Release.attempt_id == UUID(receipt["id"]))) == 1
        )
    assert visibility(capture_case, receipt, results[0].json(), False, key=key).status_code == 409


def test_inflight_student_lock_yields_retry_instead_of_deadlock(capture_case, bank):  # noqa: F811
    receipt, _ = evaluated(capture_case, bank)
    engine = capture_case[0][4]
    from app.models.users import User

    with Session(engine) as db, db.begin():
        db.scalar(select(User).where(User.id == capture_case[3]).with_for_update())
        response = capture_case[0][0].get(owner_url(receipt), headers=capture_case[0][1])
        assert response.status_code == 409
    assert owner(capture_case, receipt)["attempt_id"] == receipt["id"]


def test_new_evaluations_never_replace_pinned_result_and_cross_attempt_runs_are_rejected(
    capture_case,  # noqa: F811
    bank,  # noqa: F811
    monkeypatch,
):  # noqa: F811
    receipt, first = evaluated(capture_case, bank)
    client, _, _, _, engine = capture_case[0]
    assert visibility(capture_case, receipt, owner(capture_case, receipt)).status_code == 200
    from app.modules.grading import service

    monkeypatch.setattr(service, "ENGINE_VERSION", "synthetic-new-engine-fixture")
    newer = evaluate(client, receipt)
    assert newer.status_code == 200 and newer.json()["id"] != first["id"]
    row = owner(capture_case, receipt)
    assert row["pinned_run_id"] == row["evaluation"]["id"] == first["id"]
    assert (
        client.get(owner_url(receipt) + f"?run_id={newer.json()['id']}", headers=capture_case[0][1]).status_code == 409
    )
    with Session(engine) as db, db.begin():
        event = db.scalar(select(Release).where(Release.attempt_id == UUID(receipt["id"])))
        with pytest.raises(IntegrityError), db.begin_nested():
            db.add(
                Release(
                    attempt_id=event.attempt_id,
                    run_id=UUID(newer.json()["id"]),
                    assignment_version_id=event.assignment_version_id,
                    actor_id=event.actor_id,
                    request_key=uuid4(),
                    sequence=2,
                    released=False,
                )
            )
            db.flush()
    new_draft = create(capture_case[0])[0].json()
    assert publish(capture_case[0], new_draft).status_code == 200
    other_case = capture_case[0], new_draft, capture_case[2], capture_case[3]
    other_receipt = finalize(other_case, empty=True)
    other_run = evaluate(client, other_receipt).json()
    assert visibility(capture_case, receipt, row, False, run_id=other_run["id"]).status_code == 409
    assert (
        visibility(other_case, other_receipt, owner(other_case, other_receipt), run_id=first["id"]).status_code == 404
    )
    evaluations = client.get(owner_url(receipt) + "/evaluations?limit=1", headers=capture_case[0][1]).json()
    assert len(evaluations["items"]) == 1 and evaluations["has_more"]
    assert client.get(owner_url(receipt) + "/evaluations?limit=0", headers=capture_case[0][1]).status_code == 422
