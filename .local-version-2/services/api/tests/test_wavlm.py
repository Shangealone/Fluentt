"""Synthetic QA contracts only; these fixtures are NOT evidence of model accuracy/inference."""

import io
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from app.core.config import Settings
from app.modules.identity.errors import IdentityError
from app.modules.pronunciation.wavlm_contract import prediction, reference
from app.modules.pronunciation.wavlm_service import capabilities
from app.modules.pronunciation import wavlm_runtime as module


def synthetic_prediction():
    return {
        "overall_score": 24.5,
        "n_errors": 1,
        "words": [
            {
                "word": "The",
                "score": 24.5,
                "phonemes": [{"phone": "dh", "score": 24.5, "pherr_prob": 0.8, "error": True}],
            }
        ],
        "duration_ms": 1000,
        "processing_duration_ms": 123,
        "initialization_ms": 456,
    }


def test_real_contract_never_floors_scores_or_invents_other_dimensions():
    result = prediction(synthetic_prediction(), "The.")
    assert result.overall_score == 24.5 and result.words[0].phonemes[0].tip.startswith("Practise voiced TH")
    assert "fluency_score" not in result.model_dump() and "confidence" not in result.model_dump()
    clean = synthetic_prediction()
    clean["words"][0]["phonemes"][0].update(error=False, pherr_prob=0.2)
    clean["n_errors"] = 0
    assert prediction(clean, "the").words[0].phonemes[0].tip is None


@pytest.mark.parametrize(
    "change",
    [
        {"overall_score": float("nan")},
        {"overall_score": True},
        {"overall_score": 101},
        {"words": []},
        {
            "words": [
                {
                    "word": "Other",
                    "score": 24.5,
                    "phonemes": [{"phone": "dh", "score": 24.5, "pherr_prob": 0.8, "error": True}],
                }
            ]
        },
        {"duration_ms": 31000},
        {"n_errors": 0},
    ],
)
def test_incomplete_or_invalid_output_has_no_score(change):
    with pytest.raises(ValueError):
        prediction(synthetic_prediction() | change, "The.")


@pytest.mark.parametrize("value", ["", " ", "123", "Tagálóg", "hello" * 101, " ".join(["word"] * 61)])
def test_unsupported_references_rejected(value):
    with pytest.raises(ValueError):
        reference(value)


def test_language_resource_and_disabled_gates(tmp_path, monkeypatch):
    settings = Settings(_env_file=None)
    assert capabilities(settings, "english")["reason"] == "disabled"
    assert capabilities(settings, "tagalog")["reason"] == "language_unsupported"
    settings.pronunciation_wavlm_enabled = True
    assert capabilities(settings, "english")["reason"] == "runtime_missing"
    settings.pronunciation_wavlm_python = str(Path(__file__))
    settings.pronunciation_wavlm_cache = str(tmp_path)
    assert capabilities(settings, "english")["reason"] == "artifacts_missing"
    (tmp_path / "synthetic").write_text("QA only")
    manifest = {
        "revisions": {
            "scorer": module.REVISION,
            "backbone": module.BASE_REVISION,
            "alignment": module.ALIGNMENT_REVISION,
        },
        "files": {"synthetic": "wrong"},
    }
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    monkeypatch.setattr(module, "free_memory", lambda: 1)
    assert capabilities(settings, "english")["reason"] == "insufficient_memory"
    with pytest.raises(ValueError):
        module.verify_artifacts(tmp_path)


