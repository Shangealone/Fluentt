"""Pronunciation service: audio validation, private storage, and attempt recording."""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4
from sqlalchemy import select, desc

from app.models.ai import PronunciationActivity, PronunciationAttempt
from app.models.learning import LearningContext
from app.models.users import User
from app.modules.identity.errors import IdentityError
from app.modules.spaced_repetition.service import get_or_create_learning_context
from app.modules.pronunciation.schemas import (
    PronunciationActivityDTO,
    PronunciationActivitiesResponse,
    PronunciationAttemptSubmissionDTO,
    PronunciationAttemptHistoryDTO,
)

MIN_AUDIO_BYTES = 100
MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MiB
MIN_DURATION_MS = 500  # 0.5s
MAX_DURATION_MS = 60000  # 60s

# Private storage directory outside public web root
PRIVATE_STORAGE_BASE = Path(__file__).resolve().parents[4] / "storage" / "audio"


def validate_audio_file(data: bytes, reported_mime: str | None) -> tuple[str, str]:
    """Validates audio file length and content headers (magic bytes).
    
    Returns (normalized_mime_type, file_extension).
    """
    size = len(data)
    if size < MIN_AUDIO_BYTES:
        raise IdentityError(
            422,
            "audio_too_short_or_empty",
            f"Audio payload is too small ({size} bytes). Minimum size is {MIN_AUDIO_BYTES} bytes.",
        )
    if size > MAX_AUDIO_BYTES:
        raise IdentityError(
            422,
            "audio_file_too_large",
            f"Audio payload exceeds maximum size limit of 10 MiB ({size} bytes).",
        )

    # Magic byte signature detection
    if data.startswith(b"\x1a\x45\xdf\xa3"):
        return ("audio/webm", "webm")
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return ("audio/wav", "wav")
    if data.startswith(b"OggS"):
        return ("audio/ogg", "ogg")
    if len(data) >= 8 and data[4:8] == b"ftyp":
        return ("audio/mp4", "m4a")
    if len(data) >= 2 and data[:2] in (b"\xff\xf1", b"\xff\xf9"):
        return ("audio/aac", "aac")

    # Fallback to reported mime if supported container
    clean_mime = (reported_mime or "").split(";")[0].strip().lower()
    if clean_mime in ("audio/webm", "video/webm"):
        return ("audio/webm", "webm")
    if clean_mime in ("audio/wav", "audio/x-wav"):
        return ("audio/wav", "wav")
    if clean_mime in ("audio/mp4", "audio/m4a", "audio/x-m4a", "video/mp4"):
        return ("audio/mp4", "m4a")
    if clean_mime in ("audio/ogg", "audio/opus"):
        return ("audio/ogg", "ogg")
    if clean_mime in ("audio/aac", "audio/x-aac"):
        return ("audio/aac", "aac")

    raise IdentityError(
        422,
        "invalid_audio_format",
        f"Unsupported audio container. Supported formats are WebM (Opus), WAV, M4A/MP4, OGG, and AAC.",
    )


def ensure_default_activities(db) -> None:
    """Seeds authentic published pronunciation activities if none currently exist."""
    existing = db.scalar(select(PronunciationActivity.id).limit(1))
    if existing:
        return

    defaults = [
        # Tagalog / Filipino Prompts
        PronunciationActivity(
            target_text="Magandang umaga sa inyong lahat.",
            language="tagalog",
            instructions="Bigkasin nang malinaw at may magalang na intonasyon.",
            reference_audio_metadata={"syllables": 10, "pace": "natural", "phonetic": "ma-gan-dang u-ma-ga sa in-yong la-hat"},
            status="published",
            version=1,
            locked_at=datetime.now(timezone.utc),
        ),
        PronunciationActivity(
            target_text="Ang wika ay salamin ng kultura ng isang bansa.",
            language="tagalog",
            instructions="Pansinin ang diin sa mga salitang 'wika' at 'kultura'.",
            reference_audio_metadata={"syllables": 17, "pace": "moderate", "phonetic": "ang wi-ka ay sa-la-min ng kul-tu-ra ng i-sang ban-sa"},
            status="published",
            version=1,
            locked_at=datetime.now(timezone.utc),
        ),
        PronunciationActivity(
            target_text="Salamat sa iyong tulong at paggabay.",
            language="tagalog",
            instructions="Ibigkas nang natural nang walang pag-aalinlangan.",
            reference_audio_metadata={"syllables": 12, "pace": "natural"},
            status="published",
            version=1,
            locked_at=datetime.now(timezone.utc),
        ),
        # English Prompts
        PronunciationActivity(
            target_text="Good morning, welcome to our language practice lesson.",
            language="english",
            instructions="Focus on clear consonant articulation and natural sentence rhythm.",
            reference_audio_metadata={"syllables": 16, "pace": "moderate"},
            status="published",
            version=1,
            locked_at=datetime.now(timezone.utc),
        ),
        PronunciationActivity(
            target_text="Language connects people across different cultures and communities.",
            language="english",
            instructions="Emphasize 'connects', 'cultures', and 'communities' with appropriate stress.",
            reference_audio_metadata={"syllables": 19, "pace": "natural"},
            status="published",
            version=1,
            locked_at=datetime.now(timezone.utc),
        ),
    ]
    for act in defaults:
        db.add(act)
    db.flush()


