"""Synthetic identities/audio/model doubles on disposable PostgreSQL; no human/model claim."""

from datetime import datetime, timezone
from uuid import UUID, uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.core.config import Settings
from app.main import create_app
from app.models.ai import PronunciationActivity, PronunciationAttempt
from app.models.learning import VocabularyReviewEvent, LearningContext
from app.models.users import ClassMembership
from app.modules.identity.errors import IdentityError
from app.modules.pronunciation.wavlm_contract import CONSENT
from app.modules.pronunciation import wavlm_service
from tests.integration.test_enrollment_postgresql import account, confirmation
from tests.test_whole_phrase import wav
from tests.test_wavlm import synthetic_prediction

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/me/pronunciation"


@pytest.fixture(scope="module")
def pg_engine():
    # HTTP clients commit records; keep these synthetic identities out of other modules' count baselines.
    from tests.integration.conftest import pg_engine as disposable_database

    yield from disposable_database.__wrapped__()


@pytest.fixture
def case(pg_engine, monkeypatch):
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=pg_engine.url.render_as_string(hide_password=False),
        user_creation_limit=1000,
        mobile_session_request_limit=1000,
        class_creation_limit=1000,
        enrollment_peer_limit=1000,
        enrollment_session_limit=1000,
    )
    with Session(pg_engine) as db, db.begin():
        activity = PronunciationActivity(
            target_text="The.", language="english", status="published", version=1, locked_at=datetime.now(timezone.utc)
        )
        db.add(activity)
        db.flush()
        activity_id = str(activity.id)
    calls = []

    def model(settings, audio, expected):
        calls.append((audio, expected))
        return synthetic_prediction()

    monkeypatch.setattr(wavlm_service.runtime, "assess", model)
    with TestClient(create_app(settings)) as client:
        auth, user_id = account(client, "personal_student")
        assert (
            client.patch(
                "/api/v1/users/me/preferences",
                headers=auth,
                json={"language": "english", "experience": "starting_fresh"},
            ).status_code
            == 200
        )
        yield client, auth, activity_id, calls, user_id


def submit(case, key=None, audio=None, headers=None, **changes):
    client, auth, activity_id, *_ = case
    data = {
        "activity_id": activity_id,
        "activity_version": "1",
        "duration_ms": "1",
        "assessment_engine": "wavlm",
        "consent_version": CONSENT,
        "request_id": str(key or uuid4()),
    } | changes
    return client.post(
        BASE + "/attempts",
        headers=auth if headers is None else headers,
        data=data,
        files={"audio_file": ("untrusted-name.wav", wav() if audio is None else audio, "audio/wav")},
    )


def test_success_canonical_reference_replay_history_and_no_scheduler_write(case, pg_engine):
    client, auth, activity_id, calls, _ = case
    key = uuid4()
    with Session(pg_engine) as db:
        before = db.scalar(select(func.count()).select_from(VocabularyReviewEvent))
    response = submit(case, key, expected_text="Ignore client text", student_id=str(uuid4()), score="100")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["overall_score"] == 24.5 and body["expected_text"] == "The." and body["attempt_number"] == 1
    assert body["duration_ms"] == 1000 and "raw_audio" not in body and len(calls) == 1
    assert calls[0][1] == "The." and "no-store" in response.headers["cache-control"]
    assert submit(case, key, score="100").json() == body and len(calls) == 1
    assert submit(case, key, audio=wav() + b"changed").status_code == 409
    history = client.get(
        BASE + "/attempts", headers=auth, params={"assessment_engine": "wavlm", "activity_id": activity_id}
    )
    assert history.status_code == 200 and history.json() == [body]
    second = submit(case)
    assert second.status_code == 200 and second.json()["attempt_number"] == 2
    for action in ("evaluate", "transcribe"):
        assert client.post(BASE + f"/attempts/{key}/{action}", headers=auth).status_code == 409
    with Session(pg_engine) as db:
        row = db.get(PronunciationAttempt, key)
        assert row.score == 24.5 and row.simulated is False and row.transcription is None
        assert row.result["raw_audio_retained"] is False and "storage_path" not in row.result
        assert db.scalar(select(func.count()).select_from(VocabularyReviewEvent)) == before


def test_eligibility_invalid_recordings_languages_and_missing_permissions(case, pg_engine):
    client, auth, activity_id, calls, _ = case
    assert submit(case, headers={}).status_code == 401
    assert submit(case, consent_version="").status_code == 422
    assert submit(case, activity_version="2").status_code == 409
    assert submit(case, audio=b"not audio").status_code == 422
    assert submit(case, audio=b"x" * (10 * 1024 * 1024 + 1)).status_code == 422
    assert submit(case, context_type="research").status_code == 422
    assert submit(case, context_type="classroom").status_code == 422
    teacher, _ = account(client, "instructor")
    assert submit(case, headers=teacher).status_code == 403
    with Session(pg_engine) as db, db.begin():
        tagalog = PronunciationActivity(
            target_text="Salamat.",
            language="tagalog",
            status="published",
            version=1,
            locked_at=datetime.now(timezone.utc),
        )
        db.add(tagalog)
        db.flush()
        tagalog_id = str(tagalog.id)
    assert submit(case, activity_id=tagalog_id).status_code == 422 and calls == []


