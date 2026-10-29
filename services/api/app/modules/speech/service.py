"""Speech recognition service: attempt transcription execution and retrieval."""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID
from sqlalchemy import select

from app.models.ai import PronunciationActivity, PronunciationAttempt
from app.models.learning import LearningContext
from app.models.users import User
from app.modules.identity.errors import IdentityError
from app.modules.spaced_repetition.service import get_or_create_learning_context
from app.modules.pronunciation.service import PRIVATE_STORAGE_BASE
from app.modules.speech.asr_engine import get_speech_recognizer
from app.modules.speech.schemas import (
    ASRWordDTO,
    TranscriptionResponseDTO,
    TranscriptionStatusDTO,
)


def transcribe_pronunciation_attempt(
    db,
    user: User,
    attempt_id: UUID,
    force_retranscribe: bool = False,
    context_type: str = "self_study",
    class_id: UUID | None = None,
) -> TranscriptionResponseDTO:
    """Performs multilingual ASR on an existing student pronunciation attempt."""
    context = get_or_create_learning_context(db, user, context_type, class_id=class_id)

    # 1. Fetch attempt verifying context ownership
    attempt = db.scalar(
        select(PronunciationAttempt).where(
            PronunciationAttempt.id == attempt_id,
            PronunciationAttempt.context_id == context.id,
        )
    )
    if not attempt:
        raise IdentityError(
            404,
            "attempt_not_found",
            "Pronunciation attempt not found or not owned by the current student.",
        )

    # 2. Fetch associated activity
    activity = db.scalar(
        select(PronunciationActivity).where(
            PronunciationActivity.id == attempt.activity_id,
        )
    )
    if not activity:
        raise IdentityError(404, "activity_not_found", "Associated pronunciation activity not found.")

    # 3. Idempotency check: return existing transcription if already processed and not forced
    existing_meta = attempt.result.get("transcription_metadata") if attempt.result else None
    if attempt.transcription is not None and existing_meta and not force_retranscribe:
        words = [ASRWordDTO(**w) for w in existing_meta.get("words", [])]
        return TranscriptionResponseDTO(
            attempt_id=attempt.id,
            activity_id=activity.id,
            transcription=attempt.transcription,
            raw_transcript=existing_meta.get("raw_transcript", attempt.transcription),
            normalized_transcript=existing_meta.get("normalized_transcript", ""),
            detected_language=existing_meta.get("detected_language", activity.language),
            prompt_language=existing_meta.get("prompt_language", activity.language),
            confidence=existing_meta.get("confidence"),
            duration_ms=existing_meta.get("duration_ms", attempt.result.get("duration_ms", 0)),
            processing_time_ms=existing_meta.get("processing_time_ms", 0),
            model_id=existing_meta.get("model_id", "whisper-multilingual-v1"),
            model_version=existing_meta.get("model_version", "openai/whisper-base"),
            simulated=attempt.simulated,
            silence_detected=existing_meta.get("silence_detected", False),
            words=words,
            scoring_status=attempt.scoring_status,
            message="Existing transcription retrieved successfully.",
        )

    # 4. Resolve audio file path from private storage
    storage_filename = attempt.result.get("storage_path") if attempt.result else None
    if not storage_filename:
        file_ext = attempt.result.get("file_extension", "webm") if attempt.result else "webm"
        storage_filename = f"{attempt.id}.{file_ext}"

    storage_path = PRIVATE_STORAGE_BASE / str(context.id) / storage_filename
    if not storage_path.exists():
        # Fallback check directly in context folder
        raise IdentityError(
            404,
            "audio_file_missing",
            "Audio recording file not found in private storage.",
        )

    try:
        with open(storage_path, "rb") as f:
            audio_bytes = f.read()
    except OSError as e:
        raise IdentityError(500, "storage_read_failed", f"Failed to read audio file: {str(e)}")

    mime_type = attempt.result.get("mime_type", "audio/webm") if attempt.result else "audio/webm"
    duration_ms = int(attempt.result.get("duration_ms", 3000)) if attempt.result else 3000

    # 5. Invoke ASR engine
    recognizer = get_speech_recognizer()
    try:
        asr_result = recognizer.transcribe(
            audio_bytes=audio_bytes,
            mime_type=mime_type,
            duration_ms=duration_ms,
            prompt_text=activity.target_text,
            prompt_language=activity.language,
        )
    except ValueError as e:
        raise IdentityError(422, "asr_unsupported_language", str(e))
    except Exception as e:
        raise IdentityError(500, "asr_inference_failed", f"Speech recognition inference error: {str(e)}")

    # 6. Update attempt record
    attempt.transcription = asr_result.raw_transcript
    attempt.simulated = asr_result.simulated

    updated_result = dict(attempt.result) if attempt.result else {}
    updated_result["transcription_metadata"] = asr_result.model_dump()
    attempt.result = updated_result

    if asr_result.silence_detected:
        attempt.error_code = "silence_detected"
    else:
        attempt.error_code = None

    db.flush()

    word_dtos = [
        ASRWordDTO(
            word=w.word,
            start_time_ms=w.start_time_ms,
            end_time_ms=w.end_time_ms,
            confidence=w.confidence,
        )
        for w in asr_result.words
    ]

    msg = (
        "No speech detected in audio."
        if asr_result.silence_detected
        else "Speech transcribed successfully."
    )

    return TranscriptionResponseDTO(
        attempt_id=attempt.id,
        activity_id=activity.id,
        transcription=asr_result.raw_transcript,
        raw_transcript=asr_result.raw_transcript,
        normalized_transcript=asr_result.normalized_transcript,
        detected_language=asr_result.detected_language,
        prompt_language=asr_result.prompt_language,
        confidence=asr_result.confidence,
        duration_ms=asr_result.duration_ms,
        processing_time_ms=asr_result.processing_time_ms,
        model_id=asr_result.model_id,
        model_version=asr_result.model_version,
        simulated=asr_result.simulated,
        silence_detected=asr_result.silence_detected,
        words=word_dtos,
        scoring_status=attempt.scoring_status,
        message=msg,
    )


