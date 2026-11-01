"""Authorized Tagalog transcription, immutable provenance, NULL pronunciation scores."""
from datetime import datetime, timezone
import hashlib
import json

from sqlalchemy import select, func, text
from app.models.ai import PronunciationActivity, PronunciationAttempt
from app.models.research import ModelVersion, ModelConfiguration
from app.modules.identity.errors import IdentityError
from app.modules.assignments.service import lesson_path
from . import wavlm_service as shared
from .service import validate_audio_file
from .wavlm_contract import MAX_BYTES
from .mms_contract import CONSENT, CONTRACT, MODEL_ID, REVISION, Prediction, Transcription, reference, compare
from .mms_runtime import runtime, prepared


def fail(status, code, message):
    return IdentityError(status, "mms_" + code, message)


def capabilities(settings, language):
    selected = True
    if language == "tagalog" and settings.pronunciation_mms_enabled and settings.pronunciation_mms_noncommercial_acknowledged:
        selected = runtime.select()
    reason = "language_unsupported" if language != "tagalog" else prepared(settings)
    if not selected:
        reason = "busy"
    configuration = (settings.pronunciation_mms_python, settings.pronunciation_mms_cache, settings.pronunciation_mms_device)
    if (selected and language == "tagalog" and settings.pronunciation_mms_enabled
            and settings.pronunciation_mms_noncommercial_acknowledged
            and runtime.loaded and runtime.process and runtime.process.poll() is None
            and runtime.configuration == configuration):
        reason = "ready"
    return {
        "available": reason == "ready", "reason": reason, "model_id": MODEL_ID, "model_version": REVISION,
        "consent_version": CONSENT, "maximum_duration_ms": 30000, "loaded": runtime.loaded,
        "server_side": True, "validation_status": "unvalidated_asr_prediction",
        "adapter": "tgl", "pronunciation_scoring": "unavailable",
    }


def activity_reference(db, activity_id, version, classroom):
    activity = db.scalar(select(PronunciationActivity).where(
        PronunciationActivity.id == activity_id, PronunciationActivity.status == "published",
    ).with_for_update(read=True).execution_options(populate_existing=True))
    if not activity:
        raise fail(404, "activity_unavailable", "The published phrase is unavailable.")
    if activity.version != version:
        raise fail(409, "activity_changed", "The phrase changed. Reload before recording.")
    if activity.language != "tagalog":
        raise fail(422, "language_unsupported", "MMS transcription here supports Tagalog only. Use WavLM for English.")
    if classroom and (classroom.language != "tagalog" or (
            activity.lesson_id and not lesson_path(db, classroom, activity.lesson_id))):
        raise fail(404, "activity_unavailable", "The phrase is not eligible for this classroom.")
    try:
        original, _ = reference(activity.target_text)
    except ValueError:
        raise fail(422, "reference_unsupported", "Use a supported Latin-script Tagalog phrase of 1–60 words.") from None
    return activity, original


def replay(db, context, key, fingerprint):
    existing = db.get(PronunciationAttempt, key, populate_existing=True)
    if existing:
        if not context or existing.context_id != context.id or existing.result.get("mms_fingerprint") != fingerprint:
            raise fail(409, "request_conflict", "This recording request identifier was already used. Refresh history.")
        return Transcription.model_validate_json(json.dumps(existing.result["mms"]))
    return None


def model_configuration(db):
    db.execute(text("SELECT pg_advisory_xact_lock(78090032)"))
    model = db.scalar(select(ModelVersion).where(
        ModelVersion.task == "speech_recognition", ModelVersion.provider == "local-mms",
        ModelVersion.model_name == MODEL_ID, ModelVersion.version == REVISION,
    ))
    if model is None:
        model = ModelVersion(task="speech_recognition", provider="local-mms", model_name=MODEL_ID,
            version=REVISION, simulated=False, artifact_reference=f"hf://{MODEL_ID}@{REVISION}",
            capabilities={"languages": ["tagalog"], "adapter": "tgl", "contract": CONTRACT,
                          "pronunciation_scoring": "unavailable", "license": "CC-BY-NC-4.0"})
        db.add(model)
        db.flush()
    config = db.scalar(select(ModelConfiguration).where(
        ModelConfiguration.model_version_id == model.id, ModelConfiguration.version == 1))
    if config is None:
        config = ModelConfiguration(model_version_id=model.id, version=1,
            parameters={"contract": CONTRACT, "adapter": "tgl", "decoding": "ctc-greedy", "confidence": "unavailable"})
        db.add(config)
        db.flush()
    return config.id


