"""Section 6 functional safety fixtures, never real speech/model validation."""
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.identity.errors import IdentityError
from app.modules.pronunciation import service
from app.modules.pronunciation.schemas import PronunciationAttemptHistoryDTO
from app.modules.speech import service as speech
from app.modules.speech.schemas import PronunciationAssessmentResponseDTO


@pytest.mark.parametrize("module_name,factory,slot", [
    ("asr_engine", "get_speech_recognizer", "_DEFAULT_RECOGNIZER"),
    ("evaluator", "get_pronunciation_evaluator", "_DEFAULT_EVALUATOR"),
])
def test_legacy_factories_never_default_to_synthetic_models(module_name, factory, slot, monkeypatch):
    from importlib import import_module
    module = import_module("app.modules.speech." + module_name)
    monkeypatch.setattr(module, slot, None)
    with pytest.raises(IdentityError) as error:
        getattr(module, factory)()
    assert error.value.code == "legacy_speech_unavailable"


@pytest.mark.parametrize("language", ["tagalog", "tl", "fil", "filipino", "Tagalog", "english", "en"])
def test_legacy_entry_point_cannot_infer_or_store_for_any_language(language, tmp_path, monkeypatch):
    monkeypatch.setattr(service, "PRIVATE_STORAGE_BASE", tmp_path)
    db = MagicMock()
    db.scalar.return_value = SimpleNamespace(language=language)
    with pytest.raises(IdentityError) as error:
        service.record_pronunciation_attempt(db, MagicMock(), uuid4(), b"invalid", "audio/wav", 1000)
    assert error.value.code == "legacy_speech_unavailable"
    assert not db.mock_calls and not list(tmp_path.iterdir())


@pytest.mark.parametrize("language", ["tagalog", "tl", "fil", "filipino", "english"])
@pytest.mark.parametrize("simulated", [True, False])
def test_legacy_history_masks_scores_and_diagnostic_feedback_without_rewriting(language, simulated, monkeypatch):
    monkeypatch.setattr(service, "get_or_create_learning_context", lambda *a, **k: SimpleNamespace(id=uuid4()))
    row = SimpleNamespace(id=uuid4(), attempted_at=datetime.now(timezone.utc), transcription="retained text",
        simulated=simulated, score=Decimal("99.5"), scoring_status="scored", feedback="99.5/100, mispronounced phone",
        result={"assessment": {"overall_score": 99.5}, "duration_ms": 1000})
    activity = SimpleNamespace(id=uuid4(), target_text="reference", language=language)
    db = MagicMock()
    db.execute.return_value.all.return_value = [(row, activity)]
    result = service.get_user_pronunciation_attempts(db, MagicMock())[0]
    assert result.score is None and result.pronunciation_scoring == "unavailable"
    assert result.scoring_status == "unsupported" and "99.5" not in result.feedback
    assert result.transcription == (None if simulated else "retained text")
    assert row.score == Decimal("99.5") and row.scoring_status == "scored"
    db.flush.assert_not_called()


@pytest.mark.parametrize("method", [speech.evaluate_pronunciation_attempt, speech.get_attempt_assessment])
@pytest.mark.parametrize("transcript", [None, "", "different words", "expected words"])
def test_legacy_assessment_never_rates_silence_mismatch_or_low_confidence(method, transcript, monkeypatch):
    monkeypatch.setattr(speech, "get_or_create_learning_context", lambda *a, **k: SimpleNamespace(id=uuid4()))
    row = SimpleNamespace(id=uuid4(), activity_id=uuid4(), transcription=transcript, simulated=True,
        score=99, scoring_status="scored", result={"assessment":{"overall_score":99},
            "transcription_metadata":{"confidence":.01, "silence_detected":not transcript}})
    db = MagicMock()
    db.scalar.side_effect = [row, SimpleNamespace(id=row.activity_id, language="tagalog")]
    result = method(db, MagicMock(), row.id).model_dump()
    assert result["score"] is None and result["assessment"] is None
    assert result["pronunciation_scoring"] == "unavailable" and result["transcription"] is None
    assert row.score == 99
    db.flush.assert_not_called()


def test_legacy_response_serializers_reject_injected_numbers():
    identity = dict(attempt_id=uuid4(), activity_id=uuid4(), scoring_status="unsupported")
    with pytest.raises(ValidationError):
        PronunciationAssessmentResponseDTO(**identity, score=75, message="unsupported")
    with pytest.raises(ValidationError):
        PronunciationAssessmentResponseDTO(**identity, assessment={"overall_score":75}, message="unsupported")
    with pytest.raises(ValidationError):
        PronunciationAttemptHistoryDTO(**identity, target_text="test", language="tagalog",
            attempted_at=datetime.now(timezone.utc), file_size_bytes=0, duration_ms=1000, score=75)


def test_mms_low_available_memory_never_starts_a_worker(monkeypatch, tmp_path):
    from app.modules.pronunciation import mms_runtime, wavlm_runtime
    monkeypatch.setattr(wavlm_runtime, "free_memory", lambda: 7 * 1024**3)
    process = MagicMock(side_effect=AssertionError("No model may start below the preflight"))
    monkeypatch.setattr(wavlm_runtime.subprocess, "Popen", process)
    settings = SimpleNamespace(pronunciation_mms_enabled=True,
        pronunciation_mms_noncommercial_acknowledged=True, pronunciation_mms_python=__file__,
        pronunciation_mms_cache=str(tmp_path), pronunciation_mms_device="cpu",
        pronunciation_mms_timeout_seconds=30)
    runner = mms_runtime.Runtime()
    try:
        with pytest.raises(IdentityError) as error:
            runner.assess(settings, b"synthetic invalid recording", "Magandang umaga")
        assert error.value.status == 503 and error.value.code == "mms_insufficient_memory"
        process.assert_not_called()
    finally:
        runner.close()
