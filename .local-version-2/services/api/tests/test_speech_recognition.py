"""Section 33: Multilingual Automatic Speech Recognition (ASR) Unit and Integration Tests."""

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock
from uuid import UUID, uuid4
import pytest

from app.modules.identity.errors import IdentityError
from app.modules.speech.asr_engine import (
    ASRResult,
    ASRWord,
    canonical_language,
    detect_audio_silence,
    normalize_transcript,
    get_speech_recognizer,
    SimulatedWhisperASR,
)
from app.modules.speech.schemas import (
    TranscriptionResponseDTO,
    TranscriptionStatusDTO,
)
from app.modules.speech.service import (
    transcribe_pronunciation_attempt,
    get_attempt_transcription,
)
from app.modules.pronunciation.service import (
    record_pronunciation_attempt,
    PRIVATE_STORAGE_BASE,
)
from app.models.ai import PronunciationActivity, PronunciationAttempt
from app.models.learning import LearningContext


# ---------------------------------------------------------------------------
# 1. ASR Engine & Audio Preprocessing Tests
# ---------------------------------------------------------------------------


def test_canonical_language_tagalog():
    assert canonical_language("tagalog") == "tl"
    assert canonical_language("Tagalog") == "tl"
    assert canonical_language("tl") == "tl"
    assert canonical_language("filipino") == "tl"
    assert canonical_language("fil") == "tl"


def test_canonical_language_english():
    assert canonical_language("english") == "en"
    assert canonical_language("English") == "en"
    assert canonical_language("en") == "en"


def test_normalize_transcript():
    assert normalize_transcript("  Magandang Umaga, Pilipinas!  ") == "magandang umaga, pilipinas"
    assert normalize_transcript("Hello... World?!") == "hello... world"
    assert normalize_transcript("pag-asa ng bayan") == "pag-asa ng bayan"
    assert normalize_transcript("don't give up") == "don't give up"
    assert normalize_transcript("") == ""


def test_detect_audio_silence_all_zeros():
    zero_bytes = b"\x00" * 1024
    assert detect_audio_silence(zero_bytes) is True


def test_detect_audio_silence_uniform_bytes():
    uniform = b"\xaa" * 1024
    assert detect_audio_silence(uniform) is True


def test_detect_audio_silence_active_speech():
    # Audio with natural dynamic variance
    active = bytes([i % 256 for i in range(2048)])
    assert detect_audio_silence(active) is False


def test_simulated_whisper_asr_tagalog():
    asr = SimulatedWhisperASR()
    audio = bytes([i % 256 for i in range(1024)])
    res = asr.transcribe(
        audio_bytes=audio,
        mime_type="audio/webm",
        duration_ms=3000,
        prompt_text="Magandang umaga sa inyong lahat.",
        prompt_language="tagalog",
    )
    assert res.detected_language == "tl"
    assert res.prompt_language == "tl"
    assert res.silence_detected is False
    assert res.simulated is True
    assert res.model_id == "whisper-multilingual-v1"
    assert res.raw_transcript == "Magandang umaga sa inyong lahat."
    assert res.normalized_transcript == "magandang umaga sa inyong lahat"
    assert len(res.words) == 5
    assert res.words[0].word == "Magandang"
    assert res.words[0].start_time_ms >= 0
    assert res.words[0].end_time_ms > res.words[0].start_time_ms
    assert res.confidence is not None
    assert 0.80 <= res.confidence <= 1.0


def test_simulated_whisper_asr_english():
    asr = SimulatedWhisperASR()
    audio = bytes([i % 256 for i in range(1024)])
    res = asr.transcribe(
        audio_bytes=audio,
        mime_type="audio/wav",
        duration_ms=4000,
        prompt_text="Language connects people across communities.",
        prompt_language="english",
    )
    assert res.detected_language == "en"
    assert res.prompt_language == "en"
    assert res.silence_detected is False
    assert len(res.words) == 5
    assert res.words[0].word == "Language"


def test_simulated_whisper_asr_silence_handling():
    asr = SimulatedWhisperASR()
    silence = b"\x00" * 1024
    res = asr.transcribe(
        audio_bytes=silence,
        mime_type="audio/webm",
        duration_ms=2500,
        prompt_text="Salamat sa tulong.",
        prompt_language="tagalog",
    )
    assert res.silence_detected is True
    assert res.raw_transcript == ""
    assert res.normalized_transcript == ""
    assert res.confidence == 0.0
    assert len(res.words) == 0


def test_simulated_whisper_asr_unsupported_language():
    asr = SimulatedWhisperASR()
    audio = bytes([i % 256 for i in range(500)])
    with pytest.raises(ValueError) as exc:
        asr.transcribe(
            audio_bytes=audio,
            mime_type="audio/webm",
            duration_ms=2000,
            prompt_text="Bonjour tout le monde",
            prompt_language="french",
        )
    assert "Unsupported ASR prompt language" in str(exc.value)


