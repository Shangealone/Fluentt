"""Real auth/DB, synthetic audio + mocked outbound service, UUID disposable DB only."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.main import create_app
from app.models.ai import PronunciationActivity, PronunciationAttempt
from app.models.learning import LearningContext, VocabularyReviewEvent
from app.modules.pronunciation import whole_phrase
from tests.integration.test_enrollment_postgresql import account
from tests.test_whole_phrase import configured, wav

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/me/pronunciation/whole-phrase"


@pytest.fixture
def whole(pg_engine, monkeypatch):
    settings = configured(
        database_url=pg_engine.url.render_as_string(hide_password=False),
        environment="test",
        user_creation_limit=1000,
        mobile_session_request_limit=1000,
    )
    with Session(pg_engine) as db, db.begin():
        activity = PronunciationActivity(
            target_text="Synthetic whole sentence.",
            language="english",
            status="published",
            version=1,
            locked_at=datetime.now(timezone.utc),
        )
        db.add(activity)
        db.flush()
        activity_id = str(activity.id)
    calls = []

    def provider(settings, audio, reference):
        calls.append((audio, reference))
        return {"overall_score": 37.5, "accuracy_score": 91, "fluency_score": 82, "completeness_score": 75}

    monkeypatch.setattr(whole_phrase, "assess_with_azure", provider)
    with TestClient(create_app(settings)) as client:
        auth, _ = account(client, "personal_student")
        updated = client.patch(
            "/api/v1/users/me/preferences", headers=auth, json={"language": "english", "experience": "starting_fresh"}
        )
        assert updated.status_code == 200, updated.text
        yield client, auth, activity_id, calls


def submit(client, auth, activity_id, **changes):
    body = {
        "activity_id": activity_id,
        "activity_version": "1",
        "cloud_consent_version": whole_phrase.CONSENT_VERSION,
        **changes,
    }
    return client.post(
        BASE + "/assess", headers=auth, data=body, files={"audio_file": ("synthetic.wav", wav(), "audio/wav")}
    )


def test_real_auth_whole_clip_permission_version_and_no_progress_writer(whole, pg_engine):
    client, auth, activity_id, calls = whole
    assert client.get(BASE + "/capabilities?language=english").status_code == 401
    capability = client.get(BASE + "/capabilities?language=english", headers=auth)
    assert capability.status_code == 200 and capability.json()["available"] is True
    assert "SYNTHETIC-NOT-A-REAL-KEY" not in capability.text
    assert client.get(BASE + "/capabilities?language=tagalog", headers=auth).json()["available"] is False
    assert submit(client, auth, activity_id, cloud_consent_version="").status_code == 403
    assert submit(client, auth, activity_id, activity_version="2").status_code == 409
    assert submit(client, auth, str(uuid4())).status_code == 404
    assert calls == []
    tables = [PronunciationAttempt, LearningContext, VocabularyReviewEvent]
    with Session(pg_engine) as db:
        before = [db.scalar(select(func.count()).select_from(table)) for table in tables]
    response = submit(client, auth, activity_id, score="100", transcript="Synthetic whole sentence")
    assert response.status_code == 200, response.text
    assert response.json()["overall_score"] == 37.5 and response.json()["simulated"] is False
    assert "no-store" in response.headers["cache-control"] and len(calls) == 1
    assert calls[0] == (wav(), "Synthetic whole sentence.")
    with Session(pg_engine) as db:
        assert before == [db.scalar(select(func.count()).select_from(table)) for table in tables]


def test_other_roles_and_default_configuration_cannot_send_audio(whole):
    client, auth, activity_id, calls = whole
    for role in ("instructor", "school_student"):
        other, _ = account(client, role)
        assert client.get(BASE + "/capabilities?language=english", headers=other).status_code == 403
        assert submit(client, other, activity_id).status_code == 403
    assert calls == []
    # Independent test app uses defaults, not a fake live deployment toggle or real external call.
    settings = client.app.app.state.settings
    settings.pronunciation_azure_enabled = False
    assert client.get(BASE + "/capabilities?language=english", headers=auth).json()["available"] is False
    assert submit(client, auth, activity_id).status_code == 503
    assert calls == []
