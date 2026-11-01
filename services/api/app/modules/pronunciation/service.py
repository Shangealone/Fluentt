"""Activity reads and unscored legacy compatibility; real models have separate services."""

from datetime import datetime, timezone
from uuid import UUID
from pathlib import Path
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

# Historical storage location retained for operator retention review only.
# No runtime legacy writer or reader opens recordings here.
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
            reference_audio_metadata={
                "syllables": 10,
                "pace": "natural",
                "phonetic": "ma-gan-dang u-ma-ga sa in-yong la-hat",
            },
            status="published",
            version=1,
            locked_at=datetime.now(timezone.utc),
        ),
        PronunciationActivity(
            target_text="Ang wika ay salamin ng kultura ng isang bansa.",
            language="tagalog",
            instructions="Pansinin ang diin sa mga salitang 'wika' at 'kultura'.",
            reference_audio_metadata={
                "syllables": 17,
                "pace": "moderate",
                "phonetic": "ang wi-ka ay sa-la-min ng kul-tu-ra ng i-sang ban-sa",
            },
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
    """Retain the legacy entry point, but never synthesize speech or store new audio.

    Real processing requires the versioned WavLM/MMS request, consent and retry
    identity. Do not infer these or silently route old consumers to a model.
    """
    raise IdentityError(
        409, "legacy_speech_unavailable",
        "Legacy speech processing is unavailable. Use English WavLM assessment "
        "or Tagalog MMS transcription with explicit consent and a recording request UUID.",
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
        # Legacy projections never expose retained heuristic scores or feedback.
        if att.simulated:
            raw_trans = None
        results.append(
            PronunciationAttemptHistoryDTO(
                attempt_id=att.id,
                activity_id=act.id,
                target_text=act.target_text,
                language=act.language,
                attempted_at=att.attempted_at,
                scoring_status="unsupported",
                file_size_bytes=int(att.result.get("file_size_bytes", 0)),
                duration_ms=int(att.result.get("duration_ms", 0)),
                transcription=raw_trans,
                score=None,
                pronunciation_scoring="unavailable",
                feedback="Legacy pronunciation feedback is unavailable. Use model-specific history for real results.",
            )
        )
    return results