# ---------------------------------------------------------------------------
# 2. Service-Level Transcription Tests with Mocked DB
# ---------------------------------------------------------------------------


def test_transcribe_pronunciation_attempt_success():
    db = MagicMock()
    user = MagicMock()
    user.id = uuid4()
    context_id = uuid4()
    attempt_id = uuid4()
    activity_id = uuid4()

    # Create dummy storage file
    test_storage_dir = PRIVATE_STORAGE_BASE / str(context_id)
    test_storage_dir.mkdir(parents=True, exist_ok=True)
    file_path = test_storage_dir / f"{attempt_id}.webm"
    audio_content = bytes([i % 256 for i in range(1024)])
    with open(file_path, "wb") as f:
        f.write(audio_content)

    mock_context = MagicMock()
    mock_context.id = context_id

    mock_attempt = MagicMock()
    mock_attempt.id = attempt_id
    mock_attempt.context_id = context_id
    mock_attempt.activity_id = activity_id
    mock_attempt.transcription = None
    mock_attempt.simulated = False
    mock_attempt.scoring_status = "pending"
    mock_attempt.result = {
        "storage_path": f"{attempt_id}.webm",
        "mime_type": "audio/webm",
        "duration_ms": 3500,
    }

    mock_activity = MagicMock()
    mock_activity.id = activity_id
    mock_activity.target_text = "Magandang araw sa iyo."
    mock_activity.language = "tagalog"

    db.scalar.side_effect = [mock_context, mock_attempt, mock_activity]

    res = transcribe_pronunciation_attempt(
        db,
        user=user,
        attempt_id=attempt_id,
    )

    assert isinstance(res, TranscriptionResponseDTO)
    assert res.attempt_id == attempt_id
    assert res.raw_transcript == "Magandang araw sa iyo."
    assert res.detected_language == "tl"
    assert res.silence_detected is False
    assert mock_attempt.transcription == "Magandang araw sa iyo."
    assert mock_attempt.simulated is True
    assert "transcription_metadata" in mock_attempt.result

    # Cleanup
    try:
        file_path.unlink()
    except OSError:
        pass


def test_transcribe_pronunciation_attempt_idempotent():
    db = MagicMock()
    user = MagicMock()
    context_id = uuid4()
    attempt_id = uuid4()
    activity_id = uuid4()

    mock_context = MagicMock()
    mock_context.id = context_id

    mock_attempt = MagicMock()
    mock_attempt.id = attempt_id
    mock_attempt.context_id = context_id
    mock_attempt.activity_id = activity_id
    mock_attempt.transcription = "Already transcribed text."
    mock_attempt.simulated = True
    mock_attempt.scoring_status = "pending"
    mock_attempt.result = {
        "transcription_metadata": {
            "raw_transcript": "Already transcribed text.",
            "normalized_transcript": "already transcribed text",
            "detected_language": "tl",
            "prompt_language": "tl",
            "confidence": 0.95,
            "silence_detected": False,
            "words": [],
        }
    }

    mock_activity = MagicMock()
    mock_activity.id = activity_id
    mock_activity.language = "tagalog"

    db.scalar.side_effect = [mock_context, mock_attempt, mock_activity]

    res = transcribe_pronunciation_attempt(
        db,
        user=user,
        attempt_id=attempt_id,
        force_retranscribe=False,
    )

    assert res.transcription == "Already transcribed text."
    assert res.message == "Existing transcription retrieved successfully."


def test_transcribe_pronunciation_attempt_cross_student_forbidden():
    db = MagicMock()
    user = MagicMock()
    attempt_id = uuid4()

    mock_context = MagicMock()
    mock_context.id = uuid4()

    # Attempt query returns None because context_id does not match
    db.scalar.side_effect = [mock_context, None]

    with pytest.raises(IdentityError) as exc_info:
        transcribe_pronunciation_attempt(db, user, attempt_id)
    assert exc_info.value.code == "attempt_not_found"
    assert exc_info.value.status == 404


def test_get_attempt_transcription_status():
    db = MagicMock()
    user = MagicMock()
    context_id = uuid4()
    attempt_id = uuid4()

    mock_context = MagicMock()
    mock_context.id = context_id

    mock_attempt = MagicMock()
    mock_attempt.id = attempt_id
    mock_attempt.context_id = context_id
    mock_attempt.transcription = "Magandang gabi."
    mock_attempt.simulated = True
    mock_attempt.result = {
        "transcription_metadata": {
            "detected_language": "tl",
            "prompt_language": "tl",
            "silence_detected": False,
        }
    }

    db.scalar.side_effect = [mock_context, mock_attempt]

    status = get_attempt_transcription(db, user, attempt_id)
    assert isinstance(status, TranscriptionStatusDTO)
    assert status.has_transcription is True
    assert status.transcription == "Magandang gabi."
    assert status.status == "completed"
    assert status.detected_language == "tl"
