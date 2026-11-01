"""Section 32: Pronunciation recording interface and backend audio tests."""

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock
from uuid import UUID, uuid4
import pytest

from app.modules.identity.errors import IdentityError
from app.modules.pronunciation.service import (
    validate_audio_file,
    get_pronunciation_activities,
    get_pronunciation_activity,
    record_pronunciation_attempt,
    get_user_pronunciation_attempts,
    MIN_AUDIO_BYTES,
    MAX_AUDIO_BYTES,
    MIN_DURATION_MS,
    MAX_DURATION_MS,
)
from app.models.ai import PronunciationActivity, PronunciationAttempt
from app.models.learning import LearningContext


# ---------------------------------------------------------------------------
# 1. Audio Validation Tests
# ---------------------------------------------------------------------------


def test_validate_audio_file_too_short():
    with pytest.raises(IdentityError) as exc_info:
        validate_audio_file(b"short", "audio/webm")
    assert exc_info.value.code == "audio_too_short_or_empty"
    assert exc_info.value.status == 422


def test_validate_audio_file_too_large():
    oversized = b"x" * (MAX_AUDIO_BYTES + 10)
    with pytest.raises(IdentityError) as exc_info:
        validate_audio_file(oversized, "audio/webm")
    assert exc_info.value.code == "audio_file_too_large"
    assert exc_info.value.status == 422


def test_validate_audio_file_magic_bytes_webm():
    # EBML / WebM header
    data = b"\x1a\x45\xdf\xa3" + b"\x00" * 150
    mime, ext = validate_audio_file(data, "application/octet-stream")
    assert mime == "audio/webm"
    assert ext == "webm"


def test_validate_audio_file_magic_bytes_wav():
    # RIFF....WAVE header
    data = b"RIFF" + b"\x00\x00\x00\x00" + b"WAVE" + b"\x00" * 150
    mime, ext = validate_audio_file(data, "application/octet-stream")
    assert mime == "audio/wav"
    assert ext == "wav"


def test_validate_audio_file_magic_bytes_ogg():
    data = b"OggS" + b"\x00" * 150
    mime, ext = validate_audio_file(data, "application/octet-stream")
    assert mime == "audio/ogg"
    assert ext == "ogg"


def test_validate_audio_file_magic_bytes_m4a():
    # ....ftyp header
    data = b"\x00\x00\x00\x18" + b"ftyp" + b"M4A " + b"\x00" * 150
    mime, ext = validate_audio_file(data, "application/octet-stream")
    assert mime == "audio/mp4"
    assert ext == "m4a"


def test_validate_audio_file_magic_bytes_aac():
    data = b"\xff\xf1" + b"\x00" * 150
    mime, ext = validate_audio_file(data, "application/octet-stream")
    assert mime == "audio/aac"
    assert ext == "aac"


def test_validate_audio_file_invalid_format():
    random_junk = b"\x01\x02\x03\x04\x05\x06" + b"\x00" * 150
    with pytest.raises(IdentityError) as exc_info:
        validate_audio_file(random_junk, "image/png")
    assert exc_info.value.code == "invalid_audio_format"
    assert exc_info.value.status == 422


# ---------------------------------------------------------------------------
# 2. Activity Lookup Tests
# ---------------------------------------------------------------------------


def test_get_pronunciation_activities_mocked():
    user = MagicMock()
    user.id = uuid4()
    db = MagicMock()

    act1 = MagicMock(spec=PronunciationActivity)
    act1.id = uuid4()
    act1.lesson_id = None
    act1.target_text = "Magandang umaga sa inyong lahat."
    act1.language = "tagalog"
    act1.instructions = "Bigkasin nang malinaw."
    act1.reference_audio_metadata = {"syllables": 10}
    act1.version = 1

    act2 = MagicMock(spec=PronunciationActivity)
    act2.id = uuid4()
    act2.lesson_id = None
    act2.target_text = "Good morning, welcome to our class."
    act2.language = "english"
    act2.instructions = "Natural intonation."
    act2.reference_audio_metadata = {"syllables": 8}
    act2.version = 1

    db.scalar.return_value = act1.id  # existing check
    db.scalars.return_value.all.return_value = [act1, act2]

    res = get_pronunciation_activities(db, user)
    assert res.total == 2
    assert len(res.activities) == 2
    assert res.activities[0].language == "tagalog"
    assert res.activities[1].language == "english"


def test_get_pronunciation_activity_not_found():
    user = MagicMock()
    db = MagicMock()
    db.scalar.return_value = None

    with pytest.raises(IdentityError) as exc_info:
        get_pronunciation_activity(db, user, uuid4())
    assert exc_info.value.code == "activity_not_found"
    assert exc_info.value.status == 404


# ---------------------------------------------------------------------------
# 3. Audio Recording Attempt Persistence Tests
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("audio,duration", [(b"", 0), (b"invalid", 2500), (b"\0" * 1024, 65000)])
def test_legacy_recording_refuses_before_storage_or_database(audio, duration, tmp_path, monkeypatch):
    import app.modules.pronunciation.service as service
    monkeypatch.setattr(service, "PRIVATE_STORAGE_BASE", tmp_path)
    db = MagicMock()
    with pytest.raises(IdentityError) as error:
        record_pronunciation_attempt(db, MagicMock(), uuid4(), audio, "audio/webm", duration)
    assert error.value.code == "legacy_speech_unavailable" and error.value.status == 409
    assert db.mock_calls == []
    assert list(tmp_path.iterdir()) == []


def test_get_user_pronunciation_attempts_mocked():
    user = MagicMock()
    user.id = uuid4()

    context = MagicMock()
    context.id = uuid4()

    att = MagicMock(spec=PronunciationAttempt)
    att.id = uuid4()
    att.attempted_at = datetime(2026, 10, 20, 10, 0, 0, tzinfo=timezone.utc)
    att.scoring_status = "pending"
    att.result = {"file_size_bytes": 1024, "duration_ms": 3200}

    act = MagicMock(spec=PronunciationActivity)
    act.id = uuid4()
    act.target_text = "Ang wika ay salamin ng kultura."
    act.language = "tagalog"

    db = MagicMock()
    db.scalar.return_value = context
    db.execute.return_value.all.return_value = [(att, act)]

    results = get_user_pronunciation_attempts(db, user)
    assert len(results) == 1
    assert results[0].target_text == "Ang wika ay salamin ng kultura."
    assert results[0].scoring_status == "unsupported"
    assert results[0].score is None
    assert results[0].pronunciation_scoring == "unavailable"
    assert results[0].duration_ms == 3200
    assert results[0].file_size_bytes == 1024
