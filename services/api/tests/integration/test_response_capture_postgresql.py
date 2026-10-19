"""Synthetic capture through real HTTP/PostgreSQL, never runtime seeded content."""

from uuid import UUID, uuid4
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import pytest
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from tests.integration.conftest import pg_engine as disposable_engine_fixture
from tests.integration.test_assignment_drafts_postgresql import draft_case, create  # noqa: F401
from tests.integration.test_assignment_publication_postgresql import publish, join
from tests.integration.test_question_bank_postgresql import bank, context  # noqa: F401
from tests.integration.test_enrollment_postgresql import account
from app.models.assessments import AssignmentAttempt, StudentResponse, AssignmentVersion
from app.models.users import ClassMembership, UserSession

pytestmark = pytest.mark.postgresql


@pytest.fixture(scope="module")
def questions_engine():
    yield from disposable_engine_fixture.__wrapped__()


@pytest.fixture
def capture_case(draft_case):  # noqa: F811
    row = create(draft_case)[0].json()
    assert publish(draft_case, row).status_code == 200
    auth, student_id = join(draft_case)
    return draft_case, row, auth, student_id


def start(case):
    draft, row, auth, _ = case
    response = draft[0].post(f"/api/v1/assignments/{row['id']}/attempt", headers=auth)
    assert response.status_code == 200, response.text
    return response.json()


def endpoint(attempt):
    return f"/api/v1/assignments/attempts/{attempt['id']}"


ANSWERS = {
    "multiple_choice": {"option_id": "a"},
    "true_false": {"value": False},
    "identification": {"text": "  ñ😀 e\u0301  "},
    "fill_in_the_blank": {"blanks": [{"blank_id": "gap", "text": " raw "}]},
    "multiple_select": {"option_ids": ["b", "a"]},
    "flashcards": {"recall": "hard"},
    "error_identification": {"selected_token_ids": ["b"]},
    "word_arrangement": {"ordered_token_ids": ["b", "a"]},
    "sentence_arrangement": {"ordered_sentence_ids": ["a", "b"]},
    "matching_type": {"pairs": [{"left_id": "a", "right_id": "b"}, {"left_id": "b", "right_id": "a"}]},
}


def snapshot(attempt):
    return {
        "position": 4,
        "responses": [
            {"assignment_question_id": row["assignment_question_id"], "answer": ANSWERS[row["definition"]["method"]]}
            for row in attempt["questions"]
        ],
    }


