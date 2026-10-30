"""Import/publication/feedback checks only in the generated disposable database."""
from uuid import UUID

import pytest
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.assessments import Question, QuestionRevision, QuestionAnswerKey, AssignmentAttempt
from app.models.curriculum import CurriculumVersion
from app.modules.administration.cli import questions_permission
from app.modules.administration.repository import AdminRepository
from app.modules.questions.pilot_content import LESSONS, content_id
from app.modules.questions.pilot_import import import_drafts
from tests.integration.test_question_bank_postgresql import bank, questions_engine, publish, BASE
from tests.integration.test_curriculum_management_postgresql import REVIEW, BASE as CURRICULUM
from tests.integration.test_personal_practice_postgresql import personal, ROOT

pytestmark = pytest.mark.postgresql


def test_draft_import_is_atomic_repeatable_permissioned_and_not_public(bank):
    client, name, engine = bank
    with Session(engine) as db, db.begin():
        with pytest.raises(ValueError):
            import_drafts(db, "NoSuchEditor")
    with Session(engine) as db, db.begin():
        result = import_drafts(db, name)
        assert result["created"] is True
    with Session(engine) as db, db.begin():
        assert import_drafts(db, name)["created"] is False
        assert db.scalar(select(func.count()).select_from(Question)) == 37
        assert db.scalar(select(func.count()).select_from(QuestionAnswerKey)) == 37
        assert db.get(CurriculumVersion, content_id("version")).status == "draft"
    auth = personal(client, "english")
    assert client.get(ROOT + "/lessons", headers=auth).json()["items"] == []
    rid = content_id("ability/revision/0")
    assert client.post(f"{ROOT}/questions/{rid}/check", headers=auth, json={"answer": {"option_id": "o0"}}).status_code == 404
    version = client.get(f"{CURRICULUM}/versions/{content_id('version')}").json()
    response = client.post(f"{CURRICULUM}/versions/{version['id']}/publish", headers={"If-Match": version["revision"]}, json=REVIEW)
    assert response.status_code == 200, response.text
    # Publish using the existing admin API, never through the importer.
    for lesson in LESSONS:
        for index, _ in enumerate(lesson["items"]):
            qid = content_id(f"{lesson['slug']}/question/{index}")
            rows = client.get(f"{BASE}/{qid}/revisions").json()["items"]
            publish(client, rows[0])
    catalog = client.get(ROOT + "/lessons", headers=auth)
    assert len(catalog.json()["items"]) == 3
    assert all(row["introduction"] and row["feedback_available"] for row in catalog.json()["items"])
    url = f"{ROOT}/questions/{rid}/check"
    for option, correct in [("o1", False), ("o0", True)]:
        response = client.post(url, headers=auth, json={"answer": {"option_id": option}})
        assert response.status_code == 200, response.text
        assert response.json()["correct"] is correct
        assert set(response.json()) == {"revision_id", "correct", "message"}
        assert "no-store" in response.headers["cache-control"]
    for body in [{"answer": {"option_id": "unknown"}}, {"answer": {}}, {"answer": {"option_id": "o0"}, "correct": True}]:
        assert client.post(url, headers=auth, json=body).status_code == 422
    word_rid = content_id("ability/revision/4")
    word_url = f"{ROOT}/questions/{word_rid}/check"
    assert client.post(word_url, headers=auth, json={"answer": {"ordered_token_ids": ["t0"]}}).status_code == 422
    assert client.post(word_url, headers=auth, json={"answer": {"ordered_token_ids": ["t0", "t1", "t2", "t3"]}}).json()["correct"] is True
    assert client.post(word_url, headers=auth, json={"answer": {"ordered_token_ids": ["t3", "t2", "t1", "t0"]}}).json()["correct"] is False
    other = personal(client, "tagalog")
    assert client.post(url, headers=other, json={"answer": {"option_id": "o0"}}).status_code == 404
    client.cookies.clear()
    assert client.post(url, json={"answer": {"option_id": "o0"}}).status_code == 401
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(AssignmentAttempt)) == 0
    with Session(engine) as db:
        questions_permission(AdminRepository(db), name, grant=False, access="editor")
    with Session(engine) as db, db.begin():
        with pytest.raises(ValueError):
            import_drafts(db, name)
