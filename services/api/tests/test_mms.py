"""Synthetic contracts/doubles, not real speech-model validation."""
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import pytest

from app.core.config import Settings
from app.modules.identity.errors import IdentityError
from app.modules.pronunciation import mms_contract as contract, mms_runtime as module
from app.modules.pronunciation.mms_service import capabilities
from ml.mms.artifacts import FILES, MODEL_ID, REVISION, manifest, sha256


def synthetic_prediction():
    return {"transcript": "Magandang umaga", "confidence": None, "confidence_status": "unavailable_uncalibrated",
            "duration_ms": 1000, "processing_duration_ms": 40, "initialization_ms": 80}


def test_text_comparison_is_not_pronunciation_and_preserves_language_distinctions():
    raw = "  MAGANDANG, umaga!  "
    assert contract.reference(raw)[0] == raw
    assert contract.compare(raw, "magandang umaga").exact_match
    for a, b in [("ng", "nang"), ("bása", "basa"), ("niño", "nino"), ("pag-ibig", "pag ibig")]:
        assert not contract.compare(a, b).exact_match
    assert contract.normalize("ako’y  masaya.") == "ako'y masaya"
    assert contract.normalize("ni\u006e\u0303o") == "niño"
    value = contract.compare("Magandang umaga sa iyo", "magandang gabi iyo")
    assert any(row.kind == "replace" for row in value.differences)
    assert not {"overall_score", "accuracy", "phonemes", "wer"} & value.model_dump().keys()


@pytest.mark.parametrize("text", ["", " ", "123", "😀", "x" * 501, "日本語", "salamat\x00", "\u202ehello"])
def test_reference_validation(text):
    with pytest.raises(ValueError):
        contract.reference(text)


@pytest.mark.parametrize("text", ["", "123", "日本語", "salamat\x00", "salamat" * 300])
def test_recognized_text_is_validated_too(text):
    with pytest.raises(ValueError):
        contract.compare("Salamat", text)


@pytest.mark.parametrize("change", [{"confidence": .99}, {"overall_score": 100}, {"transcript": ""},
                                    {"duration_ms": 499}, {"duration_ms": 30001}, {"phonemes": []}])
def test_prediction_rejects_fabricated_or_invalid_fields(change):
    with pytest.raises(ValueError):
        contract.Prediction.model_validate(synthetic_prediction() | change)


def artifacts(tmp_path):
    for name in FILES:
        (tmp_path / name).write_text("synthetic test only")
    data = {"model_id": MODEL_ID, "revision": REVISION, "adapter": "tgl",
            "files": {name: sha256(tmp_path / name) for name in FILES}}
    (tmp_path / "manifest.json").write_text(json.dumps(data))
    return data


def test_manifest_and_license_memory_gates(tmp_path, monkeypatch):
    data = artifacts(tmp_path)
    assert manifest(tmp_path, verify=True)["revision"] == contract.REVISION
    settings = Settings(_env_file=None, pronunciation_mms_python=__file__, pronunciation_mms_cache=str(tmp_path))
    assert capabilities(settings, "tagalog")["reason"] == "disabled"
    assert capabilities(settings, "english")["reason"] == "language_unsupported"
    settings.pronunciation_mms_enabled = True
    assert capabilities(settings, "tagalog")["reason"] == "license_review_required"
    settings.pronunciation_mms_noncommercial_acknowledged = True
    monkeypatch.setattr(module.wavlm_runtime, "free_memory", lambda: 4 * 1024**3)
    assert capabilities(settings, "tagalog")["reason"] == "insufficient_memory"
    monkeypatch.setattr(module.wavlm_runtime, "free_memory", lambda: 9 * 1024**3)
    assert capabilities(settings, "tagalog")["available"]
    (tmp_path / FILES[0]).write_text("changed")
    with pytest.raises(ValueError):
        manifest(tmp_path, verify=True)
    data["files"].pop(FILES[0])
    (tmp_path / "manifest.json").write_text(json.dumps(data))
    assert capabilities(settings, "tagalog")["reason"] == "artifacts_missing"


def test_reused_worker_no_prompt_leak_no_network_no_audio_retention(tmp_path, monkeypatch):
    monkeypatch.setenv("USERNAME", "synthetic-local-runtime")
    monkeypatch.setattr(module, "prepared", lambda settings: "ready")
    monkeypatch.setattr(module, "manifest", lambda *args, **kw: None)
    reply = json.dumps({"ok": True, "result": synthetic_prediction()}) + "\n"
    process = SimpleNamespace(stdin=io.StringIO(), stdout=io.StringIO(reply + reply),
                              poll=lambda: None, kill=Mock(), wait=Mock())
    create = Mock(return_value=process)
    monkeypatch.setattr(module.wavlm_runtime.subprocess, "Popen", create)
    settings = Settings(_env_file=None, pronunciation_mms_python="synthetic-python", pronunciation_mms_cache=str(tmp_path),
                        pronunciation_mms_enabled=True, pronunciation_mms_noncommercial_acknowledged=True)
    runner = module.Runtime()
    try:
        for _ in range(2):
            assert runner.assess(settings, b"synthetic QA audio", "Magandang umaga")["confidence"] is None
        requests = [json.loads(line) for line in process.stdin.getvalue().splitlines()]
        assert create.call_count == 1
        assert all(not Path(row["audio_path"]).exists() for row in requests)
        env = create.call_args.kwargs["env"]
        assert env["HF_HUB_OFFLINE"] == "1" and "FLUENTT_DATABASE_URL" not in env
        assert env["USERNAME"] == "synthetic-local-runtime"
    finally:
        runner.close()


