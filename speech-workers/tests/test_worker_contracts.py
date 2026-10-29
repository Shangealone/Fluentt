import hashlib
import json
import struct
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "backend"), str(ROOT / "speech-workers")]

from common import ArtifactManifest, ArtifactRuntime, create_worker_app


class RecognitionRuntime:
    def capability(self):
        return {
            "ready": True,
            "language_code": "en",
            "model_id": "candidate",
            "model_revision": "abc",
            "validation_status": "unvalidated_model_prediction",
        }

    def infer(self, recording, reference):
        return {
            "transcript": "hello",
            "decoder_version": "test-v1",
            "model_id": "candidate",
            "model_revision": "abc",
            "validation_status": "unvalidated_model_prediction",
        }


def test_worker_is_private_and_requires_service_auth():
    client = TestClient(
        create_worker_app("recognition", RecognitionRuntime(), "secret")
    )
    assert client.get("/health/capabilities").status_code == 401
    response = client.get(
        "/health/capabilities", headers={"Authorization": "Bearer secret"}
    )
    assert response.json()["validation_status"] == "unvalidated_model_prediction"


def test_worker_validates_raw_pcm_and_returns_only_recognition():
    client = TestClient(
        create_worker_app("recognition", RecognitionRuntime(), "secret")
    )
    headers = {
        "Authorization": "Bearer secret",
        "Content-Type": "application/octet-stream",
        "X-Audio-Sample-Rate": "16000",
        "X-Audio-Channels": "1",
        "X-Language": "en",
    }
    assert (
        client.post("/v1/recognize", headers=headers, content=b"bad").status_code == 422
    )
    response = client.post(
        "/v1/recognize", headers=headers, content=struct.pack("<h", 400) * 16000
    )
    assert response.status_code == 200
    assert response.json()["transcript"] == "hello"
    assert "score" not in response.json()
    assert (
        client.post(
            "/v1/recognize", headers={**headers, "X-Language": "fil"}, content=b"00"
        ).status_code
        == 422
    )


def test_artifacts_require_complete_pinned_manifest(tmp_path):
    with pytest.raises(ValueError):
        ArtifactManifest.load(tmp_path)
    (tmp_path / "weights.bin").write_bytes(b"weights")
    manifest = {
        "model_id": "candidate",
        "model_revision": "abc",
        "files": {
            "weights.bin": hashlib.sha256(b"weights").hexdigest(),
        },
    }
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    assert ArtifactManifest.load(tmp_path).model_id == "candidate"
    (tmp_path / "weights.bin").write_bytes(b"changed")
    with pytest.raises(ValueError):
        ArtifactManifest.load(tmp_path)


def test_manifest_cannot_escape_artifact_directory(tmp_path):
    (tmp_path / "manifest.json").write_text(
        json.dumps(
            {
                "model_id": "candidate",
                "model_revision": "abc",
                "files": {"../elsewhere": "0" * 64},
            }
        )
    )
    with pytest.raises(ValueError):
        ArtifactManifest.load(tmp_path)


def test_readiness_rejects_a_manifest_without_model_resources(tmp_path, monkeypatch):
    (tmp_path / "weights.bin").write_bytes(b"weights")
    (tmp_path / "manifest.json").write_text(
        json.dumps(
            {
                "model_id": "candidate",
                "model_revision": "abc",
                "files": {
                    "weights.bin": hashlib.sha256(b"weights").hexdigest(),
                },
            }
        )
    )
    monkeypatch.setenv("SPEECH_MODEL_DIR", str(tmp_path))
    with pytest.raises(ValueError):
        ArtifactRuntime("recognition").capability()


def test_malformed_worker_result_returns_unavailable_without_echoing_input():
    runtime = RecognitionRuntime()
    runtime.infer = lambda *_: {"transcript": "private", "score": float("nan")}
    client = TestClient(create_worker_app("recognition", runtime, "secret"))
    response = client.post(
        "/v1/recognize",
        content=b"00" * 1600,
        headers={
            "Authorization": "Bearer secret",
            "Content-Type": "application/octet-stream",
            "X-Audio-Sample-Rate": "16000",
            "X-Audio-Channels": "1",
            "X-Language": "en",
        },
    )
    assert response.status_code == 503
    assert "private" not in response.text


def test_busy_worker_does_not_queue_a_second_inference():
    runtime = RecognitionRuntime()
    original = runtime.infer
    entered, release = Event(), Event()

    def blocked(*args):
        entered.set()
        assert release.wait(5)
        return original(*args)

    runtime.infer = blocked
    client = TestClient(create_worker_app("recognition", runtime, "secret"))
    headers = {
        "Authorization": "Bearer secret",
        "Content-Type": "application/octet-stream",
        "X-Audio-Sample-Rate": "16000",
        "X-Audio-Channels": "1",
        "X-Language": "en",
    }
    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(
            client.post, "/v1/recognize", headers=headers, content=b"00" * 1600
        )
        try:
            assert entered.wait(5)
            assert (
                client.post(
                    "/v1/recognize", headers=headers, content=b"00" * 1600
                ).status_code
                == 503
            )
        finally:
            release.set()
        assert first.result().status_code == 200
