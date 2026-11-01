"""Opt-in genuine local acoustic assessment; successful results only, no retained audio."""

from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json

from sqlalchemy import select, func, text

from app.models.ai import PronunciationActivity, PronunciationAttempt
from app.models.learning import LearningContext
from app.models.research import ModelVersion, ModelConfiguration
from app.models.research_classrooms import ResearchClassroomBinding
from app.modules.assignments.publication import student_context
from app.modules.assignments.service import lesson_path
from app.modules.identity.errors import IdentityError
from app.modules.identity.session_service import authenticated_session
from .service import validate_audio_file
from .wavlm_contract import CONSENT, CONTRACT, MODEL_ID, REVISION, MAX_BYTES, Score, prediction, reference
from .wavlm_runtime import runtime, prepared


def fail(status, code, message):
    return IdentityError(status, "wavlm_" + code, message)


def require_student(user):
    if user.role not in {"personal_student", "school_student"} or user.profile_status != "active":
        raise fail(403, "student_required", "An active student session is required.")


@contextmanager
def access(repo, token, settings, class_id=None):
    if class_id:
        with student_context(repo, token, settings, class_id=class_id) as (db, user, classroom):
            require_student(user)
            if db.scalar(
                select(ResearchClassroomBinding.id).where(ResearchClassroomBinding.class_id == class_id).limit(1)
            ):
                raise fail(403, "research_blocked", "This scoring flow does not collect research outcomes.")
            yield db, user, classroom
    else:
        with authenticated_session(repo, token, settings) as (_, user):
            require_student(user)
            repo.session.execute(text("SELECT pg_advisory_xact_lock_shared(78090001)"))
            yield repo.session, user, None


def capabilities(settings, language):
    selected = True
    if language == "english" and settings.pronunciation_wavlm_enabled:
        selected = runtime.select()
    reason = "language_unsupported" if language != "english" else prepared(settings)
    if not selected:
        reason = "busy"
    if (
        language == "english"
        and selected
        and settings.pronunciation_wavlm_enabled
        and runtime.loaded
        and runtime.process
        and runtime.process.poll() is None
    ):
        if runtime.configuration == (
            settings.pronunciation_wavlm_python,
            settings.pronunciation_wavlm_cache,
            settings.pronunciation_wavlm_device,
        ):
            reason = "ready"
    return {
        "available": reason == "ready",
        "reason": reason,
        "model_id": MODEL_ID,
        "model_version": REVISION,
        "consent_version": CONSENT,
        "maximum_duration_ms": 30000,
        "loaded": runtime.loaded,
        "server_side": True,
        "validation_status": "unvalidated_model_prediction",
    }


def activity_reference(db, activity_id, version, classroom):
    activity = db.scalar(
        select(PronunciationActivity)
        .where(PronunciationActivity.id == activity_id, PronunciationActivity.status == "published")
        .with_for_update(read=True)
        .execution_options(populate_existing=True)
    )
    if not activity:
        raise fail(404, "activity_unavailable", "The published pronunciation activity is unavailable.")
    if activity.version != version:
        raise fail(409, "activity_changed", "This phrase changed. Reload before recording again.")
    if activity.language != "english":
        raise fail(422, "language_unsupported", "This acoustic model supports English only. Tagalog is unscored.")
    if classroom and (
        classroom.language != "english" or (activity.lesson_id and not lesson_path(db, classroom, activity.lesson_id))
    ):
        raise fail(404, "activity_unavailable", "The phrase is not eligible for this classroom.")
    try:
        expected, _ = reference(activity.target_text)
    except ValueError:
        raise fail(
            422, "reference_unsupported", "This reference is not supported by the English phoneme model."
        ) from None
    return activity, expected


def own_context(db, user, classroom, create=False):
    kind = "classroom" if classroom else "personal"
    statement = select(LearningContext).where(LearningContext.student_id == user.id, LearningContext.kind == kind)
    if classroom:
        statement = statement.where(LearningContext.class_id == classroom.id)
    context = db.scalar(statement)
    if context is None and create:
        context = LearningContext(student_id=user.id, kind=kind, class_id=classroom.id if classroom else None)
        db.add(context)
        db.flush()
    return context


