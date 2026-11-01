"""Compatibility reads for retained legacy speech records; no simulated inference."""
from uuid import UUID
from sqlalchemy import select
from app.models.ai import PronunciationActivity, PronunciationAttempt
from app.models.users import User
from app.modules.identity.errors import IdentityError
from app.modules.spaced_repetition.service import get_or_create_learning_context
from app.modules.speech.schemas import TranscriptionStatusDTO, PronunciationAssessmentResponseDTO


def _owned_attempt(db, user, attempt_id, context_type, class_id):
    context = get_or_create_learning_context(db, user, context_type, class_id=class_id)
    attempt = db.scalar(select(PronunciationAttempt).where(
        PronunciationAttempt.id == attempt_id, PronunciationAttempt.context_id == context.id))
    if not attempt:
        raise IdentityError(404, "attempt_not_found", "Pronunciation attempt not found.")
    return attempt


def transcribe_pronunciation_attempt(db, user: User, attempt_id: UUID,
                                    force_retranscribe=False, context_type="self_study", class_id=None):
    """Legacy ASR copied reference text; never execute it, even for a forced retry."""
    _owned_attempt(db, user, attempt_id, context_type, class_id)
    raise IdentityError(409, "legacy_speech_unavailable",
                        "Legacy transcription is unavailable. Record again using Tagalog MMS with explicit consent.")


def get_attempt_transcription(db, user: User, attempt_id: UUID,
                              context_type="self_study", class_id=None):
    attempt = _owned_attempt(db, user, attempt_id, context_type, class_id)
    # Do not present the old prompt-copying recognizer as recognized speech.
    transcript = None if attempt.simulated else attempt.transcription
    return TranscriptionStatusDTO(
        attempt_id=attempt.id, status="completed" if transcript else "unavailable",
        has_transcription=bool(transcript), transcription=transcript,
        detected_language=None, prompt_language=None, silence_detected=False,
        simulated=attempt.simulated,
    )


def evaluate_pronunciation_attempt(db, user: User, attempt_id: UUID,
                                   context_type="self_study", class_id=None):
    """A compatible, read-only unavailable response; never rate a transcript."""
    return get_attempt_assessment(db, user, attempt_id, context_type, class_id)


def get_attempt_assessment(db, user: User, attempt_id: UUID,
                           context_type="self_study", class_id=None):
    attempt = _owned_attempt(db, user, attempt_id, context_type, class_id)
    activity = db.scalar(select(PronunciationActivity).where(PronunciationActivity.id == attempt.activity_id))
    if not activity:
        raise IdentityError(404, "activity_not_found", "Pronunciation activity not found.")
    return PronunciationAssessmentResponseDTO(
        attempt_id=attempt.id, activity_id=activity.id, scoring_status="unsupported",
        score=None, assessment=None, feedback="Pronunciation scoring is unavailable on the legacy interface.",
        transcription=None if attempt.simulated else attempt.transcription,
        evaluator_configuration_id=None, simulated=attempt.simulated,
        pronunciation_scoring="unavailable",
        message="Use English WavLM model history or Tagalog MMS transcription. No legacy rating is returned.",
    )


# Historical model registration helper retained for compatibility; no runtime scoring calls it.
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

