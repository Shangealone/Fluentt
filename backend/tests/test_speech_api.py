import os
import struct
from concurrent.futures import ThreadPoolExecutor
from threading import BoundedSemaphore, Event
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://unused:unused@localhost/unused_test"
)
os.environ.setdefault("JWT_SECRET", "speech-contract-test-only")

from app.auth.dependencies import get_current_user
from app.content.models import ContentRelease, VocabularyRevision
from app.core.config import Settings, get_settings
from app.database.session import get_db
from app.main import app
from app.speech.router import get_workers
from app.speech.worker_client import WorkerUnavailable


class Database:
    def __init__(self):
        self.item, self.revision, self.release, self.lesson = [
            uuid4() for _ in range(4)
        ]
        self.rollback_count = 0

    def get(self, model, identity):
        if model is VocabularyRevision and identity == self.revision:
            return SimpleNamespace(
                id=self.revision,
                vocabulary_item_id=self.item,
                lesson_id=self.lesson,
                term="hello world",
                is_active=True,
            )
        if model is ContentRelease and identity == self.release:
            return SimpleNamespace(
                language_code="en",
                manifest={
                    "language": {"code": "en", "is_active": True},
                    "lessons": [
                        {
                            "id": str(self.lesson),
                            "is_active": True,
                            "vocabulary_items": [
                                {
                                    "id": str(self.item),
                                    "content_revision_id": str(self.revision),
                                }
                            ],
                        }
                    ],
                },
            )
        return None

    def rollback(self):
        self.rollback_count += 1


class Worker:
    def capability(self):
        return {
            "ready": True,
            "language_code": "en",
            "model_id": "candidate",
            "model_revision": "abc",
            "validation_status": "unvalidated_model_prediction",
        }

    def infer(self, recording, language, reference=""):
        return {
            "transcript": "hello world",
            "decoder_version": "test",
            "model_id": "candidate",
            "model_revision": "abc",
            "validation_status": "unvalidated_model_prediction",
        }


@pytest.fixture
def context():
    user = SimpleNamespace(id=uuid4())
    db = Database()
    settings = Settings(
        database_url="postgresql+psycopg://unused:unused@localhost/unused_test",
        jwt_secret="speech-test",
        speech_internal_qa_user_ids=[user.id],
    )
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_workers] = lambda: {
        "recognition": Worker(),
        "assessment": Worker(),
    }
    headers = {
        "Content-Type": "application/octet-stream",
        "X-Speech-Request-Id": str(uuid4()),
        "X-Speech-Session-Id": str(uuid4()),
        "X-Speech-Sequence": "0",
        "X-Speech-Final": "true",
        "X-Audio-Sample-Rate": "16000",
        "X-Audio-Channels": "1",
        "X-Content-Item-Id": str(db.item),
        "X-Content-Revision-Id": str(db.revision),
        "X-Content-Release-Id": str(db.release),
        "X-Recognition-Consent": "speech-recognition-v1",
    }
    yield TestClient(app), headers, db, settings
    app.dependency_overrides.clear()


def test_speech_requires_existing_authentication(context):
    client, _, _, _ = context
    del app.dependency_overrides[get_current_user]
    assert client.get("/speech/capabilities?language_code=en").status_code == 401


def test_normal_learner_is_disabled_and_cannot_self_select_qa(context):
    client, headers, _, settings = context
    settings.speech_internal_qa_user_ids = []
    result = client.get(
        "/speech/capabilities?language_code=en", headers={"X-Internal-QA": "true"}
    )
    assert result.json()["recognition"]["mode"] == "unavailable"
    assert (
        client.post("/speech/recognitions", headers=headers, content=b"00").status_code
        == 503
    )


def test_tagalog_stays_unavailable_even_for_qa(context):
    client, _, _, _ = context
    assert (
        client.get("/speech/capabilities?language_code=fil").json()["recognition"][
            "reason"
        ]
        == "unsupported_language"
    )