def replay(db, context, key, fingerprint):
    existing = db.get(PronunciationAttempt, key, populate_existing=True)
    if existing:
        if not context or existing.context_id != context.id or existing.result.get("wavlm_fingerprint") != fingerprint:
            raise fail(409, "request_conflict", "This recording request identifier was already used. Refresh history.")
        return Score.model_validate_json(json.dumps(existing.result["wavlm"]))
    return None


def model_configuration(db):
    # Separate registration lock; no scheduler/model configurations are rewritten.
    db.execute(text("SELECT pg_advisory_xact_lock(78090032)"))
    model = db.scalar(
        select(ModelVersion).where(
            ModelVersion.task == "pronunciation_evaluator",
            ModelVersion.provider == "local-wavlm",
            ModelVersion.model_name == MODEL_ID,
            ModelVersion.version == REVISION,
        )
    )
    if model is None:
        model = ModelVersion(
            task="pronunciation_evaluator",
            provider="local-wavlm",
            model_name=MODEL_ID,
            version=REVISION,
            simulated=False,
            artifact_reference=f"hf://{MODEL_ID}@{REVISION}/wavlm_finetuned.pt",
            capabilities={
                "languages": ["english"],
                "contract": CONTRACT,
                "validation_status": "unvalidated_model_prediction",
            },
        )
        db.add(model)
        db.flush()
    config = db.scalar(
        select(ModelConfiguration).where(
            ModelConfiguration.model_version_id == model.id, ModelConfiguration.version == 1
        )
    )
    if config is None:
        config = ModelConfiguration(
            model_version_id=model.id,
            version=1,
            parameters={
                "contract": CONTRACT,
                "phoneme_error_threshold": 0.70,
                "score_policy": "upstream-phoneme-mean",
                "adapter": "strict-alignment-v1",
            },
        )
        db.add(config)
        db.flush()
    return config.id


def assess(repo, token, settings, *, activity_id, activity_version, audio, key, consent_version, class_id=None):
    if consent_version != CONSENT:
        raise fail(
            422,
            "permission_required",
            "Explicit permission to process this recording and save model feedback is required.",
        )
    fingerprint = hashlib.sha256(
        audio + json.dumps([str(activity_id), activity_version, str(class_id), CONSENT]).encode()
    ).hexdigest()
    # Authorize before inference, release DB locks during heavy computation, then revalidate before saving/returning.
    with access(repo, token, settings, class_id) as (db, user, classroom):
        activity, expected = activity_reference(db, activity_id, activity_version, classroom)
        prior = replay(db, own_context(db, user, classroom), key, fingerprint)
        if prior:
            return prior
        if not 100 <= len(audio) <= MAX_BYTES:
            raise fail(422, "audio_invalid", "Upload a complete recording no larger than 10 MiB.")
        validate_audio_file(audio, None)
        saved_reference = expected
    raw = runtime.assess(settings, audio, saved_reference)
    try:
        result = prediction(raw, saved_reference)
    except ValueError:
        raise fail(
            502, "result_invalid", "The model could not align the complete phrase. No score was saved."
        ) from None
    with access(repo, token, settings, class_id) as (db, user, classroom):
        activity, expected = activity_reference(db, activity_id, activity_version, classroom)
        if expected != saved_reference:
            raise fail(409, "activity_changed", "The phrase changed during assessment. No score was saved.")
        context = own_context(db, user, classroom, True)
        prior = replay(db, context, key, fingerprint)
        if prior:
            return prior
        number = 1 + db.scalar(
            select(func.count())
            .select_from(PronunciationAttempt)
            .where(
                PronunciationAttempt.context_id == context.id,
                PronunciationAttempt.activity_id == activity_id,
                PronunciationAttempt.result["wavlm"].is_not(None),
                PronunciationAttempt.result.has_key("wavlm"),
            )
        )
        now = datetime.now(timezone.utc)
        score = Score(
            **result.model_dump(),
            assessment_id=key,
            activity_id=activity_id,
            activity_version=activity_version,
            expected_text=expected,
            attempted_at=now,
            attempt_number=number,
        )
        config_id = model_configuration(db)
        attempt = PronunciationAttempt(
            id=key,
            context_id=context.id,
            activity_id=activity_id,
            attempted_at=now,
            scoring_status="scored",
            score=Decimal(str(score.overall_score)),
            feedback=score.feedback,
            evaluator_configuration_id=config_id,
            simulated=False,
            result={
                "wavlm": score.model_dump(mode="json"),
                "wavlm_fingerprint": fingerprint,
                "duration_ms": score.duration_ms,
                "file_size_bytes": len(audio),
                "mime_type": "audio/normalized-wav",
                "language": "english",
                "raw_audio_retained": False,
            },
        )
        db.add(attempt)
        db.flush()
        return score