def get_attempt_transcription(
    db,
    user: User,
    attempt_id: UUID,
    context_type: str = "self_study",
    class_id: UUID | None = None,
) -> TranscriptionStatusDTO:
    """Retrieves current transcription status and result for an attempt."""
    context = get_or_create_learning_context(db, user, context_type, class_id=class_id)

    attempt = db.scalar(
        select(PronunciationAttempt).where(
            PronunciationAttempt.id == attempt_id,
            PronunciationAttempt.context_id == context.id,
        )
    )
    if not attempt:
        raise IdentityError(404, "attempt_not_found", "Pronunciation attempt not found.")

    meta = attempt.result.get("transcription_metadata") if attempt.result else {}
    has_transcript = attempt.transcription is not None

    status = (
        "silence_detected"
        if meta.get("silence_detected")
        else "completed"
        if has_transcript
        else "pending"
    )

    return TranscriptionStatusDTO(
        attempt_id=attempt.id,
        status=status,
        has_transcription=has_transcript,
        transcription=attempt.transcription,
        detected_language=meta.get("detected_language"),
        prompt_language=meta.get("prompt_language"),
        silence_detected=meta.get("silence_detected", False),
        simulated=attempt.simulated,
    )


# ---------------------------------------------------------------------------
# Section 34: Pronunciation Assessment Services
# ---------------------------------------------------------------------------


def get_or_create_evaluator_configuration(db) -> UUID:
    """Finds or registers the default ModelConfiguration for pronunciation assessment."""
    from app.models.research import ModelVersion, ModelConfiguration

    task = "pronunciation_evaluator"
    provider = "fluentt-internal"
    model_name = "multilingual-gop-evaluator"
    version_str = "1.0.0"

    mv = db.scalar(
        select(ModelVersion).where(
            ModelVersion.task == task,
            ModelVersion.provider == provider,
            ModelVersion.model_name == model_name,
            ModelVersion.version == version_str,
        )
    )
    if not mv:
        mv = ModelVersion(
            task=task,
            provider=provider,
            model_name=model_name,
            version=version_str,
            capabilities={
                "languages": ["tl", "en"],
                "dimensions": ["accuracy", "fluency", "completeness", "prosody"],
                "method": "GOP_MultiDimensional_v1",
            },
            artifact_reference="simulated://internal/gop-v1-reference",
            simulated=True,
        )
        db.add(mv)
        db.flush()

    mc = db.scalar(
        select(ModelConfiguration).where(
            ModelConfiguration.model_version_id == mv.id,
            ModelConfiguration.version == 1,
        )
    )
    if not mc:
        mc = ModelConfiguration(
            model_version_id=mv.id,
            version=1,
            parameters={
                "weights": {
                    "accuracy": 0.40,
                    "fluency": 0.30,
                    "completeness": 0.20,
                    "prosody": 0.10,
                },
                "rubric": "CEFR_ACTFL_Educational_v1",
            },
        )
        db.add(mc)
        db.flush()

    return mc.id