def test_all_ten_capture_resume_reveal_finalization_and_immutable_receipt(capture_case):
    draft, published, auth, student_id = capture_case
    client, _, _, _, engine = draft
    attempt = start(capture_case)
    assert len(attempt["questions"]) == 10 and not attempt["responses"]
    assert start(capture_case)["id"] == attempt["id"]
    assert "answer_key" not in str(attempt) and "A synthetic answer" not in str(attempt)
    body = snapshot(attempt)
    assert (
        client.put(
            endpoint(attempt) + "/progress", headers=auth | {"If-Match": attempt["revision"]}, json=body
        ).status_code
        == 422
    )
    flash = next(row for row in attempt["questions"] if row["definition"]["method"] == "flashcards")
    reveal = client.post(
        endpoint(attempt) + f"/questions/{flash['assignment_question_id']}/reveal",
        headers=auth | {"If-Match": attempt["revision"]},
    )
    assert reveal.status_code == 200, reveal.text
    assert reveal.json()["back"] == "A synthetic answer" and "scoring_rubric" not in reveal.text
    attempt["revision"] = reveal.json()["attempt_revision"]
    saved = client.put(endpoint(attempt) + "/progress", headers=auth | {"If-Match": attempt["revision"]}, json=body)
    assert saved.status_code == 200, saved.text
    saved = saved.json()
    assert saved["completed_count"] == 10 and saved["position"] == 4
    assert start(capture_case)["responses"] == saved["responses"]
    text = next(row["answer"]["text"] for row in saved["responses"] if "text" in row["answer"])
    assert text == ANSWERS["identification"]["text"]
    assert (
        client.put(
            endpoint(attempt) + "/progress", headers=auth | {"If-Match": attempt["revision"]}, json=body
        ).status_code
        == 409
    )
    key = str(uuid4())
    final_body = body | {"confirm": True}
    submitted = client.post(
        endpoint(attempt) + "/submit",
        headers=auth | {"If-Match": saved["revision"], "Idempotency-Key": key},
        json=final_body,
    )
    assert submitted.status_code == 200, submitted.text
    receipt = submitted.json()
    assert (
        receipt["status"] == "submitted"
        and receipt["submitted_at"]
        and not receipt["questions"]
        and not receipt["responses"]
    )
    assert (
        client.post(
            endpoint(attempt) + "/submit",
            headers=auth | {"If-Match": saved["revision"], "Idempotency-Key": key},
            json=final_body,
        ).json()
        == receipt
    )
    assert start(capture_case) == receipt
    assert (
        client.post(
            endpoint(attempt) + f"/questions/{flash['assignment_question_id']}/reveal",
            headers=auth | {"If-Match": receipt["revision"]},
        ).status_code
        == 409
    )
    assert (
        client.put(
            endpoint(attempt) + "/progress", headers=auth | {"If-Match": receipt["revision"]}, json=body
        ).status_code
        == 409
    )
    with Session(engine) as db, db.begin():
        stored = db.get(AssignmentAttempt, UUID(attempt["id"]))
        assert stored.score is None and stored.maximum_score is None and stored.expires_at is None
        assert stored.capture_contract == "unscored-capture-v1"
        version = db.get(AssignmentVersion, UUID(published["version_id"]))
        assert version.max_attempts is None and version.publication_contract == "distribution-only-v1"
        responses = list(db.scalars(select(StudentResponse).where(StudentResponse.attempt_id == stored.id)))
        assert len(responses) == 10 and all(
            row.correct is None and row.awarded_points is None and row.grading_status == "unscored" for row in responses
        )
        with pytest.raises(IntegrityError), db.begin_nested():
            responses[0].submitted_at = datetime.now(timezone.utc)
            db.flush()
        with pytest.raises(IntegrityError), db.begin_nested():
            stored.status = "in_progress"
            db.flush()
        with pytest.raises(IntegrityError), db.begin_nested():
            db.add(
                AssignmentAttempt(
                    assignment_version_id=version.id,
                    student_id=student_id,
                    attempt_number=2,
                    started_at=datetime.now(timezone.utc),
                    capture_contract="unscored-capture-v1",
                    capture_state={},
                )
            )
            db.flush()


def test_partial_raw_buffers_incomplete_submit_ownership_membership_and_session(capture_case):
    draft, _, auth, student_id = capture_case
    client, _, _, _, engine = draft
    attempt = start(capture_case)
    other, _ = account(client, "school_student")
    assert client.get(endpoint(attempt), headers=other).status_code == 404
    assert client.get(endpoint(attempt)).status_code == 401
    text = next(row for row in attempt["questions"] if row["definition"]["method"] == "identification")
    partial = {
        "position": 3,
        "responses": [{"assignment_question_id": text["assignment_question_id"], "answer": {"text": "  \t "}}],
    }
    response = client.put(
        endpoint(attempt) + "/progress", headers=auth | {"If-Match": attempt["revision"]}, json=partial
    )
    assert response.status_code == 200, response.text
    saved = response.json()
    assert saved["completed_count"] == 0 and saved["responses"][0]["answer"]["text"] == "  \t "
    with Session(engine) as db, db.begin():
        member = db.scalar(select(ClassMembership).where(ClassMembership.student_id == student_id))
        member.status = "left"
        member.ended_at = datetime.now(timezone.utc)
    assert client.get(endpoint(attempt), headers=auth).status_code == 404
    # Test fixture restores eligibility without deleting the saved attempt.
    with Session(engine) as db, db.begin():
        member = db.scalar(select(ClassMembership).where(ClassMembership.student_id == student_id))
        member.status = "active"
        member.ended_at = None
    assert start(capture_case)["responses"] == saved["responses"]
    invalid = partial | {"responses": partial["responses"] * 2}
    assert (
        client.put(
            endpoint(attempt) + "/progress", headers=auth | {"If-Match": saved["revision"]}, json=invalid
        ).status_code
        == 422
    )
    result = client.post(
        endpoint(attempt) + "/submit",
        headers=auth | {"If-Match": saved["revision"], "Idempotency-Key": str(uuid4())},
        json=partial | {"confirm": True},
    )
    assert result.status_code == 200 and result.json()["completed_count"] == 0
    with Session(engine) as db, db.begin():
        db.scalar(select(UserSession).where(UserSession.user_id == student_id)).revoked_at = datetime.now(timezone.utc)
    assert client.get(endpoint(attempt), headers=auth).status_code == 401


