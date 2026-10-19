"""Pronunciation attempt lifecycle: claim barrier, dispatch marker, terminal results.

Scheduler isolation: this module never reads or writes review attempts, schedules,
current pointers, research events, or any scheduler/assignment state.
"""

import threading
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import User
from app.content.models import ContentRelease, VocabularyRevision
from app.content.provenance import resolve_review_content
from app.pronunciation import azure_adapter, converter, scoring
from app.pronunciation.models import PronunciationAttempt, PronunciationResult
from app.pronunciation.schemas import (
    ADAPTER_VERSION,
    API_CONTRACT,
    ASSESSMENT_CONFIG_VERSION,
    CAPTURE_PROFILE_VERSION,
    CATEGORY_POLICY_VERSION,
    CONVERTER_PROFILE_VERSION,
    FEEDBACK_POLICY_VERSION,
    INTEGRATION,
    PROVIDER,
    SCHEMA_VERSION,
    AssessmentContract,
    FeedbackContract,
    Issue,
    PronunciationAttemptMetadata,
    PronunciationResponse,
    ProviderMetadata,
    ReasonContract,
    TargetContract,
    TimestampsContract,
    WordObservation,
)

PROCESSING_LIFETIME_SECONDS = 60
BACKEND_BUDGET_SECONDS = 40
_INSTANCE_SLOTS = threading.BoundedSemaphore(2)

UNSCORABLE_CODES = {
    "NoMatch": "NO_MATCH",
    "InitialSilenceTimeout": "INITIAL_SILENCE",
    "BabbleTimeout": "BABBLE",
}

FAILURE_HTTP_STATUS = {
    "UNSUPPORTED_AUDIO": 415,
    "DURATION_LIMIT": 422,
    "EMPTY_RECORDING": 422,
    "AZURE_TIMEOUT": 504,
    "PROVIDER_RESPONSE_INVALID": 502,
    "CONVERTER_INTEGRATION_ERROR": 502,
}


def failure_http_status(code: str) -> int:
    return FAILURE_HTTP_STATUS.get(code, 503)