def assess(repo, token, settings, *, activity_id, activity_version, audio, key, consent_version, class_id=None):
    if consent_version != CONSENT:
        raise fail(422, "permission_required", "Explicit permission to process audio and save transcription is required.")
    fingerprint = hashlib.sha256(audio + json.dumps([str(activity_id), activity_version, str(class_id), CONSENT]).encode()).hexdigest()
    with shared.access(repo, token, settings, class_id) as (db, user, classroom):
        _, expected = activity_reference(db, activity_id, activity_version, classroom)
        prior = replay(db, shared.own_context(db, user, classroom), key, fingerprint)
        if prior:
            return prior
        if not 100 <= len(audio) <= MAX_BYTES:
            raise fail(422, "audio_invalid", "Upload a complete recording no larger than 10 MiB.")
        validate_audio_file(audio, None)
        saved_reference = expected
    raw = runtime.assess(settings, audio, saved_reference)
    try:
        prediction = Prediction.model_validate(raw)
        comparison = compare(saved_reference, prediction.transcript)
    except ValueError:
        raise fail(502, "result_invalid", "No usable Tagalog transcript was returned. No result was saved.") from None
    with shared.access(repo, token, settings, class_id) as (db, user, classroom):
        _, expected = activity_reference(db, activity_id, activity_version, classroom)
        if expected != saved_reference:
            raise fail(409, "activity_changed", "The phrase changed during transcription. No result was saved.")
        context = shared.own_context(db, user, classroom, True)
        prior = replay(db, context, key, fingerprint)
        if prior:
            return prior
        number = 1 + db.scalar(select(func.count()).select_from(PronunciationAttempt).where(
            PronunciationAttempt.context_id == context.id, PronunciationAttempt.activity_id == activity_id,
            PronunciationAttempt.result.has_key("mms")))
        now = datetime.now(timezone.utc)
        result = Transcription(**prediction.model_dump(), assessment_id=key, activity_id=activity_id,
            activity_version=activity_version, expected_text=expected, comparison=comparison,
            attempted_at=now, attempt_number=number)
        db.add(PronunciationAttempt(id=key, context_id=context.id, activity_id=activity_id, attempted_at=now,
            scoring_status="unscored", score=None, evaluator_configuration_id=None,
            asr_configuration_id=model_configuration(db), transcription=result.transcript, feedback=result.feedback,
            simulated=False, result={"mms": result.model_dump(mode="json"), "mms_fingerprint": fingerprint,
                "duration_ms": result.duration_ms, "file_size_bytes": len(audio),
                "language": "tagalog", "mime_type": "audio/normalized-wav", "raw_audio_retained": False}))
        db.flush()
        return result


def history(repo, token, settings, *, activity_id=None, class_id=None, offset=0, limit=20):
    with shared.access(repo, token, settings, class_id) as (db, user, classroom):
        context = shared.own_context(db, user, classroom)
        if not context:
            return []
        query = select(PronunciationAttempt).where(PronunciationAttempt.context_id == context.id,
            PronunciationAttempt.result.has_key("mms"), PronunciationAttempt.scoring_status == "unscored")
        if activity_id:
            query = query.where(PronunciationAttempt.activity_id == activity_id)
        return [Transcription.model_validate_json(json.dumps(row.result["mms"])) for row in db.scalars(
            query.order_by(PronunciationAttempt.attempted_at.desc(), PronunciationAttempt.id.desc()).offset(offset).limit(limit))]