def history(repo, token, settings, *, activity_id=None, class_id=None, offset=0, limit=20):
    with access(repo, token, settings, class_id) as (db, user, classroom):
        context = own_context(db, user, classroom)
        if not context:
            return []
        query = select(PronunciationAttempt).where(
            PronunciationAttempt.context_id == context.id,
            PronunciationAttempt.result.has_key("wavlm"),
            PronunciationAttempt.scoring_status == "scored",
        )
        if activity_id:
            query = query.where(PronunciationAttempt.activity_id == activity_id)
        return [
            Score.model_validate_json(json.dumps(row.result["wavlm"]))
            for row in db.scalars(
                query.order_by(PronunciationAttempt.attempted_at.desc(), PronunciationAttempt.id.desc())
                .offset(offset)
                .limit(limit)
            )
        ]


def protect_result(db, user, attempt_id):
    row = db.scalar(
        select(PronunciationAttempt)
        .join(LearningContext)
        .where(PronunciationAttempt.id == attempt_id, LearningContext.student_id == user.id)
    )
    if row and ("wavlm" in row.result or "mms" in row.result):
        raise fail(
            409, "result_retained", "Local speech results are retained unchanged. Use a new recording or model history."
        )


def classroom_attempts(repo, token, settings, class_id, offset=0, limit=20):
    from app.modules.monitoring.service import authorized
    from sqlalchemy.exc import DBAPIError

    try:
        with authorized(repo, token, settings, class_id=class_id) as (db, _, classroom, students):
            if db.scalar(
                select(ResearchClassroomBinding.id).where(ResearchClassroomBinding.class_id == class_id).limit(1)
            ):
                raise fail(
                    403, "research_blocked", "Research outcomes are unavailable through ordinary classroom monitoring."
                )
            names = {student.id: student.username for student in students}
            rows = db.execute(
                select(PronunciationAttempt, LearningContext.student_id)
                .join(LearningContext)
                .where(
                    LearningContext.kind == "classroom",
                    LearningContext.class_id == classroom.id,
                    LearningContext.student_id.in_(names),
                    PronunciationAttempt.result.has_key("wavlm"),
                    PronunciationAttempt.scoring_status == "scored",
                )
                .order_by(PronunciationAttempt.attempted_at.desc(), PronunciationAttempt.id.desc())
                .offset(offset)
                .limit(limit + 1)
            ).all()
            return {
                "items": [
                    {
                        "assessment_id": str(row.id),
                        "student_id": str(student_id),
                        "username": names[student_id],
                        "activity_id": str(row.activity_id),
                        "overall_score": float(row.score),
                        "attempted_at": row.attempted_at.isoformat(),
                        "model_version": row.result["wavlm"]["model_version"],
                        "validation_status": "unvalidated_model_prediction",
                    }
                    for row, student_id in rows[:limit]
                ],
                "offset": offset,
                "has_more": len(rows) > limit,
                "scope": "current-eligible-ordinary-classroom",
                "metric_version": CONTRACT,
            }
    except DBAPIError:
        raise fail(409, "classroom_busy", "Class access is being updated. Refresh and retry.") from None