def test_actual_transcript_matches_exact_target_and_rolls_back_read_transaction(
    context,
):
    client, headers, db, _ = context
    response = client.post(
        "/speech/recognitions", headers=headers, content=struct.pack("<h", 800) * 16000
    )
    assert response.status_code == 200, response.text
    assert [word["state"] for word in response.json()["words"]] == ["match", "match"]
    assert "overall_score" not in response.json()
    assert response.headers["cache-control"] == "no-store"
    assert db.rollback_count > 0


def test_stale_release_and_missing_consent_are_rejected(context):
    client, headers, _, _ = context
    assert (
        client.post(
            "/speech/recognitions",
            headers={**headers, "X-Content-Release-Id": str(uuid4())},
            content=b"00",
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/speech/recognitions",
            headers={**headers, "X-Recognition-Consent": ""},
            content=b"00",
        ).status_code
        == 403
    )


def test_failed_worker_never_produces_a_score(context):
    client, headers, _, _ = context
    response = client.post(
        "/speech/assessments",
        headers={**headers, "X-Assessment-Consent": "speech-assessment-v1"},
        content=struct.pack("<h", 800) * 16000,
    )
    assert response.status_code == 503
    assert "overall_score" not in response.json()
    assert response.headers.get("cache-control") == "no-store"


def test_assessment_preserves_real_prediction_and_exact_reference(context):
    client, headers, db, _ = context

    class AssessmentWorker(Worker):
        def infer(self, recording, language, reference=""):
            assert reference == "hello world"
            assert language == "en"
            return {
                **self.capability_identity(),
                "overall_score": 82.5,
                "n_errors": 0,
                "words": [
                    {
                        "word": word,
                        "score": 82.5,
                        "phonemes": [
                            {
                                "phone": "hh",
                                "score": 82.5,
                                "pherr_prob": 0.1,
                                "error": False,
                            },
                        ],
                    }
                    for word in ["hello", "world"]
                ],
            }

        def capability_identity(self):
            return {
                k: v
                for k, v in self.capability().items()
                if k in ("model_id", "model_revision", "validation_status")
            }

    app.dependency_overrides[get_workers] = lambda: {
        "recognition": Worker(),
        "assessment": AssessmentWorker(),
    }
    response = client.post(
        "/speech/assessments",
        headers={**headers, "X-Assessment-Consent": "speech-assessment-v1"},
        content=struct.pack("<h", 800) * 16000,
    )
    assert response.status_code == 200, response.text
    assert response.json()["overall_score"] == 82.5
    assert response.json()["validation_status"] == "unvalidated_model_prediction"
    assert response.json()["duration_ms"] == 1000
    assert db.rollback_count == 1


def test_oversized_pcm_is_rejected_before_inference(context):
    client, headers, _, _ = context
    response = client.post(
        "/speech/recognitions", headers=headers, content=b"00" * 500001
    )
    assert response.status_code == 413


def test_busy_api_rejects_before_reading_another_recording(context):
    client, headers, _, settings = context
    settings.speech_max_inflight = 1
    gate = BoundedSemaphore(1)
    entered, release = Event(), Event()
    read = []

    class BusyWorker(Worker):
        def infer(self, *args):
            if not gate.acquire(blocking=False):
                raise WorkerUnavailable("busy")
            try:
                entered.set()
                assert release.wait(10)
                return super().infer(*args)
            finally:
                gate.release()

    worker = BusyWorker()
    app.dependency_overrides[get_workers] = lambda: {
        "recognition": worker,
        "assessment": worker,
    }

    def chunks():
        read.append(True)
        yield b"00" * 16000

    with ThreadPoolExecutor(max_workers=1) as executor:
        first = executor.submit(
            client.post, "/speech/recognitions", headers=headers, content=b"00" * 16000
        )
        try:
            assert entered.wait(5)
            second = client.post(
                "/speech/recognitions",
                headers={**headers, "X-Speech-Request-Id": str(uuid4())},
                content=chunks(),
            )
            assert second.status_code == 503
            assert not read
        finally:
            release.set()
        assert first.result().status_code == 200