def evaluate_pronunciation_attempt(
    db,
    user: User,
    attempt_id: UUID,
    context_type: str = "self_study",
    class_id: UUID | None = None,
) -> "PronunciationAssessmentResponseDTO":
    """Performs NLP-driven pronunciation assessment on a recorded student attempt."""
    from decimal import Decimal
    from app.modules.speech.asr_engine import ASRResult, ASRWord
    from app.modules.speech.evaluator import get_pronunciation_evaluator
    from app.modules.speech.schemas import (
        PhonemeAssessmentSchemaDTO,
        WordAssessmentSchemaDTO,
        PronunciationAssessmentDTO,
        PronunciationAssessmentResponseDTO,
    )

    context = get_or_create_learning_context(db, user, context_type, class_id=class_id)

    # 1. Fetch attempt verifying ownership
    attempt = db.scalar(
        select(PronunciationAttempt).where(
            PronunciationAttempt.id == attempt_id,
            PronunciationAttempt.context_id == context.id,
        )
    )
    if not attempt:
        raise IdentityError(404, "attempt_not_found", "Pronunciation attempt not found.")

    # 2. Fetch activity
    activity = db.scalar(
        select(PronunciationActivity).where(
            PronunciationActivity.id == attempt.activity_id,
        )
    )
    if not activity:
        raise IdentityError(404, "activity_not_found", "Pronunciation activity not found.")

    # 3. Ensure ASR transcription exists
    if attempt.transcription is None:
        transcribe_pronunciation_attempt(
            db,
            user=user,
            attempt_id=attempt.id,
            context_type=context_type,
            class_id=class_id,
        )
        db.refresh(attempt)

    meta = attempt.result.get("transcription_metadata", {}) if attempt.result else {}
    duration_ms = int(attempt.result.get("duration_ms", 3000)) if attempt.result else 3000

    # 4. Handle Silence / No Speech explicitly
    if meta.get("silence_detected") or not (attempt.transcription or "").strip():
        # Preserves constraint: scoring_status != 'scored' and score IS NULL
        attempt.scoring_status = "unsupported"
        attempt.score = None
        attempt.feedback = "No speech detected to evaluate. Please check microphone."
        db.flush()

        return PronunciationAssessmentResponseDTO(
            attempt_id=attempt.id,
            activity_id=activity.id,
            scoring_status="unsupported",
            score=None,
            feedback=attempt.feedback,
            assessment=None,
            transcription=attempt.transcription,
            evaluator_configuration_id=None,
            simulated=attempt.simulated,
            message="No speech detected in recording. Evaluation could not be performed.",
        )

    # 5. Reconstruct ASR result for evaluator
    words_data = meta.get("words", [])
    asr_words = [
        ASRWord(
            word=w.get("word", ""),
            start_time_ms=w.get("start_time_ms", 0),
            end_time_ms=w.get("end_time_ms", 100),
            confidence=w.get("confidence"),
        )
        for w in words_data
    ]

    asr_result = ASRResult(
        raw_transcript=attempt.transcription,
        normalized_transcript=meta.get("normalized_transcript", attempt.transcription.lower()),
        detected_language=meta.get("detected_language", activity.language),
        prompt_language=meta.get("prompt_language", activity.language),
        confidence=meta.get("confidence", 0.90),
        duration_ms=duration_ms,
        processing_time_ms=meta.get("processing_time_ms", 50),
        model_id=meta.get("model_id", "whisper-multilingual-v1"),
        model_version=meta.get("model_version", "openai/whisper-base"),
        simulated=attempt.simulated,
        silence_detected=False,
        words=asr_words,
        language_match=meta.get("language_match", True),
        metadata=meta.get("metadata", {}),
    )

    # 6. Run Pronunciation Evaluator
    evaluator = get_pronunciation_evaluator()
    eval_result = evaluator.evaluate(
        prompt_text=activity.target_text,
        target_language=activity.language,
        asr_result=asr_result,
        audio_duration_ms=duration_ms,
    )

    # 7. Persist Assessment & Update Attempt State
    evaluator_config_id = get_or_create_evaluator_configuration(db)

    attempt.scoring_status = "scored"
    attempt.score = Decimal(str(eval_result.overall_score))
    attempt.evaluator_configuration_id = evaluator_config_id
    attempt.feedback = eval_result.summary_feedback
    attempt.simulated = eval_result.simulated

    updated_result = dict(attempt.result) if attempt.result else {}
    updated_result["assessment"] = eval_result.model_dump()
    attempt.result = updated_result
    db.flush()

    # 8. Build typed DTO
    words_dto = [
        WordAssessmentSchemaDTO(
            word=w.word,
            target_phonemes=w.target_phonemes,
            accuracy_score=w.accuracy_score,
            error_type=w.error_type,
            phonemes=[
                PhonemeAssessmentSchemaDTO(
                    phoneme=p.phoneme,
                    accuracy_score=p.accuracy_score,
                    status=p.status,
                )
                for p in w.phonemes
            ],
            tip=w.tip,
        )
        for w in eval_result.words
    ]

    assessment_dto = PronunciationAssessmentDTO(
        overall_score=eval_result.overall_score,
        accuracy_score=eval_result.accuracy_score,
        fluency_score=eval_result.fluency_score,
        completeness_score=eval_result.completeness_score,
        prosody_score=eval_result.prosody_score,
        words=words_dto,
        target_language=eval_result.target_language,
        summary_feedback=eval_result.summary_feedback,
        actionable_tips=eval_result.actionable_tips,
        model_id=eval_result.model_id,
        model_version=eval_result.model_version,
        simulated=eval_result.simulated,
        speech_rate_wpm=eval_result.speech_rate_wpm,
        confidence=eval_result.confidence,
    )

    return PronunciationAssessmentResponseDTO(
        attempt_id=attempt.id,
        activity_id=activity.id,
        scoring_status="scored",
        score=eval_result.overall_score,
        feedback=eval_result.summary_feedback,
        assessment=assessment_dto,
        transcription=attempt.transcription,
        evaluator_configuration_id=evaluator_config_id,
        simulated=eval_result.simulated,
        message="Pronunciation evaluation completed successfully.",
    )


