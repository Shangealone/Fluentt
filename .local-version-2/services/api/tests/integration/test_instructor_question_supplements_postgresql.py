"""Private question publication uses live role/class scope and original retry identity."""
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import Settings
from app.main import create_app
from app.db.session import get_session
from app.models.assessments import QuestionRevision
from app.models.instructor_questions import InstructorLessonQuestion
from app.modules.curriculum.library_bundle import DEFAULT_BUNDLE, load_bundle, import_bundle, export_bundle
from app.modules.questions.practice import latest_questions


def test_private_question_publication_scope_retry_and_export_isolation(db):
    import_bundle(db.connection(), load_bundle(DEFAULT_BUNDLE))
    original = export_bundle(db.connection())
    lesson_id = str(db.scalar(select(QuestionRevision.lesson_id).where(QuestionRevision.language == "english")))
    app = create_app(Settings(_env_file=None, environment="test", database_url=None,
                              user_creation_limit=1000, mobile_session_request_limit=1000))
    connection = db.connection()
    def sessions():
        with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
            yield session
    app.app.dependency_overrides[get_session] = sessions
    with TestClient(app) as client:
        def teacher():
            result = client.post("/api/v1/users", json={"username": "Teacher_" + uuid4().hex[:10],
                "role": "instructor", "password": "SyntheticPass123!"})
            assert result.status_code == 201
            return {"Authorization": "Bearer " + result.json()["session"]["credential"]}
        def classroom(auth):
            response = client.post("/api/v1/classes", headers={**auth, "Idempotency-Key": str(uuid4())},
                                   json={"class_name": "Synthetic class", "language": "english", "proficiency_level": "beginner"})
            assert response.status_code == 201
            return response.json()
        owner, other = teacher(), teacher()
        own_class, same_owner_class, other_class = classroom(owner), classroom(owner), classroom(other)
        path = f"/api/v1/classes/{own_class['id']}/assignment-questions"
        key = str(uuid4())
        payload = {"lesson_id": lesson_id, "confirm": True, "question": {"method": "true_false",
            "prompt": "Synthetic private supplement", "content": {}, "answer_key": {"value": True}}}
        for invalid_confirmation in (False, 1):
            assert client.post(path, headers={**owner, "Idempotency-Key": str(uuid4())}, json={**payload, "confirm": invalid_confirmation}).status_code == 422
        response = client.post(path, headers={**owner, "Idempotency-Key": key}, json=payload)
        assert response.status_code == 201, response.text
        item = response.json()
        assert "answer_key" not in item["definition"] and item["eligible"]
        repeated = client.post(path, headers={**owner, "Idempotency-Key": key}, json=payload)
        assert repeated.status_code == 201 and repeated.json()["id"] == item["id"]
        changed = {**payload, "question": {**payload["question"], "prompt": "Changed"}}
        assert client.post(path, headers={**owner, "Idempotency-Key": key}, json=changed).status_code == 409
        assert client.post(path, headers={**other, "Idempotency-Key": str(uuid4())}, json=payload).status_code in {403, 404}
        preview = client.post("/api/v1/class-enrollment-registration-previews", json={"code": own_class["join_code"]})
        assert preview.status_code == 200
        student = client.post("/api/v1/users", json={"username": "Student_" + uuid4().hex[:10],
            "role": "school_student", "password": "SyntheticPass123!", "class_code": own_class["join_code"],
            "class_version": preview.json()["class_version"]})
        assert student.status_code == 201
        student_auth = {"Authorization": "Bearer " + student.json()["session"]["credential"]}
        assert client.post(path, headers={**student_auth, "Idempotency-Key": str(uuid4())}, json=payload).status_code == 403
        for auth, classroom_row, expected in [(owner, own_class, 1), (owner, same_owner_class, 0), (other, other_class, 0)]:
            rows = client.get(f"/api/v1/classes/{classroom_row['id']}/assignment-questions",
                headers=auth, params={"lesson_id": lesson_id, "q": "Synthetic private supplement"})
            assert rows.status_code == 200
            assert len(rows.json()["items"]) == expected
        assignment = {"title": "Synthetic assignment", "instructions": None,
                      "lesson_id": lesson_id, "question_revision_ids": [item["id"]]}
        assert client.post(f"/api/v1/classes/{own_class['id']}/assignments", headers={**owner, "Idempotency-Key": str(uuid4())}, json=assignment).status_code == 201
        assert client.post(f"/api/v1/classes/{other_class['id']}/assignments", headers={**other, "Idempotency-Key": str(uuid4())}, json=assignment).status_code in {409, 422}
        assert len(list(db.scalars(select(InstructorLessonQuestion)))) == 1
        assert item["id"] not in {str(row.id) for row in db.scalars(latest_questions("english"))}
        assert export_bundle(db.connection())["sha256"] == original["sha256"]