class PronunciationError(Exception):
    def __init__(self, status_code: int, code: str, category: str, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.code = code
        self.category = category
        self.detail = detail


@dataclass
class ClaimOutcome:
    kind: str  # "new" | "replay" | "processing" | "conflict" | "capacity"
    attempt: PronunciationAttempt | None
    result: PronunciationResult | None = None


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _bound_facts_match(
    attempt: PronunciationAttempt, metadata: PronunciationAttemptMetadata
) -> bool:
    return (
        attempt.content_release_id == metadata.content_release_id
        and attempt.vocabulary_item_id == metadata.vocabulary_item_id
        and attempt.content_revision_id == metadata.content_revision_id
        and attempt.target_kind == metadata.target_kind
        and attempt.original_interaction_at == metadata.original_interaction_at
        and attempt.capture_profile_version == metadata.capture_profile_version
        and attempt.device_platform == metadata.device_platform
        and attempt.application_version == metadata.application_version
    )


def resolve_pronunciation_target(
    db: Session, metadata: PronunciationAttemptMetadata
) -> tuple[VocabularyRevision, str]:
    try:
        revision = resolve_review_content(
            db,
            metadata.vocabulary_item_id,
            metadata.content_revision_id,
            metadata.content_release_id,
        )
    except HTTPException as exc:
        raise PronunciationError(
            422,
            "INVALID_TARGET",
            "USER_CORRECTABLE",
            "This practice item is unavailable.",
        ) from exc
    release = db.get(ContentRelease, metadata.content_release_id)
    if not release or release.language_code != "en":
        raise PronunciationError(
            422,
            "INVALID_TARGET",
            "USER_CORRECTABLE",
            "This practice item is unavailable.",
        )
    if release.manifest["language"]["code"] != "en":
        raise PronunciationError(
            422,
            "INVALID_TARGET",
            "USER_CORRECTABLE",
            "This practice item is unavailable.",
        )
    reference_text = (
        revision.term if metadata.target_kind == "term" else revision.example_sentence
    )
    if not reference_text or not reference_text.strip():
        raise PronunciationError(
            422,
            "INVALID_TARGET",
            "USER_CORRECTABLE",
            "This practice item is unavailable.",
        )
    return revision, reference_text


def claim_attempt(
    db: Session, user: User, metadata: PronunciationAttemptMetadata
) -> ClaimOutcome:
    existing = db.scalar(
        select(PronunciationAttempt).where(
            PronunciationAttempt.user_id == user.id,
            PronunciationAttempt.client_pronunciation_attempt_id
            == metadata.client_pronunciation_attempt_id,
        )
    )
    if existing:
        if not _bound_facts_match(existing, metadata):
            return ClaimOutcome(kind="conflict", attempt=existing)
        result = db.get(PronunciationResult, existing.id)
        if existing.status != "processing":
            return ClaimOutcome(kind="replay", attempt=existing, result=result)
        now = _utcnow()
        if existing.processing_deadline and existing.processing_deadline > now:
            return ClaimOutcome(kind="processing", attempt=existing)
        _finalize_expired(db, existing)
        db.refresh(existing)
        return ClaimOutcome(
            kind="replay",
            attempt=existing,
            result=db.get(PronunciationResult, existing.id),
        )
    _reap_owner_expired(db, user.id)
    if db.scalar(
        select(PronunciationAttempt.id).where(
            PronunciationAttempt.user_id == user.id,
            PronunciationAttempt.status == "processing",
        )
    ):
        return ClaimOutcome(kind="capacity", attempt=None)
    now = _utcnow()
    attempt = PronunciationAttempt(
        id=uuid.uuid4(),
        user_id=user.id,
        client_pronunciation_attempt_id=metadata.client_pronunciation_attempt_id,
        content_release_id=metadata.content_release_id,
        vocabulary_item_id=metadata.vocabulary_item_id,
        content_revision_id=metadata.content_revision_id,
        target_kind=metadata.target_kind,
        original_interaction_at=metadata.original_interaction_at,
        received_at=now,
        processing_started_at=now,
        status="processing",
        processing_token=uuid.uuid4(),
        processing_deadline=now + timedelta(seconds=BACKEND_BUDGET_SECONDS),
        capture_profile_version=metadata.capture_profile_version,
        device_platform=metadata.device_platform,
        application_version=metadata.application_version,
    )
    db.add(attempt)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        winner = db.scalar(
            select(PronunciationAttempt).where(
                PronunciationAttempt.user_id == user.id,
                PronunciationAttempt.client_pronunciation_attempt_id
                == metadata.client_pronunciation_attempt_id,
            )
        )
        if winner and not _bound_facts_match(winner, metadata):
            return ClaimOutcome(kind="conflict", attempt=winner)
        if winner:
            return ClaimOutcome(
                kind="processing" if winner.status == "processing" else "replay",
                attempt=winner,
                result=db.get(PronunciationResult, winner.id),
            )
        return ClaimOutcome(kind="capacity", attempt=None)
    db.refresh(attempt)
    return ClaimOutcome(kind="new", attempt=attempt)


def mark_dispatch(db: Session, attempt_id: uuid.UUID, token: uuid.UUID) -> bool:
    attempt = db.get(PronunciationAttempt, attempt_id)
    if attempt is None:
        return False
    db.refresh(attempt, with_for_update=True)
    if attempt.processing_token != token or attempt.status != "processing":
        return False
    if attempt.processing_deadline <= _utcnow():
        _finalize_expired(db, attempt)
        return False
    if attempt.provider_dispatch_started_at is not None:
        return False
    if db.get(PronunciationResult, attempt_id) is not None:
        return False
    attempt.provider_dispatch_started_at = _utcnow()
    db.commit()
    return True


def _insert_terminal_result(
    db: Session,
    attempt: PronunciationAttempt,
    *,
    status: str,
    recognition_status: str | None,
    converter_version: str | None,
    accuracy_score: Decimal | None,
    category: str | None,
    secondaries: dict[str, Decimal | None],
    word_observations: list[dict[str, Any]],
    issues: list[dict[str, Any]],
    general_feedback_key: str | None,
    selected_issue_refs: list[str],
    reason: dict[str, str] | None,
) -> tuple[PronunciationResult, bool]:
    now = _utcnow()
    scored = status == "scored"
    result = PronunciationResult(
        pronunciation_attempt_id=attempt.id,
        user_id=attempt.user_id,
        status=status,
        provider=PROVIDER,
        locale="en-US",
        assessment_config_version=ASSESSMENT_CONFIG_VERSION,
        integration=INTEGRATION,
        api_contract=API_CONTRACT,
        adapter_version=ADAPTER_VERSION,
        http_client_version=azure_adapter.http_client_version(),
        sdk_version=None,
        hosted_model_version=None,
        recognition_status=recognition_status,
        capture_profile_version=attempt.capture_profile_version,
        converter_profile_version=CONVERTER_PROFILE_VERSION,
        converter_version=converter_version,
        accuracy_score=accuracy_score,
        accuracy_score_display=scoring.display_score(accuracy_score)
        if scored
        else None,
        category=category,
        category_policy_version=CATEGORY_POLICY_VERSION if scored else None,
        pronunciation_score=secondaries.get("pronunciation"),
        completeness_score=secondaries.get("completeness"),
        fluency_score=secondaries.get("fluency"),
        word_observations=word_observations,
        issues=issues,
        general_feedback_key=general_feedback_key,
        selected_issue_refs=selected_issue_refs,
        feedback_policy_version=(
            FEEDBACK_POLICY_VERSION if general_feedback_key is not None else None
        ),
        reason_category=reason["category"] if reason else None,
        reason_code=reason["code"] if reason else None,
        reason_recovery=reason["recovery"] if reason else None,
        completed_at=now,
    )
    db.add(result)
    attempt.status = status
    attempt.completed_at = now
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        db.refresh(attempt)
        existing = db.get(PronunciationResult, attempt.id)
        if existing is None:
            raise
        return existing, False
    db.refresh(attempt)
    db.refresh(result)
    return result, True


def _guard(
    db: Session, attempt: PronunciationAttempt, token: uuid.UUID
) -> PronunciationResult | None:
    """Re-read authoritative attempt state; return an existing terminal result."""
    db.refresh(attempt, with_for_update=True)
    if attempt.processing_token != token:
        raise PronunciationError(
            409,
            "PRONUNCIATION_ATTEMPT_CONFLICT",
            "USER_CORRECTABLE",
            "Attempt claim changed",
        )
    if attempt.status != "processing":
        return db.get(PronunciationResult, attempt.id)
    if attempt.processing_deadline <= _utcnow():
        _finalize_expired(db, attempt)
        return db.get(PronunciationResult, attempt.id)
    return None


def finalize_success(
    db: Session,
    attempt: PronunciationAttempt,
    token: uuid.UUID,
    *,
    outcome: azure_adapter.ProviderOutcome,
    reference_text: str,
    converter_version: str,
) -> tuple[PronunciationResult, bool]:
    existing = _guard(db, attempt, token)
    if existing is not None:
        return existing, False
    words, sufficient = scoring.resolve_target_evidence(
        reference_text, outcome.raw_words or []
    )
    if not sufficient:
        omitted = any(word.provider_error_type == "Omission" for word in words)
        return _insert_terminal_result(
            db,
            attempt,
            status="unscorable",
            recognition_status=outcome.recognition_status,
            converter_version=converter_version,
            accuracy_score=None,
            category=None,
            secondaries={},
            word_observations=[],
            issues=[
                issue.model_dump(mode="json")
                for issue in scoring.unscorable_word_issues(words)
            ],
            general_feedback_key=scoring.UNSCORABLE_FEEDBACK_KEY,
            selected_issue_refs=[],
            reason={
                "category": "USER_CORRECTABLE",
                "code": "TARGET_OMITTED" if omitted else "TARGET_EVIDENCE_INSUFFICIENT",
                "recovery": "rerecord",
            },
        )
    category = scoring.category_for(outcome.accuracy_score)
    issues, refs = scoring.select_issues(words, scored=True)
    return _insert_terminal_result(
        db,
        attempt,
        status="scored",
        recognition_status=outcome.recognition_status,
        converter_version=converter_version,
        accuracy_score=outcome.accuracy_score,
        category=category,
        secondaries={
            "pronunciation": outcome.pronunciation_score,
            "completeness": outcome.completeness_score,
            "fluency": outcome.fluency_score,
        },
        word_observations=[word.model_dump(mode="json") for word in words],
        issues=[issue.model_dump(mode="json") for issue in issues],
        general_feedback_key=scoring.scored_feedback_key(category),
        selected_issue_refs=refs,
        reason=None,
    )


def finalize_unscorable(
    db: Session,
    attempt: PronunciationAttempt,
    token: uuid.UUID,
    *,
    recognition_status: str,
    code: str,
    words: list[Any] | None = None,
) -> tuple[PronunciationResult, bool]:
    existing = _guard(db, attempt, token)
    if existing is not None:
        return existing, False
    return _insert_terminal_result(
        db,
        attempt,
        status="unscorable",
        recognition_status=recognition_status,
        converter_version=None,
        accuracy_score=None,
        category=None,
        secondaries={},
        word_observations=[],
        issues=[],
        general_feedback_key=scoring.UNSCORABLE_FEEDBACK_KEY,
        selected_issue_refs=[],
        reason={"category": "USER_CORRECTABLE", "code": code, "recovery": "rerecord"},
    )


def finalize_failed(
    db: Session,
    attempt: PronunciationAttempt,
    token: uuid.UUID,
    *,
    code: str,
    reason_category: str,
    recovery: str,
    recognition_status: str | None = None,
    converter_version: str | None = None,
) -> tuple[PronunciationResult, bool]:
    existing = _guard(db, attempt, token)
    if existing is not None:
        return existing, False
    feedback_key = {
        "USER_CORRECTABLE": "pronunciation.errors.recorded",
        "RETRYABLE_SERVICE": "pronunciation.errors.service",
        "SERVER_CONFIGURATION": "pronunciation.errors.service",
    }[reason_category]
    return _insert_terminal_result(
        db,
        attempt,
        status="failed",
        recognition_status=recognition_status,
        converter_version=converter_version,
        accuracy_score=None,
        category=None,
        secondaries={},
        word_observations=[],
        issues=[],
        general_feedback_key=feedback_key,
        selected_issue_refs=[],
        reason={
            "category": reason_category,
            "code": code,
            "recovery": recovery,
        },
    )


def _finalize_expired(
    db: Session, attempt: PronunciationAttempt
) -> tuple[PronunciationResult, bool] | None:
    db.refresh(attempt, with_for_update=True)
    if (
        attempt.status != "processing"
        or db.get(PronunciationResult, attempt.id) is not None
    ):
        return None
    if attempt.processing_deadline is None or attempt.processing_deadline > _utcnow():
        return None
    code = (
        "PROVIDER_OUTCOME_UNKNOWN"
        if attempt.provider_dispatch_started_at is not None
        else "PROCESSING_INTERRUPTED"
    )
    return _insert_terminal_result(
        db,
        attempt,
        status="failed",
        recognition_status=None,
        converter_version=None,
        accuracy_score=None,
        category=None,
        secondaries={},
        word_observations=[],
        issues=[],
        general_feedback_key="pronunciation.errors.service",
        selected_issue_refs=[],
        reason={
            "category": "RETRYABLE_SERVICE",
            "code": code,
            "recovery": "retry_later",
        },
    )


def reap_expired_attempts(db: Session) -> int:
    now = _utcnow()
    expired = list(
        db.scalars(
            select(PronunciationAttempt).where(
                PronunciationAttempt.status == "processing",
                PronunciationAttempt.processing_deadline.is_not(None),
                PronunciationAttempt.processing_deadline <= now,
            )
        )
    )
    for attempt in expired:
        _finalize_expired(db, attempt)
    return len(expired)


def _reap_owner_expired(db: Session, user_id: uuid.UUID) -> None:
    now = _utcnow()
    expired = list(
        db.scalars(
            select(PronunciationAttempt).where(
                PronunciationAttempt.user_id == user_id,
                PronunciationAttempt.status == "processing",
                PronunciationAttempt.processing_deadline.is_not(None),
                PronunciationAttempt.processing_deadline <= now,
            )
        )
    )
    for attempt in expired:
        _finalize_expired(db, attempt)


def _load_outcome(
    db: Session, attempt: PronunciationAttempt
) -> PronunciationResult | None:
    return db.get(PronunciationResult, attempt.id)


def _pending_provider_metadata() -> ProviderMetadata:
    return ProviderMetadata(
        provider=PROVIDER,
        locale="en-US",
        assessment_config_version=ASSESSMENT_CONFIG_VERSION,
        integration=INTEGRATION,
        api_contract=API_CONTRACT,
        adapter_version=ADAPTER_VERSION,
        http_client_version=azure_adapter.http_client_version(),
        sdk_version=None,
        hosted_model_version=None,
        recognition_status=None,
        capture_profile_version=CAPTURE_PROFILE_VERSION,
        converter_profile_version=CONVERTER_PROFILE_VERSION,
        converter_version=None,
    )


def build_response(
    attempt: PronunciationAttempt,
    result: PronunciationResult | None,
    *,
    term: str,
) -> PronunciationResponse:
    target = TargetContract(
        vocabulary_item_id=attempt.vocabulary_item_id,
        content_revision_id=attempt.content_revision_id,
        content_release_id=attempt.content_release_id,
        target_kind=attempt.target_kind,  # type: ignore[arg-type]
        term=term,
    )
    timestamps = TimestampsContract(
        original_interaction_at=attempt.original_interaction_at,
        received_at=attempt.received_at,
        processing_started_at=attempt.processing_started_at,
        completed_at=attempt.completed_at,
    )
    if result is None:
        return PronunciationResponse(
            schema_version=SCHEMA_VERSION,
            status="processing",
            attempt_id=attempt.id,
            client_pronunciation_attempt_id=attempt.client_pronunciation_attempt_id,
            target=target,
            assessment=AssessmentContract(
                accuracy_score=None,
                accuracy_score_display=None,
                category=None,
                category_policy_version=None,
                pronunciation_score=None,
                completeness_score=None,
                fluency_score=None,
            ),
            word_observations=[],
            issues=[],
            feedback=FeedbackContract(
                general_feedback_key=None,
                selected_issue_refs=[],
                feedback_policy_version=None,
            ),
            provider_metadata=_pending_provider_metadata(),
            reason=None,
            timestamps=timestamps,
        )
    words = [WordObservation.model_validate(word) for word in result.word_observations]
    issues = [Issue.model_validate(issue) for issue in result.issues]
    reason = (
        ReasonContract(
            category=result.reason_category,  # type: ignore[arg-type]
            code=result.reason_code,
            recovery=result.reason_recovery,  # type: ignore[arg-type]
        )
        if result.reason_category
        else None
    )
    return PronunciationResponse(
        schema_version=SCHEMA_VERSION,
        status=result.status,  # type: ignore[arg-type]
        attempt_id=attempt.id,
        client_pronunciation_attempt_id=attempt.client_pronunciation_attempt_id,
        target=target,
        assessment=AssessmentContract(
            accuracy_score=result.accuracy_score,
            accuracy_score_display=result.accuracy_score_display,
            category=result.category,  # type: ignore[arg-type]
            category_policy_version=result.category_policy_version,
            pronunciation_score=result.pronunciation_score,
            completeness_score=result.completeness_score,
            fluency_score=result.fluency_score,
        ),
        word_observations=words,
        issues=issues,
        feedback=FeedbackContract(
            general_feedback_key=result.general_feedback_key,
            selected_issue_refs=list(result.selected_issue_refs),
            feedback_policy_version=result.feedback_policy_version,
        ),
        provider_metadata=ProviderMetadata(
            provider=result.provider,
            locale=result.locale,
            assessment_config_version=result.assessment_config_version,
            integration=result.integration,
            api_contract=result.api_contract,
            adapter_version=result.adapter_version,
            http_client_version=result.http_client_version,
            sdk_version=result.sdk_version,
            hosted_model_version=result.hosted_model_version,
            recognition_status=result.recognition_status,
            capture_profile_version=result.capture_profile_version,
            converter_profile_version=result.converter_profile_version,
            converter_version=result.converter_version,
        ),
        reason=reason,
        timestamps=timestamps,
    )


def process_attempt(
    db: Session,
    user: User,
    metadata: PronunciationAttemptMetadata,
    audio_bytes: bytes,
    *,
    ffmpeg_path: str,
    ffprobe_path: str,
    azure_endpoint: str,
    azure_key: str,
    azure_region: str,
    temp_root: str | None = None,
    http_client: Any = None,
) -> tuple[str, int, PronunciationResponse]:
    """Full pipeline: claim -> convert -> dispatch -> Azure -> terminal result.

    Returns (kind, http_status, response); kind is "processing"|"replay"|
    "conflict"|"capacity"|"new_terminal".
    """
    _, reference_text = resolve_pronunciation_target(db, metadata)
    if not _INSTANCE_SLOTS.acquire(blocking=False):
        raise PronunciationError(
            503,
            "CAPACITY_UNAVAILABLE",
            "RETRYABLE_SERVICE",
            "Backend pronunciation capacity exhausted",
        )
    try:
        claim = claim_attempt(db, user, metadata)
    except BaseException:
        _INSTANCE_SLOTS.release()
        raise
    if claim.kind == "conflict":
        _INSTANCE_SLOTS.release()
        raise PronunciationError(
            409,
            "PRONUNCIATION_ATTEMPT_CONFLICT",
            "USER_CORRECTABLE",
            "Pronunciation attempt identity conflicts with a different target",
        )
    if claim.kind == "capacity":
        _INSTANCE_SLOTS.release()
        raise PronunciationError(
            503,
            "CAPACITY_UNAVAILABLE",
            "RETRYABLE_SERVICE",
            "Another pronunciation attempt is still processing for this account",
        )
    if claim.kind == "replay":
        _INSTANCE_SLOTS.release()
        response = build_response(claim.attempt, claim.result, term=reference_text)
        status = 200 if claim.result is not None else 202
        return "replay", status, response
    if claim.kind == "processing":
        _INSTANCE_SLOTS.release()
        response = build_response(claim.attempt, None, term=reference_text)
        return "processing", 202, response

    attempt = claim.attempt
    if attempt is None or attempt.processing_token is None:
        _INSTANCE_SLOTS.release()
        raise PronunciationError(
            503,
            "CAPACITY_UNAVAILABLE",
            "RETRYABLE_SERVICE",
            "Pronunciation claim could not be reserved",
        )
    token = attempt.processing_token
    try:
        try:
            conversion = converter.convert_to_wav(
                audio_bytes,
                ffmpeg_path=ffmpeg_path,
                ffprobe_path=ffprobe_path,
                workspace_root=temp_root or None,
            )
        except converter.UnsupportedAudio:
            _, inserted = finalize_failed(
                db,
                attempt,
                token,
                code="UNSUPPORTED_AUDIO",
                reason_category="USER_CORRECTABLE",
                recovery="rerecord",
            )
            return _terminal_response(db, attempt, reference_text, inserted)
        except converter.DurationLimitExceeded:
            _, inserted = finalize_failed(
                db,
                attempt,
                token,
                code="DURATION_LIMIT",
                reason_category="USER_CORRECTABLE",
                recovery="rerecord",
            )
            return _terminal_response(db, attempt, reference_text, inserted)
        except converter.ConverterUnavailable:
            _, inserted = finalize_failed(
                db,
                attempt,
                token,
                code="CONVERTER_UNAVAILABLE",
                reason_category="SERVER_CONFIGURATION",
                recovery="operator_action",
                converter_version=None,
            )
            return _terminal_response(db, attempt, reference_text, inserted)
        if not mark_dispatch(db, attempt.id, token):
            db.refresh(attempt)
            result = _load_outcome(db, attempt)
            response = build_response(attempt, result, term=reference_text)
            status = 200 if result is not None else 202
            return "replay", status, response
        try:
            outcome = azure_adapter.assess_utterance(
                conversion.wav_bytes,
                reference_text=reference_text,
                endpoint=azure_endpoint,
                key=azure_key,
                region=azure_region,
                client=http_client,
            )
        except azure_adapter.ProviderConfigurationError as exc:
            _, inserted = finalize_failed(
                db,
                attempt,
                token,
                code=str(exc),
                reason_category="SERVER_CONFIGURATION",
                recovery="operator_action",
                converter_version=conversion.converter_version,
            )
            return _terminal_response(db, attempt, reference_text, inserted)
        except azure_adapter.ProviderUnavailable as exc:
            _, inserted = finalize_failed(
                db,
                attempt,
                token,
                code=str(exc),
                reason_category="RETRYABLE_SERVICE",
                recovery="retry_later",
                converter_version=conversion.converter_version,
            )
            return _terminal_response(db, attempt, reference_text, inserted)
        except scoring.ProviderResponseInvalid:
            _, inserted = finalize_failed(
                db,
                attempt,
                token,
                code="PROVIDER_RESPONSE_INVALID",
                reason_category="SERVER_CONFIGURATION",
                recovery="operator_action",
                converter_version=conversion.converter_version,
            )
            return _terminal_response(db, attempt, reference_text, inserted)
        db.refresh(attempt)
        if outcome.kind == "unscorable":
            _, inserted = finalize_unscorable(
                db,
                attempt,
                token,
                recognition_status=outcome.recognition_status,
                code=UNSCORABLE_CODES.get(outcome.recognition_status, "NO_MATCH"),
            )
            return _terminal_response(db, attempt, reference_text, inserted)
        if outcome.kind == "failed":
            _, inserted = finalize_failed(
                db,
                attempt,
                token,
                code=outcome.error_code or "PROVIDER_RESPONSE_INVALID",
                reason_category=outcome.error_category or "SERVER_CONFIGURATION",
                recovery=(
                    "retry_later"
                    if outcome.error_category == "RETRYABLE_SERVICE"
                    else "operator_action"
                ),
                recognition_status=outcome.recognition_status,
                converter_version=conversion.converter_version,
            )
            return _terminal_response(db, attempt, reference_text, inserted)
        _, inserted = finalize_success(
            db,
            attempt,
            token,
            outcome=outcome,
            reference_text=reference_text,
            converter_version=conversion.converter_version,
        )
        return _terminal_response(db, attempt, reference_text, inserted)
    finally:
        _INSTANCE_SLOTS.release()


def _terminal_response(
    db: Session,
    attempt: PronunciationAttempt,
    reference_text: str,
    inserted: bool,
) -> tuple[str, int, PronunciationResponse]:
    db.refresh(attempt)
    result = _load_outcome(db, attempt)
    response = build_response(attempt, result, term=reference_text)
    if result is None:
        return "processing", 202, response
    if not inserted:
        return "replay", 200, response
    if result.status == "failed":
        status = failure_http_status(result.reason_code or "")
        return "failed", status, response
    return "new_terminal", 201, response


def get_attempt_response(
    db: Session, user: User, client_attempt_id: uuid.UUID
) -> PronunciationResponse:
    attempt = db.scalar(
        select(PronunciationAttempt).where(
            PronunciationAttempt.user_id == user.id,
            PronunciationAttempt.client_pronunciation_attempt_id == client_attempt_id,
        )
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Pronunciation attempt not found")
    result = _load_outcome(db, attempt)
    return build_response(attempt, result, term=attempt_reference_term(db, attempt))


def attempt_reference_term(db: Session, attempt: PronunciationAttempt) -> str:
    revision = db.get(VocabularyRevision, attempt.content_revision_id)
    if not revision:
        return ""
    return revision.term if attempt.target_kind == "term" else revision.example_sentence