def get_attempt_assessment(
    db,
    user: User,
    attempt_id: UUID,
    context_type: str = "self_study",
    class_id: UUID | None = None,
) -> "PronunciationAssessmentResponseDTO":
    """Retrieves existing pronunciation assessment for an attempt."""
    from app.modules.speech.schemas import (
        PhonemeAssessmentSchemaDTO,
        WordAssessmentSchemaDTO,
        PronunciationAssessmentDTO,
        PronunciationAssessmentResponseDTO,
    )

    context = get_or_create_learning_context(db, user, context_type, class_id=class_id)

    attempt = db.scalar(
        select(PronunciationAttempt).where(
            PronunciationAttempt.id == attempt_id,
            PronunciationAttempt.context_id == context.id,
        )
    )
    if not attempt:
        raise IdentityError(404, "attempt_not_found", "Pronunciation attempt not found.")

    activity = db.scalar(
        select(PronunciationActivity).where(
            PronunciationActivity.id == attempt.activity_id,
        )
    )
    if not activity:
        raise IdentityError(404, "activity_not_found", "Pronunciation activity not found.")

    raw_assess = attempt.result.get("assessment") if attempt.result else None
    if not raw_assess:
        return PronunciationAssessmentResponseDTO(
            attempt_id=attempt.id,
            activity_id=activity.id,
            scoring_status=attempt.scoring_status,
            score=float(attempt.score) if attempt.score is not None else None,
            feedback=attempt.feedback,
            assessment=None,
            transcription=attempt.transcription,
            evaluator_configuration_id=attempt.evaluator_configuration_id,
            simulated=attempt.simulated,
            message="No assessment has been computed yet for this attempt.",
        )

    words_dto = [
        WordAssessmentSchemaDTO(
            word=w.get("word", ""),
            target_phonemes=w.get("target_phonemes", []),
            accuracy_score=w.get("accuracy_score", 0.0),
            error_type=w.get("error_type", "none"),
            phonemes=[
                PhonemeAssessmentSchemaDTO(
                    phoneme=p.get("phoneme", ""),
                    accuracy_score=p.get("accuracy_score", 0.0),
                    status=p.get("status", "correct"),
                )
                for p in w.get("phonemes", [])
            ],
            tip=w.get("tip"),
        )
        for w in raw_assess.get("words", [])
    ]

    assess_dto = PronunciationAssessmentDTO(
        overall_score=raw_assess.get("overall_score", 0.0),
        accuracy_score=raw_assess.get("accuracy_score", 0.0),
        fluency_score=raw_assess.get("fluency_score", 0.0),
        completeness_score=raw_assess.get("completeness_score", 0.0),
        prosody_score=raw_assess.get("prosody_score", 0.0),
        words=words_dto,
        target_language=raw_assess.get("target_language", activity.language),
        summary_feedback=raw_assess.get("summary_feedback", ""),
        actionable_tips=raw_assess.get("actionable_tips", []),
        model_id=raw_assess.get("model_id", "fluentt-multilingual-gop-evaluator"),
        model_version=raw_assess.get("model_version", "1.0.0"),
        simulated=raw_assess.get("simulated", True),
        speech_rate_wpm=raw_assess.get("speech_rate_wpm", 0.0),
        confidence=raw_assess.get("confidence", 0.90),
    )

    return PronunciationAssessmentResponseDTO(
        attempt_id=attempt.id,
        activity_id=activity.id,
        scoring_status=attempt.scoring_status,
        score=float(attempt.score) if attempt.score is not None else None,
        feedback=attempt.feedback,
        assessment=assess_dto,
        transcription=attempt.transcription,
        evaluator_configuration_id=attempt.evaluator_configuration_id,
        simulated=attempt.simulated,
        message="Pronunciation assessment retrieved successfully.",
    )

