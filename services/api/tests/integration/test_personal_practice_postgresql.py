"""Personal practice HTTP contracts in an isolated UUID PostgreSQL database."""
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.assessments import AssignmentAttempt
from tests.integration.test_question_bank_postgresql import (  # noqa: F401
    bank, context, questions_engine, add, publish, publish_curriculum, path, BASE,
)
from tests.integration.test_enrollment_postgresql import account
from tests.test_question_config import EXAMPLES

pytestmark = pytest.mark.postgresql
ROOT = "/api/v1/me/practice"


def personal(client, language="tagalog"):
    auth, _ = account(client, "personal_student")
    response = client.patch("/api/v1/users/me/preferences", headers=auth,
                            json={"language": language, "learning_focus": {"topics": ["Vocabulary"], "lessons": []}})
    assert response.status_code == 200, response.text
    return auth


def test_personal_all_methods_difficulty_and_private_projection(bank, context):  # noqa: F811
    client, _, engine = bank
    rows = [add(client, context, example)[0] for example in EXAMPLES]
    publish_curriculum(client, context)
    rows = [publish(client, row) for row in rows]
    auth = personal(client)
    lesson_id = context[5]["id"]
    listing = client.get(ROOT + "/lessons", headers=auth)
    assert listing.status_code == 200, listing.text
    lesson = next(row for row in listing.json()["items"] if row["id"] == lesson_id)
    assert lesson["difficulties"] == ["medium"] and "grade" not in lesson
    assert client.get(ROOT + "/lessons", headers=auth, params={"difficulty": "easy"}).json()["items"] == []
    assert client.get(ROOT + "/lessons", headers=auth, params={"q": "%"}).json()["items"] == []
    question_path = f"{ROOT}/lessons/{lesson_id}/questions"
    response = client.get(question_path, headers=auth)
    assert response.status_code == 200, response.text
    assert len(response.json()["items"]) == 10
    assert {row["definition"]["method"] for row in response.json()["items"]} == {example[0] for example in EXAMPLES}
    assert all(key not in response.text for key in ['"answer_key"', '"back"', '"explanation"', "Private synthetic"])
    for res in (listing, response, client.get(ROOT + "/lessons?difficulty=grade7", headers=auth)):
        assert "no-store" in res.headers["cache-control"]
    card = next(row for row in rows if row["definition"]["method"] == "flashcards")
    reveal = client.post(f"{ROOT}/flashcards/{card['id']}/reveal", headers=auth)
    assert reveal.status_code == 200, reveal.text
    assert reveal.json() == {"revision_id": card["id"], "back": "A synthetic answer"}
    assert client.post(f"{ROOT}/flashcards/{rows[0]['id']}/reveal", headers=auth).status_code == 404
    # A new draft is not automatically personal practice content.
    draft = client.post(f"{BASE}/{rows[0]['question_id']}/revisions", headers={"If-Match": rows[0]["revision"]},
                        json=add_body(context))
    assert draft.status_code == 201, draft.text
    assert rows[0]["id"] in {row["id"] for row in client.get(question_path, headers=auth).json()["items"]}
    assert draft.json()["id"] not in {row["id"] for row in client.get(question_path, headers=auth).json()["items"]}
    # Retirement removes live practice access, including deliberate reveal.
    retired = client.post(f"{BASE}/{card['question_id']}/retire", headers={"If-Match": card["revision"]})
    assert retired.status_code == 200, retired.text
    assert client.post(f"{ROOT}/flashcards/{card['id']}/reveal", headers=auth).status_code == 404
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(AssignmentAttempt)) == 0


def add_body(context):
    from tests.test_question_bank import definition
    return definition(EXAMPLES[0]) | {"lesson_id": context[5]["id"], "competency_ids": [context[6]["id"]], "prompt": "Unpublished draft"}


def test_personal_role_language_and_unpublished_content(bank, context):  # noqa: F811
    client, _, _ = bank
    row, _ = add(client, context)
    auth = personal(client)
    unpublished = client.get(f"{ROOT}/lessons/{context[5]['id']}/questions", headers=auth)
    assert unpublished.status_code == 404
    publish_curriculum(client, context)
    publish(client, row)
    english = personal(client, "english")
    assert client.get(ROOT + "/lessons", headers=english).json()["items"] == []
    for role in ("instructor", "school_student"):
        other, _ = account(client, role)
        for url in (ROOT + "/lessons", f"{ROOT}/lessons/{context[5]['id']}/questions"):
            assert client.get(url, headers=other).status_code == 403
    assert client.get(ROOT + "/lessons").status_code == 401
    assert client.get(f"{ROOT}/lessons/{uuid4()}/questions", headers=auth).status_code == 404
