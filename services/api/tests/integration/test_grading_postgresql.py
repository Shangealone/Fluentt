"""Internal evaluation of synthetic classroom captures in a generated PostgreSQL DB."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import UUID, uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.config import Settings
from app.main import create_app
from app.models.assessments import QuestionAnswerKey, AssignmentAttempt, StudentResponse
from datetime import datetime, timezone
from app.models.grading import GradingRun, GradingItemResult
from app.models.operations import AuditLog
from app.modules.administration.cli import grading_permission, provision, revoke
from app.modules.administration.repository import AdminRepository
from app.modules.administration.service import issue_session, resolve_session
from app.modules.grading.engine import Outcome, ENGINE_VERSION, POLICY_VERSION
from tests.integration.conftest import pg_engine as disposable_engine_fixture
from tests.integration.test_response_capture_postgresql import capture_case, start, snapshot, endpoint  # noqa: F401
from tests.integration.test_assignment_drafts_postgresql import draft_case  # noqa: F401
from tests.integration.test_assignment_drafts_postgresql import create as create_draft
from tests.integration.test_assignment_publication_postgresql import publish as publish_assignment
from tests.integration.test_question_bank_postgresql import bank, context, publish  # noqa: F401
from tests.test_question_bank import definition
from tests.test_question_config import EXAMPLES

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/admin/grading"
BODY = {"policy_version": "objective-exact-v1"}


@pytest.fixture(scope="module")
def questions_engine():
    yield from disposable_engine_fixture.__wrapped__()


def grant(fixture_data, access="runner", allowed=True):
    _, name, engine = fixture_data
    with Session(engine) as db:
        grading_permission(AdminRepository(db), name, grant=allowed, access=access)


def finalize(case, *, empty=False):
    client, auth = case[0][0], case[2]
    attempt = start(case)
    if not empty:
        flash = next(row for row in attempt["questions"] if row["definition"]["method"] == "flashcards")
        back = client.post(
            endpoint(attempt) + f"/questions/{flash['assignment_question_id']}/reveal",
            headers=auth | {"If-Match": attempt["revision"]},
        )
        assert back.status_code == 200, back.text
        attempt["revision"] = back.json()["attempt_revision"]
    body = {"position": 1, "responses": []} if empty else snapshot(attempt)
    result = client.post(
        endpoint(attempt) + "/submit",
        headers=auth | {"If-Match": attempt["revision"], "Idempotency-Key": str(uuid4())},
        json=body | {"confirm": True},
    )
    assert result.status_code == 200, result.text
    return result.json()


def evaluate(client, attempt):
    return client.post(f"{BASE}/attempts/{attempt['id']}/evaluate", json=BODY)


def test_real_evaluation_permissions_private_keys_and_unchanged_capture(capture_case, bank):  # noqa: F811
    client, name, engine = bank
    receipt = finalize(capture_case)
    assert evaluate(client, receipt).status_code == 403
    grant(bank, "reader")
    assert client.get(f"{BASE}/attempts/{receipt['id']}/runs").json()["items"] == []
    assert evaluate(client, receipt).status_code == 403
    grant(bank)
    assert (
        client.post(f"{BASE}/attempts/{receipt['id']}/evaluate", json=BODY, headers={"X-CSRF-Token": ""}).status_code
        == 403
    )
    assert (
        client.post(
            f"{BASE}/attempts/{receipt['id']}/evaluate", json=BODY, headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    assert client.post(f"{BASE}/attempts/{receipt['id']}/evaluate", json=BODY | {"score": 100}).status_code == 422
    result = evaluate(client, receipt)
    assert result.status_code == 200, result.text
    run = result.json()
    assert run["status"] == "COMPLETE" and run["earned_points"] == "6.00" and run["possible_points"] == "9.00"
    assert run["engine_version"] == ENGINE_VERSION and run["policy_version"] == POLICY_VERSION
    assert len(run["items"]) == 10 and sum(row["state"] == "NOT_APPLICABLE" for row in run["items"]) == 1
    assert not any(
        value in result.text
        for value in (
            '"configuration"',
            '"answer_key"',
            '"back"',
            '"accepted_answers"',
            '"correct_option_id"',
            "Private synthetic",
            "A synthetic answer",
        )
    )
    assert "no-store" in result.headers["cache-control"]
    assert evaluate(client, receipt).json() == run
    assert client.get(f"{BASE}/runs/{run['id']}").json() == run
    listing = client.get(f"{BASE}/attempts/{receipt['id']}/runs?limit=1").json()
    assert len(listing["items"]) == 1 and not listing["has_more"] and "items" not in listing["items"][0]
    assert client.get(endpoint(receipt), headers=capture_case[2]).json() == receipt
    with Session(engine) as db:
        attempt = db.get(AssignmentAttempt, UUID(receipt["id"]))
        assert attempt.status == "submitted" and attempt.score is None and attempt.maximum_score is None
        responses = list(db.scalars(select(StudentResponse).where(StudentResponse.attempt_id == attempt.id)))
        assert all(
            row.correct is None and row.awarded_points is None and row.grading_status == "unscored" for row in responses
        )
        assert (
            db.scalar(
                select(func.count())
                .select_from(AuditLog)
                .where(AuditLog.action == "grading.evaluate", AuditLog.entity_id == UUID(run["id"]))
            )
            == 1
        )
    with pytest.raises(ValueError, match="Another role"):
        grant(bank, "reader", False)
    grant(bank, "runner", False)
    assert evaluate(client, receipt).status_code == 403
    assert client.get(f"{BASE}/runs/{run['id']}").status_code == 200
    with Session(engine) as db:
        revoke(AdminRepository(db), name)
    assert client.get(f"{BASE}/runs/{run['id']}").status_code == 401


def test_no_mobile_access_no_unfinalized_attempts_and_missing_zero(capture_case, bank):  # noqa: F811
    client, _, _ = bank
    grant(bank)
    attempt = start(capture_case)
    assert evaluate(client, attempt).status_code == 409
    receipt = finalize(capture_case, empty=True)
    result = evaluate(client, receipt)
    assert result.status_code == 200, result.text
    assert result.json()["earned_points"] == "0.00" and result.json()["possible_points"] == "9.00"
    client.cookies.clear()
    assert client.get(f"{BASE}/runs/{result.json()['id']}").status_code == 401
    assert (
        client.post(f"{BASE}/attempts/{receipt['id']}/evaluate", headers=capture_case[2], json=BODY).status_code == 401
    )


def test_pinned_revision_after_correction_and_retirement_and_result_freeze(capture_case, bank):  # noqa: F811
    client, _, engine = bank
    receipt = finalize(capture_case)
    grant(bank)
    original = capture_case[0][3][0]
    body = definition(EXAMPLES[0]) | {
        "lesson_id": original["definition"]["lesson_id"],
        "answer_key": {"correct_option_id": "b"},
    }
    updated = client.post(
        f"/api/v1/admin/questions/{original['question_id']}/revisions",
        headers={"If-Match": original["revision"]},
        json=body,
    )
    assert updated.status_code == 201, updated.text
    newer = publish(client, updated.json())
    retired = client.post(
        f"/api/v1/admin/questions/{original['question_id']}/retire", headers={"If-Match": newer["revision"]}
    )
    assert retired.status_code == 200, retired.text
    response = evaluate(client, receipt)
    assert response.status_code == 200, response.text
    run = response.json()
    item = next(row for row in run["items"] if row["method"] == "multiple_choice")
    assert item["question_revision_id"] == original["id"] and item["awarded_points"] == "1.00"
    with Session(engine) as db, db.begin():
        key = db.scalar(select(QuestionAnswerKey).where(QuestionAnswerKey.question_revision_id == UUID(original["id"])))
        assert item["key_id"] == str(key.id)
        stored = db.get(GradingRun, UUID(run["id"]))
        with pytest.raises(IntegrityError), db.begin_nested():
            stored.earned_points = 0
            db.flush()
        with pytest.raises(IntegrityError), db.begin_nested():
            db.delete(db.get(GradingItemResult, UUID(item["id"])))
            db.flush()
    assert evaluate(client, receipt).json() == run


def test_review_states_totals_and_rollback(capture_case, bank, monkeypatch):  # noqa: F811
    client, _, engine = bank
    receipt = finalize(capture_case)
    grant(bank)
    from app.modules.grading import service

    original_describe, original_evaluate = service.describe, service.evaluate

    def interrupted(*args):
        raise RuntimeError("Synthetic grading failure after flush")

    monkeypatch.setattr(service, "describe", interrupted)
    with pytest.raises(RuntimeError, match="Synthetic grading failure"):
        evaluate(client, receipt)
    with Session(engine) as db:
        assert (
            db.scalar(select(func.count()).select_from(GradingRun).where(GradingRun.attempt_id == UUID(receipt["id"])))
            == 0
        )
    monkeypatch.setattr(service, "describe", original_describe)

    def flagged(method, *args, **kwargs):
        if method == "identification":
            return Outcome("MANUAL_REVIEW_REQUIRED", "synthetic_review_fixture")
        if method == "fill_in_the_blank":
            return Outcome("UNSUPPORTED", "synthetic_unsupported_fixture")
        return original_evaluate(method, *args, **kwargs)

    monkeypatch.setattr(service, "evaluate", flagged)
    result = evaluate(client, receipt)
    assert result.status_code == 200, result.text
    run = result.json()
    assert run["status"] == "REVIEW_REQUIRED" and run["earned_points"] is None and run["possible_points"] is None
    assert run["automatic_earned_points"] == "6.00" and run["automatic_possible_points"] == "7.00"
    assert {row["state"] for row in run["items"]} == {
        "AUTO_GRADABLE",
        "NOT_APPLICABLE",
        "MANUAL_REVIEW_REQUIRED",
        "UNSUPPORTED",
    }


def test_two_authorized_administrators_concurrently_get_one_run(capture_case, bank):  # noqa: F811
    client, _, engine = bank
    receipt = finalize(capture_case)
    grant(bank)
    name = "Grade_" + uuid4().hex[:12]
    with Session(engine) as db:
        repo = AdminRepository(db)
        provision(repo, name, "https://id.example", name)
        grading_permission(repo, name, grant=True, access="runner")
        token = issue_session(repo, "https://id.example", name)
        profile = resolve_session(repo, token)
    settings = Settings(
        _env_file=None, environment="test", database_url=engine.url.render_as_string(hide_password=False)
    )
    with TestClient(create_app(settings)) as other:
        other.cookies.set("fluentt_admin", token)
        other.headers.update({"Origin": settings.admin_web_origin, "X-CSRF-Token": profile.csrf_token})
        question = capture_case[0][3][0]
        assert (
            other.get(f"/api/v1/admin/questions/{question['question_id']}/revisions/{question['id']}/key").status_code
            == 403
        )
        barrier = Barrier(2)

        def run(target):
            barrier.wait()
            return evaluate(target, receipt)

        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(run, (client, other)))
    assert [row.status_code for row in results] == [200, 200], [row.text for row in results]
    assert results[0].json()["id"] == results[1].json()["id"]
    with Session(engine) as db:
        assert (
            db.scalar(select(func.count()).select_from(GradingRun).where(GradingRun.attempt_id == UUID(receipt["id"])))
            == 1
        )


def test_flashcard_only_evaluation_has_no_score_or_denominator(capture_case, bank):  # noqa: F811
    client, _, _ = bank
    grant(bank)
    fixture_data = capture_case[0]
    flash = next(row for row in fixture_data[3] if row["definition"]["method"] == "flashcards")
    draft = create_draft(
        fixture_data,
        {
            "title": "Synthetic Flashcard-only assignment",
            "lesson_id": flash["definition"]["lesson_id"],
            "question_revision_ids": [flash["id"]],
        },
    )[0]
    assert draft.status_code == 201, draft.text
    publication = publish_assignment(fixture_data, draft.json())
    assert publication.status_code == 200, publication.text
    auth = capture_case[2]
    started = client.post(f"/api/v1/assignments/{publication.json()['id']}/attempt", headers=auth)
    assert started.status_code == 200, started.text
    attempt = started.json()
    receipt = client.post(
        endpoint(attempt) + "/submit",
        headers=auth | {"If-Match": attempt["revision"], "Idempotency-Key": str(uuid4())},
        json={"position": 1, "responses": [], "confirm": True},
    )
    assert receipt.status_code == 200, receipt.text
    result = evaluate(client, receipt.json())
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "NOT_APPLICABLE"
    assert result.json()["earned_points"] is None and result.json()["possible_points"] is None
    assert result.json()["automatic_possible_points"] == "0.00"


def test_malformed_historical_finalization_is_reviewed_without_rewriting_evidence(capture_case, bank):  # noqa: F811
    client, _, engine = bank
    grant(bank)
    attempt = start(capture_case)
    item = next(row for row in attempt["questions"] if row["definition"]["method"] == "true_false")
    # Synthetic operator/legacy failure: bypass the normal atomic submit API to
    # leave a structurally valid response without its finalization timestamp.
    with Session(engine) as db, db.begin():
        db.add(
            StudentResponse(
                attempt_id=UUID(attempt["id"]),
                assignment_question_id=UUID(item["assignment_question_id"]),
                assignment_version_id=UUID(attempt["version_id"]),
                answer={"value": True},
                grading_status="unscored",
            )
        )
        db.flush()
        stored = db.get(AssignmentAttempt, UUID(attempt["id"]))
        stored.status = "submitted"
        stored.submitted_at = datetime.now(timezone.utc)
        stored.submission_key = uuid4()
        stored.submission_fingerprint = "a" * 64
    result = evaluate(client, attempt)
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "REVIEW_REQUIRED" and result.json()["earned_points"] is None
    flagged = next(row for row in result.json()["items"] if row["method"] == "true_false")
    assert flagged["state"] == "MANUAL_REVIEW_REQUIRED" and flagged["reason"] == "invalid_submission_evidence"
    with Session(engine) as db:
        assert db.get(StudentResponse, UUID(flagged["response_id"])).submitted_at is None
