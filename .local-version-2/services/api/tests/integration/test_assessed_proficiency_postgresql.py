"""External outcomes share only by student/language, with live membership and append-only history."""
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.main import create_app
from app.core.config import Settings
from app.db.session import get_session


def test_external_outcomes_scope_permissions_history_and_retry(db):
    connection = db.connection()
    app = create_app(Settings(_env_file=None, environment="test", database_url=None,
        user_creation_limit=1000, mobile_session_request_limit=1000, enrollment_peer_limit=1000, enrollment_session_limit=1000))
    def sessions():
        with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
            yield session
    app.app.dependency_overrides[get_session] = sessions
    with TestClient(app) as client:
        def teacher():
            response = client.post("/api/v1/users", json={"username": "Teacher_" + uuid4().hex[:10], "role": "instructor", "password": "SyntheticPass123!"})
            assert response.status_code == 201
            return {"Authorization": "Bearer " + response.json()["session"]["credential"]}
        def classroom(auth, language="english"):
            response = client.post("/api/v1/classes", headers={**auth, "Idempotency-Key": str(uuid4())}, json={"class_name": "Synthetic cohort", "proficiency_level": "beginner", "language": language})
            assert response.status_code == 201
            return response.json()
        first, second, outsider = teacher(), teacher(), teacher()
        english, other_english, tagalog, not_joined = classroom(first), classroom(second), classroom(second, "tagalog"), classroom(outsider)
        preview = client.post("/api/v1/class-enrollment-registration-previews", json={"code": english["join_code"]})
        student = client.post("/api/v1/users", json={"username": "Student_" + uuid4().hex[:10], "role": "school_student", "password": "SyntheticPass123!", "class_code": english["join_code"], "class_version": preview.json()["class_version"]})
        assert student.status_code == 201
        student_id = student.json()["user"]["id"]
        student_auth = {"Authorization": "Bearer " + student.json()["session"]["credential"]}
        for cohort in (other_english, tagalog):
            preview = client.post("/api/v1/class-enrollment-previews", headers=student_auth, json={"code": cohort["join_code"]})
            assert preview.status_code == 200
            joined = client.post("/api/v1/class-memberships", headers=student_auth, json={"code": cohort["join_code"], "class_version": preview.json()["class_version"]})
            assert joined.status_code == 200
        path = lambda cohort: f"/api/v1/classes/{cohort['id']}/students/{student_id}/assessed-proficiency"
        assert client.get(path(english), headers=first).json()["current"] is None
        key = str(uuid4())
        body = {"level": "beginner", "assessed_on": "2026-01-10", "expected_event_id": None}
        saved = client.post(path(english), headers={**first, "Idempotency-Key": key}, json=body)
        assert saved.status_code == 200, saved.text
        event_id = saved.json()["current"]["id"]
        assert client.get(path(other_english), headers=second).json()["current"]["id"] == event_id
        assert client.get(path(tagalog), headers=second).json()["current"] is None
        mine = client.get("/api/v1/me/assessed-proficiency", headers=student_auth)
        assert mine.status_code == 200 and mine.json()["current"]["id"] == event_id
        assert "source_class_id" not in mine.text
        assert client.post(path(english), headers={**student_auth, "Idempotency-Key": str(uuid4())}, json=body).status_code == 403
        assert client.get(path(english), headers=outsider).status_code == 404
        assert client.get(path(not_joined), headers=outsider).status_code == 404
        assert client.post(path(other_english), headers={**second, "Idempotency-Key": str(uuid4())}, json={**body, "level": "advanced"}).status_code == 409
        revised = client.post(path(other_english), headers={**second, "Idempotency-Key": str(uuid4())}, json={"level": "intermediate", "assessed_on": "2026-02-15", "expected_event_id": event_id})
        assert revised.status_code == 200 and len(revised.json()["history"]) == 2
        replay = client.post(path(english), headers={**first, "Idempotency-Key": key}, json=body)
        assert replay.status_code == 200
        assert replay.json()["current"]["level"] == "intermediate" and len(replay.json()["history"]) == 2
        current = revised.json()["current"]["id"]
        reset = client.post(path(english), headers={**first, "Idempotency-Key": str(uuid4())}, json={"level": None, "assessed_on": None, "expected_event_id": current})
        assert reset.status_code == 200 and reset.json()["current"]["level"] is None
        assert len(reset.json()["history"]) == 3
        for invalid in ({"level": "advanced", "assessed_on": "9999-01-01"}, {"level": "advanced", "assessed_on": None}, {"level": None, "assessed_on": "2026-01-01"}):
            assert client.post(path(english), headers={**first, "Idempotency-Key": str(uuid4())}, json={**invalid, "expected_event_id": reset.json()["current"]["id"]}).status_code == 422
        assert client.get(f"/api/v1/classes/{english['id']}", headers=first).json()["proficiency_level"] == "beginner"
        with pytest.raises(IntegrityError):
            with connection.begin_nested():
                connection.execute(text("UPDATE student_proficiency_events SET level='advanced' WHERE id=:id"), {"id": event_id})