def test_local_worker_loads_once_and_removes_owned_uploads(tmp_path, monkeypatch):
    settings = SimpleNamespace(
        pronunciation_wavlm_python="synthetic-python",
        pronunciation_wavlm_cache=str(tmp_path),
        pronunciation_wavlm_device="cpu",
        pronunciation_wavlm_timeout_seconds=1,
    )
    monkeypatch.setattr(module, "prepared", lambda settings: "ready")
    monkeypatch.setattr(module, "verify_artifacts", lambda cache: None)
    reply = json.dumps({"ok": True, "result": synthetic_prediction()}) + "\n"
    process = SimpleNamespace(
        stdin=io.StringIO(), stdout=io.StringIO(reply + reply), poll=lambda: None, kill=Mock(), wait=Mock()
    )
    create = Mock(return_value=process)
    monkeypatch.setattr(module.subprocess, "Popen", create)
    runner = module.Runtime()
    for _ in range(2):
        assert runner.assess(settings, b"synthetic QA audio", "The.")["overall_score"] == 24.5
    paths = [json.loads(line)["audio_path"] for line in process.stdin.getvalue().splitlines()]
    assert create.call_count == 1 and all(not Path(path).exists() for path in paths)
    assert "FLUENTT_DATABASE_URL" not in create.call_args.kwargs["env"]
    runner.close()


def test_worker_failure_never_substitutes_a_score(monkeypatch, tmp_path):
    monkeypatch.setattr(module, "prepared", lambda settings: "ready")
    monkeypatch.setattr(module, "verify_artifacts", lambda cache: None)
    process = SimpleNamespace(
        stdin=io.StringIO(),
        stdout=io.StringIO('{"ok":false,"error":"alignment_failed"}\n'),
        poll=lambda: None,
        kill=Mock(),
        wait=Mock(),
    )
    monkeypatch.setattr(module.subprocess, "Popen", lambda *a, **kw: process)
    runner = module.Runtime()
    settings = SimpleNamespace(
        pronunciation_wavlm_python="QA",
        pronunciation_wavlm_cache=str(tmp_path),
        pronunciation_wavlm_device="cpu",
        pronunciation_wavlm_timeout_seconds=1,
    )
    with pytest.raises(IdentityError) as error:
        runner.assess(settings, b"QA", "The.")
    assert error.value.status == 422
    runner.close()


def test_worker_hard_deadline_kills_inference_and_cleans_audio(monkeypatch, tmp_path):
    from threading import Event

    event = Event()

    class BlockingOutput:
        def readline(self, limit):
            event.wait(1)
            return ""

        def close(self):
            event.set()

    process = SimpleNamespace(
        stdin=io.StringIO(), stdout=BlockingOutput(), poll=lambda: None, kill=Mock(side_effect=event.set), wait=Mock()
    )
    monkeypatch.setattr(module, "prepared", lambda settings: "ready")
    monkeypatch.setattr(module, "verify_artifacts", lambda cache: None)
    monkeypatch.setattr(module.subprocess, "Popen", lambda *a, **kw: process)
    runner = module.Runtime()
    settings = SimpleNamespace(
        pronunciation_wavlm_python="QA",
        pronunciation_wavlm_cache=str(tmp_path),
        pronunciation_wavlm_device="cpu",
        pronunciation_wavlm_timeout_seconds=0.01,
    )
    with pytest.raises(IdentityError) as error:
        runner.assess(settings, b"QA", "The.")
    assert error.value.status == 504 and process.kill.call_count == 1 and runner.process is None


def test_upload_limit_bounds_declared_and_streamed_bodies_before_parsing(monkeypatch):
    import asyncio
    import httpx
    from fastapi import FastAPI, APIRouter, Request
    from app.modules.pronunciation import upload_limit

    monkeypatch.setattr(upload_limit, "MAX_BODY", 32)
    app = FastAPI()
    router = APIRouter(route_class=upload_limit.AudioUploadRoute)

    @router.post("/api/v1/me/pronunciation/attempts")
    async def echo(request: Request):
        return {"size": len(await request.body())}

    app.include_router(router)

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            assert (await client.post("/api/v1/me/pronunciation/attempts", content=b"ok")).json() == {"size": 2}
            assert (await client.post("/api/v1/me/pronunciation/attempts", content=b"x" * 33)).status_code == 413

            async def chunks():
                yield b"x" * 20
                yield b"x" * 20

            assert (await client.post("/api/v1/me/pronunciation/attempts", content=chunks())).status_code == 413

    asyncio.run(run())