def get_pronunciation_activities(
    db,
    user: User,
    language: str | None = None,
) -> PronunciationActivitiesResponse:
    ensure_default_activities(db)

    stmt = select(PronunciationActivity).where(PronunciationActivity.status == "published")
    if language:
        stmt = stmt.where(PronunciationActivity.language == language.lower())
    stmt = stmt.order_by(PronunciationActivity.language.asc(), PronunciationActivity.created_at.asc())

    rows = db.scalars(stmt).all()
    dtos = [
        PronunciationActivityDTO(
            id=r.id,
            lesson_id=r.lesson_id,
            target_text=r.target_text,
            language=r.language,
            instructions=r.instructions,
            reference_audio_metadata=r.reference_audio_metadata or {},
            version=r.version,
        )
        for r in rows
    ]
    return PronunciationActivitiesResponse(activities=dtos, total=len(dtos))


def get_pronunciation_activity(
    db,
    user: User,
    activity_id: UUID,
) -> PronunciationActivityDTO:
    act = db.scalar(
        select(PronunciationActivity).where(
            PronunciationActivity.id == activity_id,
            PronunciationActivity.status == "published",
        )
    )
    if not act:
        raise IdentityError(404, "activity_not_found", "Pronunciation activity not found or not published.")

    return PronunciationActivityDTO(
        id=act.id,
        lesson_id=act.lesson_id,
        target_text=act.target_text,
        language=act.language,
        instructions=act.instructions,
        reference_audio_metadata=act.reference_audio_metadata or {},
        version=act.version,
    )


