"""October 21 synthetic smoke: real HTTP handlers, transactions and disposable PostgreSQL.
No mocked grading/auth successes; the existing test-only admin session issuer
is used explicitly because real OIDC configuration remains disabled.
"""

import pytest
from tests.integration.conftest import pg_engine as disposable_engine_fixture
from tests.integration.test_question_bank_postgresql import bank, context  # noqa: F401
from tests.integration.test_assignment_drafts_postgresql import draft_case, create  # noqa: F401
from tests.integration.test_assignment_publication_postgresql import join, publish
from tests.integration.test_grading_postgresql import finalize, grant, evaluate
from tests.integration.test_results_postgresql import owner, visibility
from uuid import uuid4

pytestmark = pytest.mark.postgresql


@pytest.fixture(scope="module")
def questions_engine():
    yield from disposable_engine_fixture.__wrapped__()


def test_oct21_real_backend_workflow(draft_case, bank):  # noqa: F811
    client, teacher, class_id, questions, _ = draft_case
    assert client.get(f"/api/v1/classes/{class_id}", headers=teacher).status_code == 200
    print("PASS: instructor opens owned class; synthetic published curriculum and all ten question methods exist.")
    response, body = create(draft_case)
    assert response.status_code == 201, response.text
    distributed = publish(draft_case, response.json())
    assert distributed.status_code == 200, distributed.text
    assert distributed.json()["status"] == "published" and len(distributed.json()["questions"]) == 10
    print("PASS: instructor creates and publishes a real pinned ten-method assignment.")
    student, student_id = join(draft_case)
    case = draft_case, distributed.json(), student, student_id
    receipt = finalize(case)
    assert receipt["status"] == "submitted"
    print("PASS: enrolled student answers all ten methods, deliberately reveals a Flashcard, and submits.")
    withheld = client.get(f"/api/v1/assignments/{distributed.json()['id']}/result", headers=student)
    assert withheld.status_code == 200 and withheld.json()["earned_points"] is None
    grant(bank)
    evaluated = evaluate(client, receipt)
    assert evaluated.status_code == 200, evaluated.text
    assert (
        evaluated.json()["status"] == "COMPLETE"
        and evaluated.json()["earned_points"] == "6.00"
        and evaluated.json()["possible_points"] == "9.00"
    )
    print(
        "PASS: explicitly permissioned synthetic admin grades persisted responses; actual exact-match result is 6.00/9.00; Flashcards N/A."
    )
    released = visibility(case, receipt, owner(case, receipt))
    assert released.status_code == 200, released.text
    visible = client.get(f"/api/v1/assignments/{distributed.json()['id']}/result", headers=student)
    assert visible.status_code == 200 and visible.json()["earned_points"] == "6.00"
    assert all(key not in visible.text for key in ('"answer_key"', '"accepted_answers"', '"back"'))
    monitoring = client.get(f"/api/v1/classes/{class_id}/monitoring/assignments", headers=teacher)
    assert monitoring.status_code == 200, monitoring.text
    summary = monitoring.json()["items"][0]
    assert summary["counts"]["submitted"] == 1 and summary["mean"]["mean_points"] == "6.00"
    print(
        "PASS: instructor releases result; student sees permitted persisted result; instructor monitoring shows real submission and released mean."
    )
    base = f"/api/v1/classes/{class_id}"
    announcement = client.post(
        base + "/announcements",
        headers=teacher | {"Idempotency-Key": str(uuid4())},
        json={"content": "SYNTHETIC DEMO: review the published assignment."},
    )
    assert announcement.status_code == 201, announcement.text
    assert client.get(base + "/announcements", headers=student).json()["items"][0]["id"] == announcement.json()["id"]
    key = str(uuid4())
    message = client.post(
        base + f"/messages/{student_id}",
        headers=teacher | {"Idempotency-Key": key},
        json={"content": "SYNTHETIC DEMO: do you have a question?"},
    )
    retry = client.post(
        base + f"/messages/{student_id}",
        headers=teacher | {"Idempotency-Key": key},
        json={"content": "SYNTHETIC DEMO: do you have a question?"},
    )
    assert message.status_code == retry.status_code == 201 and message.json()["id"] == retry.json()["id"]
    opened = client.post(base + f"/communication/messages/{message.json()['id']}/read", headers=student, json={})
    assert opened.status_code == 200 and opened.json()["read"] is True
    reply = client.post(
        base + f"/messages/{student_id}",
        headers=student | {"Idempotency-Key": str(uuid4())},
        json={"content": "SYNTHETIC DEMO: salamat, malinaw na. ñ😀"},
    )
    assert reply.status_code == 201, reply.text
    assert client.get(base + f"/messages/{student_id}", headers=teacher).json()["items"][0]["id"] == reply.json()["id"]
    print(
        "PASS: class announcement, direct send/retry deduplication, own read mark and student reply persist and re-read correctly."
    )
    disabled = client.post("/api/v1/admin/auth/start")
    assert disabled.status_code == 503, disabled.text
    print(
        "BLOCKED FOR LIVE DEMO: real OIDC sign-in is safely disabled. This is a backend/database smoke, not an authenticated native/browser walkthrough."
    )