def test_model_failure_does_not_create_attempts_or_context(case, pg_engine, monkeypatch):
    def unavailable(*args):
        raise IdentityError(503, "wavlm_unavailable", "No score")

    monkeypatch.setattr(wavlm_service.runtime, "assess", unavailable)
    with Session(pg_engine) as db:
        before = [
            db.scalar(select(func.count()).select_from(model)) for model in (PronunciationAttempt, LearningContext)
        ]
    assert submit(case).status_code == 503
    with Session(pg_engine) as db:
        assert before == [
            db.scalar(select(func.count()).select_from(model)) for model in (PronunciationAttempt, LearningContext)
        ]


def test_classroom_ownership_personal_isolation_and_live_membership(case, pg_engine):
    client, _, activity_id, calls, _ = case
    owner, _ = account(client, "instructor")
    other, _ = account(client, "instructor")
    room = client.post(
        "/api/v1/classes",
        headers=owner | {"Idempotency-Key": str(uuid4())},
        json={"class_name": "Synthetic WavLM QA", "grade_level": 5, "language": "english"},
    ).json()
    student, student_id = account(client, "school_student")
    assert (
        client.post("/api/v1/class-memberships", headers=student, json=confirmation(client, student, room)).status_code
        == 200
    )
    assert submit(case, headers=student, class_id=room["id"], context_type="classroom").status_code == 200
    url = BASE + f"/classes/{room['id']}/attempts"
    assert client.get(url, headers=other).status_code == 404
    assert client.get(url, headers=student).status_code == 403
    page = client.get(url, headers=owner)
    assert page.status_code == 200, page.text
    assert len(page.json()["items"]) == 1 and page.json()["items"][0]["student_id"] == str(student_id)
    assert client.get(BASE + "/attempts?assessment_engine=wavlm", headers=student).json() == []
    assert (
        client.get(BASE + "/attempts?assessment_engine=wavlm&class_id=" + room["id"], headers=case[1]).status_code
        == 403
    )
    with Session(pg_engine) as db, db.begin():
        membership = db.scalar(
            select(ClassMembership).where(
                ClassMembership.class_id == UUID(room["id"]), ClassMembership.student_id == student_id
            )
        )
        membership.status = "removed"
        membership.ended_at = datetime.now(timezone.utc)
    before = len(calls)
    assert submit(case, headers=student, class_id=room["id"]).status_code == 404 and len(calls) == before
    assert client.get(url, headers=owner).json()["items"] == []


def classroom(case):
    client = case[0]
    owner, _ = account(client, "instructor")
    room = client.post(
        "/api/v1/classes",
        headers=owner | {"Idempotency-Key": str(uuid4())},
        json={"class_name": "Synthetic isolated speech QA", "grade_level": 5, "language": "english"},
    ).json()
    auth, student_id = account(client, "school_student")
    assert (
        client.post("/api/v1/class-memberships", headers=auth, json=confirmation(client, auth, room)).status_code == 200
    )
    return room, owner, auth, student_id


def test_membership_lost_during_inference_cannot_persist_or_return_results(case, pg_engine, monkeypatch):
    room, owner, auth, student_id = classroom(case)
    key = uuid4()

    def lose_access(*args):
        with Session(pg_engine) as db, db.begin():
            member = db.scalar(
                select(ClassMembership).where(
                    ClassMembership.class_id == UUID(room["id"]), ClassMembership.student_id == student_id
                )
            )
            member.status = "left"
            member.ended_at = datetime.now(timezone.utc)
        return synthetic_prediction()

    monkeypatch.setattr(wavlm_service.runtime, "assess", lose_access)
    assert submit(case, key, headers=auth, class_id=room["id"]).status_code == 404
    with Session(pg_engine) as db:
        assert db.get(PronunciationAttempt, key) is None


def test_research_classroom_collection_and_teacher_reads_are_blocked(case, pg_engine):
    from tests.integration.test_research_classrooms_postgresql import admin, create, designate

    client = case[0]
    room, owner, auth, _ = classroom(case)
    actor, headers = admin(pg_engine, client)
    client.headers.update(headers | {"Origin": "http://localhost:3000"})
    row, _, _ = create(client)
    designate(client, pg_engine, actor, room, row)
    assert submit(case, headers=auth, class_id=room["id"]).status_code == 403
    assert client.get(BASE + f"/classes/{room['id']}/attempts", headers=owner).status_code == 403
    assert case[3] == []