def record_pronunciation_attempt(
    db,
    user: User,
    activity_id: UUID,
    audio_bytes: bytes,
    reported_content_type: str | None,
    client_duration_ms: int,
    context_type: str = "self_study",
    class_id: UUID | None = None,
) -> PronunciationAttemptSubmissionDTO:
    """Processes uploaded audio file, verifies validity, saves to private storage, and creates attempt."""
    now = datetime.now(timezone.utc)

    # 1. Duration bounds check
    if client_duration_ms < MIN_DURATION_MS:
        raise IdentityError(
            422,
            "duration_too_short",
            f"Recording duration ({client_duration_ms} ms) is too short. Minimum duration is {MIN_DURATION_MS} ms.",
        )
    if client_duration_ms > MAX_DURATION_MS:
        raise IdentityError(
            422,
            "duration_too_long",
            f"Recording duration ({client_duration_ms} ms) exceeds the maximum allowed limit of {MAX_DURATION_MS} ms.",
        )

    # 2. Activity existence check
    activity = db.scalar(
        select(PronunciationActivity).where(
            PronunciationActivity.id == activity_id,
            PronunciationActivity.status == "published",
        )
    )
    if not activity:
        raise IdentityError(404, "activity_not_found", "Pronunciation activity not found.")

    # 3. Audio format and size validation
    mime_type, file_ext = validate_audio_file(audio_bytes, reported_content_type)

    # 4. Resolve context
    context = get_or_create_learning_context(db, user, context_type, class_id=class_id)

    # 5. Persist to private storage
    attempt_id = uuid4()
    storage_dir = PRIVATE_STORAGE_BASE / str(context.id)
    storage_dir.mkdir(parents=True, exist_ok=True)
    file_path = storage_dir / f"{attempt_id}.{file_ext}"

    try:
        with open(file_path, "wb") as f:
            f.write(audio_bytes)
    except OSError as e:
        raise IdentityError(500, "storage_write_failed", f"Failed to persist audio file: {str(e)}")

    # 6. Create PronunciationAttempt record
    from app.modules.speech.asr_engine import get_speech_recognizer

    recognizer = get_speech_recognizer()
    try:
        asr_res = recognizer.transcribe(
            audio_bytes=audio_bytes,
            mime_type=mime_type,
            duration_ms=client_duration_ms,
            prompt_text=activity.target_text,
            prompt_language=activity.language,
        )
    except Exception:
        asr_res = None

    raw_transcription = asr_res.raw_transcript if asr_res else None
    asr_meta = asr_res.model_dump() if asr_res else None
    is_simulated = asr_res.simulated if asr_res else False
    err_code = "silence_detected" if asr_res and asr_res.silence_detected else None

    result_payload = {
        "file_size_bytes": len(audio_bytes),
        "duration_ms": client_duration_ms,
        "mime_type": mime_type,
        "file_extension": file_ext,
        "storage_path": str(file_path.name),
        "language": activity.language,
    }
    if asr_meta:
        result_payload["transcription_metadata"] = asr_meta

    # 6. Evaluate Pronunciation (Section 34)
    score_val = None
    feedback_val = None
    scoring_status_val = "pending"
    evaluator_cfg_id = None
    assessment_data = None

    if asr_res and not asr_res.silence_detected and raw_transcription:
        from decimal import Decimal
        from app.modules.speech.evaluator import get_pronunciation_evaluator
        from app.modules.speech.service import get_or_create_evaluator_configuration

        evaluator = get_pronunciation_evaluator()
        eval_res = evaluator.evaluate(
            prompt_text=activity.target_text,
            target_language=activity.language,
            asr_result=asr_res,
            audio_duration_ms=client_duration_ms,
        )
        evaluator_cfg_id = get_or_create_evaluator_configuration(db)
        score_val = Decimal(str(eval_res.overall_score))
        feedback_val = eval_res.summary_feedback
        scoring_status_val = "scored"
        assessment_data = eval_res.model_dump()
        result_payload["assessment"] = assessment_data
    elif asr_res and asr_res.silence_detected:
        scoring_status_val = "pending"
        feedback_val = "No speech detected in audio to evaluate."

    attempt = PronunciationAttempt(
        id=attempt_id,
        context_id=context.id,
        activity_id=activity.id,
        attempted_at=now,
        transcription=raw_transcription,
        feedback=feedback_val,
        score=score_val,
        scoring_status=scoring_status_val,
        asr_configuration_id=None,
        evaluator_configuration_id=evaluator_cfg_id,
        result=result_payload,
        error_code=err_code,
        simulated=is_simulated,
    )
    db.add(attempt)
    db.flush()

    msg = (
        "Audio recorded. No speech detected."
        if asr_res and asr_res.silence_detected
        else f"Pronunciation assessed successfully. Score: {float(score_val):.1f}/100."
        if score_val is not None
        else "Audio recorded and transcribed successfully."
    )

    return PronunciationAttemptSubmissionDTO(
        attempt_id=attempt.id,
        activity_id=activity.id,
        target_text=activity.target_text,
        language=activity.language,
        attempted_at=now,
        scoring_status=scoring_status_val,
        file_size_bytes=len(audio_bytes),
        duration_ms=client_duration_ms,
        mime_type=mime_type,
        simulated=is_simulated,
        message=msg,
        transcription=raw_transcription,
        transcription_metadata=asr_meta,
        score=float(score_val) if score_val is not None else None,
        feedback=feedback_val,
        assessment=assessment_data,
    )


def get_user_pronunciation_attempts(
    db,
    user: User,
    activity_id: UUID | None = None,
    context_type: str = "self_study",
    class_id: UUID | None = None,
    limit: int = 20,
) -> list[PronunciationAttemptHistoryDTO]:
    """Owner-only attempt history retrieval. Strictly isolated by learner context."""
    context = get_or_create_learning_context(db, user, context_type, class_id=class_id)

    stmt = (
        select(PronunciationAttempt, PronunciationActivity)
        .join(PronunciationActivity, PronunciationActivity.id == PronunciationAttempt.activity_id)
        .where(PronunciationAttempt.context_id == context.id)
    )
    if activity_id:
        stmt = stmt.where(PronunciationAttempt.activity_id == activity_id)

    stmt = stmt.order_by(desc(PronunciationAttempt.attempted_at)).limit(limit)

    rows = db.execute(stmt).all()
    results = []
    for att, act in rows:
        raw_trans = att.transcription if isinstance(att.transcription, str) else None
        score_val = float(att.score) if att.score is not None else None
        feed_val = att.feedback if isinstance(att.feedback, str) else None
        results.append(
            PronunciationAttemptHistoryDTO(
                attempt_id=att.id,
                activity_id=act.id,
                target_text=act.target_text,
                language=act.language,
                attempted_at=att.attempted_at,
                scoring_status=att.scoring_status,
                file_size_bytes=int(att.result.get("file_size_bytes", 0)),
                duration_ms=int(att.result.get("duration_ms", 0)),
                transcription=raw_trans,
                score=score_val,
                feedback=feed_val,
            )
        )
    return results