def test_concurrent_start_save_submit_and_invalid_identifiers(capture_case):
    draft, _, auth, _ = capture_case
    client, _, _, _, engine = draft
    barrier = Barrier(2)

    def begin():
        barrier.wait()
        return start(capture_case)

    with ThreadPoolExecutor(2) as pool:
        attempts = list(pool.map(lambda _: begin(), range(2)))
    assert attempts[0]["id"] == attempts[1]["id"]
    attempt = attempts[0]
    assert (
        client.put(endpoint(attempt) + "/progress", headers=auth, json={"position": 1, "responses": []}).status_code
        == 428
    )
    assert (
        client.put(
            endpoint(attempt) + "/progress",
            headers=auth | {"If-Match": attempt["revision"]},
            json={"position": 11, "responses": []},
        ).status_code
        == 422
    )
    assert (
        client.put(
            endpoint(attempt) + "/progress",
            headers=auth | {"If-Match": attempt["revision"]},
            json={"position": 1, "responses": [{"assignment_question_id": str(uuid4()), "answer": {"value": True}}]},
        ).status_code
        == 422
    )
    barrier = Barrier(2)

    def save():
        barrier.wait()
        return client.put(
            endpoint(attempt) + "/progress",
            headers=auth | {"If-Match": attempt["revision"]},
            json={"position": 2, "responses": []},
        )

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda _: save(), range(2)))
    assert sorted(r.status_code for r in results) == [200, 409]
    saved = next(r.json() for r in results if r.status_code == 200)
    key, barrier = str(uuid4()), Barrier(2)

    def submit():
        barrier.wait()
        return client.post(
            endpoint(attempt) + "/submit",
            headers=auth | {"If-Match": saved["revision"], "Idempotency-Key": key},
            json={"position": 2, "responses": [], "confirm": True},
        )

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda _: submit(), range(2)))
    assert [r.status_code for r in results] == [200, 200]
    with Session(engine) as db:
        assert (
            db.scalar(
                select(func.count()).select_from(AssignmentAttempt).where(AssignmentAttempt.id == UUID(attempt["id"]))
            )
            == 1
        )


def test_save_failure_rolls_back_and_reveal_is_attempt_scoped(capture_case, monkeypatch):
    draft, _, auth, _ = capture_case
    client, _, _, _, _ = draft
    attempt = start(capture_case)
    other, _ = account(client, "school_student")
    flash = next(row for row in attempt["questions"] if row["definition"]["method"] == "flashcards")
    reveal = endpoint(attempt) + f"/questions/{flash['assignment_question_id']}/reveal"
    assert client.post(reveal, headers=other | {"If-Match": attempt["revision"]}).status_code == 404
    normal = next(row for row in attempt["questions"] if row["definition"]["method"] == "true_false")
    assert (
        client.post(
            endpoint(attempt) + f"/questions/{normal['assignment_question_id']}/reveal",
            headers=auth | {"If-Match": attempt["revision"]},
        ).status_code
        == 404
    )
    from app.modules.assignments import capture

    def interrupted(*args):
        raise RuntimeError("Synthetic failure after response flush")

    monkeypatch.setattr(capture, "audit", interrupted)
    with pytest.raises(RuntimeError, match="Synthetic failure"):
        client.put(
            endpoint(attempt) + "/progress",
            headers=auth | {"If-Match": attempt["revision"]},
            json={
                "position": 2,
                "responses": [{"assignment_question_id": normal["assignment_question_id"], "answer": {"value": False}}],
            },
        )
    restored = client.get(endpoint(attempt), headers=auth).json()
    assert restored["responses"] == [] and restored["position"] == 1