@pytest.mark.parametrize("code", ["silent_audio", "invalid_audio", "no_speech", "model_unavailable"])
def test_failed_inference_returns_no_substitute(tmp_path, monkeypatch, code):
    monkeypatch.setattr(module, "prepared", lambda settings: "ready")
    monkeypatch.setattr(module, "manifest", lambda *args, **kw: None)
    process = SimpleNamespace(stdin=io.StringIO(), stdout=io.StringIO(json.dumps({"ok": False, "error": code}) + "\n"),
                              poll=lambda: None, kill=Mock(), wait=Mock())
    monkeypatch.setattr(module.wavlm_runtime.subprocess, "Popen", lambda *args, **kw: process)
    runner = module.Runtime()
    with pytest.raises(IdentityError) as error:
        runner.assess(Settings(_env_file=None, pronunciation_mms_enabled=True,
                              pronunciation_mms_noncommercial_acknowledged=True), b"synthetic", "Salamat")
    assert error.value.status == (503 if code == "model_unavailable" else 422)
    assert error.value.code.startswith("mms_")
    runner.close()


def test_worker_import_uses_shared_decoder_without_self_import():
    path = Path(__file__).resolve().parents[1] / "ml/mms/worker.py"
    spec = importlib.util.spec_from_file_location("mms_worker_test", path)
    worker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(worker)
    assert callable(worker.decode)


def test_asr_validation_metrics_are_corpus_error_rates_not_scores():
    from app.modules.pronunciation.validation_metrics import asr_metrics, edit_distance
    assert edit_distance("abc", "axc") == 1
    value = asr_metrics([("Magandang umaga", "magandang gabi"), ("salamat", "salamat")])
    assert value["word_errors"] == 1 and value["reference_words"] == 3
    assert value["wer"] == pytest.approx(1/3) and value["metric_type"].endswith("not_pronunciation")
    assert asr_metrics([("ako", "ako ako ako")])["wer"] == 2  # Never clamp ASR errors to a 0–100 accuracy score.
    with pytest.raises(ValueError):
        asr_metrics([])


def test_mms_loader_pins_tgl_offline_safetensors_and_reuses_model(monkeypatch):
    import sys
    path = Path(__file__).resolve().parents[1] / "ml/mms/pipeline.py"
    spec = importlib.util.spec_from_file_location("mms_pipeline_test", path)
    pipeline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pipeline)
    processor = SimpleNamespace(tokenizer=SimpleNamespace(target_lang="tgl", set_target_lang=Mock()))
    model = SimpleNamespace(target_lang="tgl")
    model.to = Mock(return_value=model)
    model.eval = Mock(return_value=model)
    model.load_adapter = Mock()
    processor_loader, model_loader = Mock(return_value=processor), Mock(return_value=model)
    monkeypatch.setitem(sys.modules, "artifacts", SimpleNamespace(manifest=Mock(), MIN_FREE_BYTES=8 * 1024**3))
    monkeypatch.setitem(sys.modules, "psutil", SimpleNamespace(virtual_memory=lambda: SimpleNamespace(available=9 * 1024**3)))
    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(set_num_threads=Mock()))
    monkeypatch.setitem(sys.modules, "transformers", SimpleNamespace(
        AutoProcessor=SimpleNamespace(from_pretrained=processor_loader),
        Wav2Vec2ForCTC=SimpleNamespace(from_pretrained=model_loader)))
    transcriber = pipeline.Transcriber("synthetic-cache")
    transcriber.load()
    transcriber.load()
    assert processor_loader.call_count == model_loader.call_count == 1
    assert processor_loader.call_args.kwargs == {"target_lang": "tgl", "local_files_only": True, "trust_remote_code": False}
    assert model_loader.call_args.kwargs == {"local_files_only": True, "use_safetensors": True}
    model.load_adapter.assert_called_once_with("tgl", local_files_only=True, use_safetensors=True)


def test_language_switch_releases_idle_weights_but_never_interrupts_inference():
    from app.modules.pronunciation.wavlm_runtime import Runtime, MODEL_LOCK
    english, tagalog = Runtime(), Runtime()
    process = SimpleNamespace(stdin=io.StringIO(), stdout=io.StringIO(), kill=Mock(), wait=Mock())
    english.process, english.loaded = process, True
    try:
        MODEL_LOCK.acquire()
        assert tagalog.select() is False
        with pytest.raises(IdentityError) as error:
            tagalog.assess(SimpleNamespace(), b"synthetic QA", "reference")
        assert error.value.status == 429
        assert not process.kill.called and english.loaded
        MODEL_LOCK.release()
        assert tagalog.select() is True
        assert process.kill.call_count == 1 and english.process is None
        assert tagalog.select() is True  # Repeated same-language selection does not load anything.
    finally:
        if MODEL_LOCK.locked():
            MODEL_LOCK.release()
        english.close()
        tagalog.close()
