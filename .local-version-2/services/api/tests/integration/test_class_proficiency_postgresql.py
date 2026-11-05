"""Fresh-bootstrap and no-grade sharing contracts in the disposable UUID database."""

from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.main import create_app
from app.db.session import get_session
from app.models.curriculum import Subject
from app.models.users import Classroom
from app.models.teacher_lessons import TeacherLessonShare

pytestmark = pytest.mark.postgresql


@pytest.fixture
def proficiency_database(pg_engine):
    connection = pg_engine.connect()
    transaction = connection.begin()
    try:
        yield connection
    finally:
        transaction.rollback()
        connection.close()


def test_fresh_head_supports_no_grade_class_edit_and_published_lesson_share(proficiency_database):
    def session():
        return Session(bind=proficiency_database, join_transaction_mode="create_savepoint")

    with session() as db, db.begin():
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == "0028_teacher_supplements"
        actual_unique = {row["name"] for row in inspect(proficiency_database).get_unique_constraints("teacher_lesson_shares")}
        mapped_unique = {row.name for row in TeacherLessonShare.__table__.constraints
                         if row.__class__.__name__ == "UniqueConstraint"}
        assert mapped_unique == actual_unique
        subject = Subject(code="synthetic-" + uuid4().hex, name="Synthetic subject")
        db.add(subject)
        db.flush()
        subject_id = str(subject.id)

    settings = Settings(
        _env_file=None, environment="test",
        database_url=None,
        user_creation_limit=1000, mobile_session_request_limit=1000,
    )
    app = create_app(settings)
    def request_session():
        with session() as db:
            yield db
    app.app.dependency_overrides[get_session] = request_session
    with TestClient(app) as client:
        registered = client.post("/api/v1/users", json={
            "username": "Proficiency_" + uuid4().hex[:12], "role": "instructor",
            "password": "SyntheticPass123!",
        })
        assert registered.status_code == 201
        auth = {"Authorization": "Bearer " + registered.json()["session"]["credential"]}
        created = client.post("/api/v1/classes", headers={**auth, "Idempotency-Key": str(uuid4())},
                              json={"class_name": "Synthetic no-grade class", "language": "english",
                                    "proficiency_level": "beginner"})
        assert created.status_code == 201
        classroom = created.json()
        assert classroom["grade_level"] is None and classroom["proficiency_level"] == "beginner"
        class_path = "/api/v1/classes/" + classroom["id"]
        edited = client.patch(class_path, headers=auth, json={"proficiency_level": "advanced"})
        assert edited.status_code == 200 and edited.json()["proficiency_level"] == "advanced"

        draft = client.post("/api/v1/instructor/lessons", headers={**auth, "Idempotency-Key": str(uuid4())},
                            json={"title": "Synthetic reading", "proficiency_level": "beginner", "language": "english",
                                  "subject_id": subject_id,
                                  "sections": [{"heading": "Read", "body": "Synthetic reading content."}]})
        assert draft.status_code == 201
        lesson = draft.json()
        assert lesson["grade"] is None and lesson["proficiency_level"] == "beginner"
        action_path = "/api/v1/instructor/lessons/" + lesson["id"] + "/actions"

        def action(name, **extra):
            response = client.post(action_path, headers={
                **auth, "Idempotency-Key": str(uuid4()), "If-Match": lesson["revision"],
            }, json={"action": name, "version_id": lesson["version_id"], "confirm": True, **extra})
            assert response.status_code == 200
            lesson.update(response.json())

        action("publish")
        action("share", class_ids=[classroom["id"]], bind_subject=True)
        assert lesson["shares"] == [{"class_id": classroom["id"], "class_name": classroom["class_name"],
                                     "version_id": lesson["version_id"]}]
        preview = client.post("/api/v1/class-enrollment-registration-previews",
                              json={"code": classroom["join_code"]})
        assert preview.status_code == 200
        assert preview.json()["grade_level"] is None
        signup = client.post("/api/v1/users", json={
            "username": "Student_" + uuid4().hex[:12], "role": "school_student",
            "password": "SyntheticPass123!", "class_code": classroom["join_code"],
            "class_version": preview.json()["class_version"],
        })
        assert signup.status_code == 201
        assert signup.json()["user"]["profile_status"] == "active"
        student_auth = {"Authorization": "Bearer " + signup.json()["session"]["credential"]}
        memberships = client.get("/api/v1/class-memberships/mine", headers=student_auth)
        assert memberships.status_code == 200
        assert memberships.json()[0]["class_id"] == classroom["id"]
        assert memberships.json()[0]["grade_level"] is None
        shared = client.get("/api/v1/classes/" + classroom["id"] + "/teacher-lessons", headers=student_auth)
        assert shared.status_code == 200
        assert shared.json()["items"][0]["context"]["grade"] is None
        assert shared.json()["items"][0]["context"]["proficiency_level"] == "beginner"
        corrected = client.patch(class_path, headers=auth, json={"proficiency_level": "intermediate"})
        assert corrected.status_code == 200
        assert corrected.json()["grade_level"] is None
        blocked = client.patch(class_path, headers=auth, json={"language": "tagalog"})
        assert blocked.status_code == 409

    with session() as db:
        stored = db.scalar(select(Classroom).where(Classroom.id == UUID(classroom["id"])))
        assert stored.grade_level_id is None and stored.proficiency_level == "intermediate"
        assert str(stored.subject_id) == subject_id and stored.language == "english"
