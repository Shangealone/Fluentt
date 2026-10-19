"""Real HTTP/PostgreSQL question bank using synthetic, disposable fixture data only."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.models.assessments import (
    QuestionRevision,
    QuestionAnswerKey,
    Assignment,
    AssignmentVersion,
    AssignmentQuestion,
)
from app.models.operations import AuditLog
from app.modules.administration.cli import provision, curriculum_permission, questions_permission, revoke
from app.modules.administration.repository import AdminRepository
from app.modules.administration.service import issue_session, resolve_session, utcnow
from tests.integration.conftest import pg_engine as disposable_engine_fixture
from tests.integration.test_curriculum_management_postgresql import hierarchy, get, REVIEW, BASE as CURRICULUM
from tests.test_question_config import EXAMPLES
from tests.test_question_bank import definition

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/admin/questions"


@pytest.fixture(scope="module")
def questions_engine():
    yield from disposable_engine_fixture.__wrapped__()


@pytest.fixture
def bank(questions_engine):
    name = "Fixture_" + uuid4().hex[:12]
    with Session(questions_engine) as db:
        repo = AdminRepository(db)
        provision(repo, name, "https://id.example", name)
        for access in ("editor", "publisher"):
            curriculum_permission(repo, name, grant=True, access=access)
            questions_permission(repo, name, grant=True, access=access)
        token = issue_session(repo, "https://id.example", name)
        profile = resolve_session(repo, token)
    settings = Settings(
        _env_file=None, environment="test", database_url=questions_engine.url.render_as_string(hide_password=False)
    )
    with TestClient(create_app(settings)) as client:
        client.cookies.set("fluentt_admin", token)
        client.headers.update({"Origin": settings.admin_web_origin, "X-CSRF-Token": profile.csrf_token})
        yield client, name, questions_engine


@pytest.fixture
def context(bank):
    return hierarchy(bank[0])


def add(client, nodes, example=None):
    body = definition(example) | {"lesson_id": nodes[5]["id"], "competency_ids": [nodes[6]["id"]]}
    response = client.post(BASE, json=body)
    assert response.status_code == 201, response.text
    return response.json(), body


def path(row):
    return f"{BASE}/{row['question_id']}/revisions/{row['id']}"


def publish_curriculum(client, nodes):
    version = get(client, nodes[0])
    response = client.post(
        f"{CURRICULUM}/versions/{version['id']}/publish", headers={"If-Match": version["revision"]}, json=REVIEW
    )
    assert response.status_code == 200, response.text
    return response.json()


def publish(client, row):
    response = client.post(path(row) + "/publish", headers={"If-Match": row["revision"]})
    assert response.status_code == 200, response.text
    return response.json()


def test_all_ten_real_persistence_private_keys_and_safe_reads(bank, context):
    client, _, engine = bank
    for example in EXAMPLES:
        row, body = add(client, context, example)
        assert row["definition"]["method"] == example[0] and row["version"] == 1 and row["locked_at"] is None
        assert "answer_key" not in row["definition"] and "explanation" not in row["definition"]
        safe = client.get(path(row))
        assert safe.status_code == 200 and "Private synthetic feedback" not in safe.text
        private = client.get(path(row) + "/key")
        assert private.status_code == 200, private.text
        assert private.json()["definition"]["answer_key"].items() >= body["answer_key"].items()
        with Session(engine) as db:
            stored = db.get(QuestionRevision, UUID(row["id"]))
            assert stored.content == body["content"]
            key = db.scalar(select(QuestionAnswerKey).where(QuestionAnswerKey.question_revision_id == stored.id))
            assert key.grading_version == "ungraded-v1"
        assert client.get(f"{BASE}/{row['question_id']}/revisions?limit=1").json()["items"][0]["id"] == row["id"]
    page = client.get(BASE, params={"lesson_id": context[5]["id"], "limit": 3}).json()
    assert len(page["items"]) == 3 and page["has_more"]
    assert "answer_key" not in str(page) and "explanation" not in str(page)
    assert (
        client.get(BASE, params={"lesson_id": context[5]["id"], "method": "flashcards"}).json()["items"][0]["method"]
        == "flashcards"
    )
    assert client.get(BASE, params={"q": "impossible fixture search"}).json()["items"] == []


def test_lifecycle_new_versions_and_frozen_history(bank, context):
    client, _, engine = bank
    row, body = add(client, context)
    assert client.post(path(row) + "/publish", headers={"If-Match": row["revision"]}).status_code == 409
    publish_curriculum(client, context)
    first = publish(client, row)
    assert first["locked_at"] and first["status"] == "published"
    assert client.put(path(first), headers={"If-Match": first["revision"]}, json=body).status_code == 409
    response = client.post(
        f"{BASE}/{first['question_id']}/revisions",
        headers={"If-Match": first["revision"]},
        json=body | {"prompt": "Synthetic corrected revision"},
    )
    assert response.status_code == 201, response.text
    second = response.json()
    assert second["version"] == 2 and second["id"] != first["id"]
    second = publish(client, second)
    assert client.get(path(first)).json()["definition"]["prompt"] == body["prompt"]
    history = client.get(f"{BASE}/{first['question_id']}/revisions").json()
    assert [entry["version"] for entry in history["items"]] == [2, 1]
    retired = client.post(f"{BASE}/{first['question_id']}/retire", headers={"If-Match": second["revision"]})
    assert retired.status_code == 200 and retired.json()["archived_at"]
    assert client.get(path(first)).status_code == 200
    assert (
        client.post(
            f"{BASE}/{first['question_id']}/revisions", headers={"If-Match": retired.json()["revision"]}, json=body
        ).status_code
        == 409
    )
    with Session(engine) as db:
        assert (
            len(
                list(
                    db.scalars(
                        select(QuestionRevision).where(QuestionRevision.question_id == UUID(first["question_id"]))
                    )
                )
            )
            == 2
        )
        audits = list(db.scalars(select(AuditLog).where(AuditLog.entity_id == UUID(first["question_id"]))))
        assert {"questions.create", "questions.new_revision", "questions.publish", "questions.retire"} <= {
            a.action for a in audits
        }
        assert all(a.actor_id and "answer_key" not in str(a.safe_metadata) for a in audits)


def test_atomic_definition_replacement_stale_updates_and_wrong_parent(bank, context):
    client, _, engine = bank
    row, body = add(client, context)
    updated_body = body | {
        "content": {"options": [{"id": "x", "text": "New X"}, {"id": "y", "text": "New Y"}]},
        "answer_key": {"correct_option_id": "y"},
    }
    response = client.put(path(row), headers={"If-Match": row["revision"]}, json=updated_body)
    assert response.status_code == 200, response.text
    fresh = response.json()
    assert client.get(path(row) + "/key").json()["definition"]["answer_key"] == {"correct_option_id": "y"}
    assert client.put(path(row), headers={"If-Match": row["revision"]}, json=body).status_code == 409
    assert client.put(path(row), json=body).status_code == 428
    for bad in [
        {"lesson_id": str(uuid4())},
        {"competency_ids": [str(uuid4())]},
        {"answer_key": {"correct_option_id": "missing"}},
        {"correct": True},
    ]:
        response = client.put(path(row), headers={"If-Match": fresh["revision"]}, json=updated_body | bad)
        assert response.status_code == 422, response.text
    assert client.get(path(row)).json()["revision"] == fresh["revision"]
    assert client.get(f"{BASE}/{uuid4()}/revisions/{row['id']}").status_code == 404
    with Session(engine) as db:
        assert db.get(QuestionRevision, UUID(row["id"])).content == updated_body["content"]


def test_permissions_are_separate_live_and_key_access_requires_editor(bank, context):
    client, name, engine = bank
    row, body = add(client, context)
    with Session(engine) as db:
        questions_permission(AdminRepository(db), name, grant=False, access="publisher")
    assert client.post(path(row) + "/publish", headers={"If-Match": row["revision"]}).status_code == 403
    with Session(engine) as db:
        questions_permission(AdminRepository(db), name, grant=True, access="publisher")
        questions_permission(AdminRepository(db), name, grant=False, access="editor")
    assert client.get(path(row)).status_code == 200
    assert client.get(path(row) + "/key").status_code == 403
    assert client.post(BASE, json=body).status_code == 403
    assert client.post(path(row) + "/publish", headers={"If-Match": row["revision"]}).status_code == 403
    with Session(engine) as db:
        questions_permission(AdminRepository(db), name, grant=False, access="publisher")
    assert client.get(BASE).status_code == 403  # Curriculum permissions do not imply question reads.
    with Session(engine) as db:
        questions_permission(AdminRepository(db), name, grant=True, access="reader")
        questions_permission(AdminRepository(db), name, grant=True, access="reader")  # Idempotent.
    assert client.get(BASE).status_code == 200
    assert client.get(path(row) + "/key").status_code == 403
    with Session(engine) as db:
        revoke(AdminRepository(db), name)
    assert client.get(BASE).status_code == 401


def test_cookie_origin_csrf_mobile_anonymous_and_no_public_delivery(bank, context):
    client, _, _ = bank
    row, body = add(client, context)
    assert client.post(BASE, json=body, headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post(BASE, json=body, headers={"X-CSRF-Token": "bad"}).status_code == 403
    assert client.post(BASE, json=body, headers={b"X-CSRF-Token": b"\xff"}).status_code == 403
    mobile = client.post(
        "/api/v1/users", json={"username": "Fixture_" + uuid4().hex[:12], "role": "personal_student"}
    ).json()
    assert client.get(BASE, headers={"Authorization": "Bearer " + mobile["session"]["credential"]}).status_code == 401
    client.cookies.clear()
    assert client.get(path(row)).status_code == 401
    assert client.post(BASE, json=body).status_code == 401
    assert client.get("/api/v1/questions").status_code == 404
    assert client.post("/api/v1/responses", json={"correct": True}).status_code == 404


@pytest.mark.parametrize("new_revision", [False, True])
def test_stale_concurrent_edits_have_one_winner(bank, context, new_revision):
    client, _, engine = bank
    row, body = add(client, context)
    name = "Fixture_" + uuid4().hex[:12]
    with Session(engine) as db:
        repo = AdminRepository(db)
        provision(repo, name, "https://id.example", name)
        questions_permission(repo, name, grant=True, access="editor")
        token = issue_session(repo, "https://id.example", name)
        profile = resolve_session(repo, token)
    second_headers = {"Cookie": "fluentt_admin=" + token, "X-CSRF-Token": profile.csrf_token}
    barrier = Barrier(2)

    def submit(entry):
        prompt, headers = entry
        barrier.wait(timeout=10)
        method = client.post if new_revision else client.put
        target = f"{BASE}/{row['question_id']}/revisions" if new_revision else path(row)
        return method(
            target, headers=headers | {"If-Match": row["revision"]}, json=body | {"prompt": prompt}
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(submit, [("Synthetic A", {}), ("Synthetic B", second_headers)])) == [
            201 if new_revision else 200,
            409,
        ]


def test_retired_curriculum_blocks_publication_and_queries_validate(bank, context):
    client, _, _ = bank
    row, _ = add(client, context)
    version = publish_curriculum(client, context)
    assert (
        client.post(
            f"{CURRICULUM}/versions/{version['id']}/retire", headers={"If-Match": version["revision"]}
        ).status_code
        == 200
    )
    assert client.post(path(row) + "/publish", headers={"If-Match": row["revision"]}).status_code == 409
    for query in ["limit=101", "unknown=x", "method=unknown", "status=unknown", "offset=-1"]:
        assert client.get(BASE + "?" + query).status_code == 422
    assert client.get(f"{BASE}/{row['question_id']}/revisions?method=true_false").status_code == 422


def test_database_guards_relationship_and_locked_keys(bank, context):
    client, _, engine = bank
    row, body = add(client, context)
    other = hierarchy(client)
    with Session(engine) as db:
        for statement, values in [
            ("UPDATE question_revisions SET lesson_id=:value WHERE id=:id", {"value": other[5]["id"], "id": row["id"]}),
            (
                "UPDATE learning_competencies SET lesson_id=:value WHERE id=:id",
                {"value": other[5]["id"], "id": context[6]["id"]},
            ),
            (
                "INSERT INTO question_competencies(question_revision_id, competency_id) VALUES (:id,:value)",
                {"id": row["id"], "value": other[6]["id"]},
            ),
        ]:
            with pytest.raises(IntegrityError), db.begin():
                db.execute(text(statement), values)
    publish_curriculum(client, context)
    row = publish(client, row)
    with Session(engine) as db:
        for statement in [
            "UPDATE question_revisions SET prompt='Changed' WHERE id=:id",
            "DELETE FROM question_answer_keys WHERE question_revision_id=:id",
            "DELETE FROM question_competencies WHERE question_revision_id=:id",
        ]:
            with pytest.raises(IntegrityError), db.begin():
                db.execute(text(statement), {"id": row["id"]})


def test_referenced_version_remains_pinned_after_new_revision_and_retirement(bank, context):
    client, _, engine = bank
    row, body = add(client, context)
    publish_curriculum(client, context)
    row = publish(client, row)
    # Reuse established assignment storage; this is a fixture, not assessment delivery.
    mobile = client.post("/api/v1/users", json={"username": "Fixture_" + uuid4().hex[:12], "role": "instructor"}).json()
    headers = {"Authorization": "Bearer " + mobile["session"]["credential"], "Idempotency-Key": str(uuid4())}
    classroom = client.post(
        "/api/v1/classes",
        headers=headers,
        json={"class_name": "Synthetic fixture", "grade_level": 8, "language": "tagalog"},
    )
    assert classroom.status_code == 201, classroom.text
    with Session(engine) as db, db.begin():
        from app.models.users import User

        instructor = db.scalar(select(User).where(User.username == mobile["user"]["username"]))
        assignment = Assignment(class_id=UUID(classroom.json()["id"]), instructor_id=instructor.id)
        db.add(assignment)
        db.flush()
        edition = AssignmentVersion(
            assignment_id=assignment.id, lesson_id=UUID(context[5]["id"]), version=1, title="Synthetic fixture"
        )
        db.add(edition)
        db.flush()
        item = AssignmentQuestion(
            assignment_version_id=edition.id, question_revision_id=UUID(row["id"]), position=1, points=1
        )
        db.add(item)
        db.flush()
        pinned = item.id
    response = client.post(
        f"{BASE}/{row['question_id']}/revisions",
        headers={"If-Match": row["revision"]},
        json=body | {"prompt": "New fixture revision"},
    )
    assert response.status_code == 201
    assert (
        client.post(
            f"{BASE}/{row['question_id']}/retire", headers={"If-Match": response.json()["revision"]}
        ).status_code
        == 200
    )
    with Session(engine) as db:
        assert db.get(AssignmentQuestion, pinned).question_revision_id == UUID(row["id"])


@pytest.mark.parametrize("case,status", [("dashboard_only", 403), ("expired", 401), ("disabled", 401)])
def test_default_disabled_and_expired_admins_cannot_use_bank(bank, context, case, status):
    client, _, engine = bank
    row, body = add(client, context)
    name = "Fixture_" + uuid4().hex[:12]
    with Session(engine) as db:
        repo = AdminRepository(db)
        provision(repo, name, "https://id.example", name)
        if case != "dashboard_only":
            questions_permission(repo, name, grant=True, access="editor")
        token = issue_session(
            repo, "https://id.example", name, now=utcnow() - timedelta(hours=2) if case == "expired" else None
        )
        if case == "disabled":
            revoke(repo, name, disable=True)
    from app.modules.administration.security import derived

    headers = {"Cookie": "fluentt_admin=" + token, "X-CSRF-Token": derived(token, "csrf")}
    assert client.get(path(row), headers=headers).status_code == status
    assert client.get(path(row) + "/key", headers=headers).status_code == status
    assert client.post(BASE, headers=headers, json=body).status_code == status


def test_existing_empty_item_has_an_explicit_empty_history(bank):
    client, _, engine = bank
    from app.models.assessments import Question

    with Session(engine) as db, db.begin():
        item = Question()
        db.add(item)
        db.flush()
        id = item.id
    response = client.get(f"{BASE}/{id}")
    assert response.status_code == 200 and response.json()["latest_revision_id"] is None
    assert client.get(f"{BASE}/{id}/revisions").json()["items"] == []
    assert str(id) in {entry["id"] for entry in client.get(BASE).json()["items"]}


@pytest.mark.parametrize("method", ["identification", "fill_in_the_blank"])
def test_text_methods_limits_persistence_publication_and_legacy_history(bank, context, method):
    client, _, engine = bank
    legacy = {} if method == "identification" else {"blank_ids": ["a", "b"]}
    key = (
        {"accepted_answers": ["ñ", "fixture"], "case_sensitive": True}
        if method == "identification"
        else {"accepted_answers": {"a": ["ñ"], "b": ["fixture"]}}
    )
    row, body = add(client, context, (method, legacy, key))
    assert row["definition"]["content"] == legacy
    publish_curriculum(client, context)
    first = publish(client, row)
    content = legacy | {"input_max_length": 20}
    prompt = "Synthetic text fixture"
    if method == "fill_in_the_blank":
        content["template_syntax"] = "double-brace-v1"
        prompt = "Synthetic {{a}} then {{b}}."
        assert client.post(BASE, json=body | {"content": content, "prompt": "{{b}} {{a}}"}).status_code == 422
    corrected = body | {"content": content, "prompt": prompt}
    response = client.post(
        f"{BASE}/{first['question_id']}/revisions", headers={"If-Match": first["revision"]}, json=corrected
    )
    assert response.status_code == 201, response.text
    second = response.json()
    assert second["definition"]["content"] == content and "accepted_answers" not in str(second)
    assert client.get(path(second) + "/key").json()["definition"]["answer_key"].items() >= key.items()
    assert (
        client.put(
            path(second),
            headers={"If-Match": second["revision"]},
            json=corrected | {"content": content | {"input_max_length": 1}},
        ).status_code
        == 422
    )
    assert client.get(path(first)).json()["definition"]["content"] == legacy
    second = publish(client, second)
    assert client.put(path(second), headers={"If-Match": second["revision"]}, json=corrected).status_code == 409
    with Session(engine) as db:
        stored = db.get(QuestionRevision, UUID(second["id"]))
        assert stored.content == content and stored.prompt == prompt
        first_stored = db.get(QuestionRevision, UUID(first["id"]))
        assert first_stored.content == legacy


def test_flashcard_private_back_publication_history_and_revocation(bank, context):
    client, name, engine = bank
    key = {"back": "PRIVATE synthetic ñ😀 back", "scoring_rubric_version": "retained-fixture-reference"}
    row, body = add(client, context, ("flashcards", {"cue": "Synthetic ñ😀 cue"}, key))
    assert "PRIVATE" not in str(row) and "answer_key" not in str(row)
    assert client.get(path(row) + "/key").json()["definition"]["answer_key"] == key
    for invalid in [
        body | {"content": {"cue": " "}},
        body | {"answer_key": {"back": " "}},
        body | {"content": {"cue": "Fixture", "vocabulary_item_id": str(uuid4())}},
    ]:
        assert client.put(path(row), headers={"If-Match": row["revision"]}, json=invalid).status_code == 422
    assert client.get(path(row) + "/key").json()["definition"]["answer_key"] == key
    changed = body | {"content": {"cue": "Edited synthetic cue"}}
    response = client.put(path(row), headers={"If-Match": row["revision"]}, json=changed)
    assert response.status_code == 200
    fresh = response.json()
    assert fresh["id"] == row["id"]
    assert client.put(path(row), headers={"If-Match": row["revision"]}, json=body).status_code == 409
    publish_curriculum(client, context)
    first = publish(client, fresh)
    assert client.put(path(first), headers={"If-Match": first["revision"]}, json=body).status_code == 409
    corrected = body | {"answer_key": {"back": "Corrected PRIVATE fixture", "scoring_rubric_version": None}}
    response = client.post(
        f"{BASE}/{first['question_id']}/revisions", headers={"If-Match": first["revision"]}, json=corrected
    )
    assert response.status_code == 201
    assert client.get(path(first) + "/key").json()["definition"]["answer_key"] == key
    assert (
        client.get(path(response.json()) + "/key").json()["definition"]["answer_key"]["back"]
        == "Corrected PRIVATE fixture"
    )
    with Session(engine) as db:
        questions_permission(AdminRepository(db), name, grant=False, access="editor")
    assert client.get(path(first)).status_code == 200
    assert client.get(path(first) + "/key").status_code == 403
    assert client.post(BASE, json=body).status_code == 403
    with Session(engine) as db:
        revoke(AdminRepository(db), name)
    assert client.get(path(first)).status_code == 401


def test_matching_persistence_private_bijection_frozen_history_and_live_revocation(bank, context):
    client, name, engine = bank
    rows = [{"id": "a", "text": "Repeated synthetic ñ😀"}, {"id": "b", "text": "Repeated synthetic ñ😀"}]
    pairs = [{"left_id": "a", "right_id": "b"}, {"left_id": "b", "right_id": "a"}]
    row, body = add(client, context, ("matching_type", {"left": rows, "right": rows}, {"pairs": pairs}))
    assert "pairs" not in str(row) and "answer_key" not in str(row)
    assert client.get(path(row) + "/key").json()["definition"]["answer_key"] == {"pairs": pairs}
    for invalid in [
        pairs[:1],
        [pairs[0], pairs[0]],
        [pairs[0], {"left_id": "b", "right_id": "b"}],
        [pairs[0], {"left_id": "b", "right_id": "unknown"}],
    ]:
        assert (
            client.put(
                path(row), headers={"If-Match": row["revision"]}, json=body | {"answer_key": {"pairs": invalid}}
            ).status_code
            == 422
        )
    assert client.get(path(row) + "/key").json()["definition"]["answer_key"] == {"pairs": pairs}
    changed = body | {"content": {"left": rows, "right": list(reversed(rows))}}
    response = client.put(path(row), headers={"If-Match": row["revision"]}, json=changed)
    assert response.status_code == 200
    fresh = response.json()
    assert fresh["id"] == row["id"]
    assert client.put(path(row), headers={"If-Match": row["revision"]}, json=body).status_code == 409
    publish_curriculum(client, context)
    first = publish(client, fresh)
    assert client.put(path(first), headers={"If-Match": first["revision"]}, json=body).status_code == 409
    new_pairs = [{"left_id": "a", "right_id": "a"}, {"left_id": "b", "right_id": "b"}]
    response = client.post(
        f"{BASE}/{first['question_id']}/revisions",
        headers={"If-Match": first["revision"]},
        json=body | {"answer_key": {"pairs": new_pairs}},
    )
    assert response.status_code == 201
    assert client.get(path(first) + "/key").json()["definition"]["answer_key"] == {"pairs": pairs}
    assert client.get(path(response.json()) + "/key").json()["definition"]["answer_key"] == {"pairs": new_pairs}
    with Session(engine) as db:
        questions_permission(AdminRepository(db), name, grant=False, access="editor")
    assert client.get(path(first)).status_code == 200
    assert client.get(path(first) + "/key").status_code == 403
    assert client.post(BASE, json=body).status_code == 403
    with Session(engine) as db:
        revoke(AdminRepository(db), name)
    assert client.get(path(first)).status_code == 401


def test_orm_rejects_invalid_tagged_prompt_even_without_key(bank, context):
    _, _, engine = bank
    from app.models.assessments import Question

    with Session(engine) as db, db.begin():
        question = Question()
        db.add(question)
        db.flush()
        with pytest.raises(ValueError, match="placeholders"), db.begin_nested():
            db.add(
                QuestionRevision(
                    question_id=question.id,
                    lesson_id=UUID(context[5]["id"]),
                    version=1,
                    method="fill_in_the_blank",
                    language="tagalog",
                    prompt="Missing marker",
                    content={"blank_ids": ["a"], "template_syntax": "double-brace-v1"},
                )
            )
            db.flush()


@pytest.mark.parametrize("method", ["multiple_select", "error_identification"])
def test_set_methods_atomic_replacement_frozen_history_and_live_permissions(bank, context, method):
    client, name, engine = bank
    rows = [{"id": "a", "text": "Synthetic ñ😀"}, {"id": "b", "text": "Fixture B"}]
    field = "options" if method == "multiple_select" else "tokens"
    key_field = "correct_option_ids" if method == "multiple_select" else "error_token_ids"
    key = {key_field: ["a", "b"]}
    if method == "error_identification":
        key["accepted_corrections"] = {"b": [], "a": ["Private fixture"]}
    row, body = add(client, context, (method, {field: rows}, key))
    assert key_field not in str(row) and "Private fixture" not in str(row)
    assert client.get(path(row) + "/key").json()["definition"]["answer_key"] == key
    invalid = body | {"answer_key": key | {key_field: ["unknown"]}}
    assert client.put(path(row), headers={"If-Match": row["revision"]}, json=invalid).status_code == 422
    assert client.get(path(row) + "/key").json()["definition"]["answer_key"] == key
    new_key = {key_field: ["x"]}
    if method == "error_identification":
        new_key["accepted_corrections"] = {"x": ["New private fixture"]}
    replacement = body | {
        "content": {field: [{"id": "x", "text": "New fixture"}, {"id": "y", "text": "Other fixture"}]},
        "answer_key": new_key,
    }
    response = client.put(path(row), headers={"If-Match": row["revision"]}, json=replacement)
    assert response.status_code == 200, response.text
    updated = response.json()
    assert client.put(path(row), headers={"If-Match": row["revision"]}, json=body).status_code == 409
    publish_curriculum(client, context)
    first = publish(client, updated)
    assert client.put(path(first), headers={"If-Match": first["revision"]}, json=body).status_code == 409
    response = client.post(
        f"{BASE}/{first['question_id']}/revisions", headers={"If-Match": first["revision"]}, json=body
    )
    assert response.status_code == 201
    assert client.get(path(first) + "/key").json()["definition"]["answer_key"] == new_key
    assert client.get(path(response.json()) + "/key").json()["definition"]["answer_key"] == key
    with Session(engine) as db:
        questions_permission(AdminRepository(db), name, grant=False, access="editor")
    assert client.get(path(first)).status_code == 200
    assert client.get(path(first) + "/key").status_code == 403
    assert client.post(BASE, json=body).status_code == 403
    with Session(engine) as db:
        revoke(AdminRepository(db), name)
    assert client.get(path(first)).status_code == 401


@pytest.mark.parametrize("method", ["word_arrangement", "sentence_arrangement"])
def test_arrangement_order_is_private_and_frozen_revisions_keep_original_sequence(bank, context, method):
    client, name, engine = bank
    rows = [{"id": "a", "text": "Repeated synthetic ñ😀"}, {"id": "b", "text": "Repeated synthetic ñ😀"}]
    row, body = add(client, context, (method, {"items": rows}, {"ordered_ids": ["b", "a"]}))
    assert "ordered_ids" not in str(row) and row["definition"]["content"]["items"] == rows
    assert client.get(path(row) + "/key").json()["definition"]["answer_key"] == {"ordered_ids": ["b", "a"]}
    for invalid in [["a"], ["a", "a"], ["a", "unknown"]]:
        response = client.put(
            path(row), headers={"If-Match": row["revision"]}, json=body | {"answer_key": {"ordered_ids": invalid}}
        )
        assert response.status_code == 422
    assert client.get(path(row) + "/key").json()["definition"]["answer_key"] == {"ordered_ids": ["b", "a"]}
    changed = body | {"content": {"items": list(reversed(rows))}}
    response = client.put(path(row), headers={"If-Match": row["revision"]}, json=changed)
    assert response.status_code == 200
    fresh = response.json()
    assert fresh["id"] == row["id"]
    assert client.put(path(row), headers={"If-Match": row["revision"]}, json=body).status_code == 409
    publish_curriculum(client, context)
    first = publish(client, fresh)
    assert client.put(path(first), headers={"If-Match": first["revision"]}, json=body).status_code == 409
    response = client.post(
        f"{BASE}/{first['question_id']}/revisions",
        headers={"If-Match": first["revision"]},
        json=body | {"answer_key": {"ordered_ids": ["a", "b"]}},
    )
    assert response.status_code == 201
    assert client.get(path(first) + "/key").json()["definition"]["answer_key"] == {"ordered_ids": ["b", "a"]}
    assert client.get(path(response.json()) + "/key").json()["definition"]["answer_key"] == {"ordered_ids": ["a", "b"]}
    with Session(engine) as db:
        questions_permission(AdminRepository(db), name, grant=False, access="editor")
    assert client.get(path(first)).status_code == 200
    assert client.get(path(first) + "/key").status_code == 403
    assert client.post(BASE, json=body).status_code == 403
    with Session(engine) as db:
        revoke(AdminRepository(db), name)
    assert client.get(path(first)).status_code == 401
