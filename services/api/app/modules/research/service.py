"""Service layer for research participant lifecycle, consent verification, and privacy isolation."""

from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import random
import re
import secrets
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models.learning import LearningContext
from app.models.operations import AuditLog
from app.models.research import (
    ResearchAssessment,
    ResearchAssessmentResult,
    ResearchConsentRecord,
    ResearchEvent,
    ResearchGroup,
    ResearchGroupAssignment,
    ResearchIdentityLink,
    ResearchLevel,
    ResearchParticipant,
    ResearchStudy,
    SchedulerConfiguration,
)
from app.models.users import User
from app.modules.administration.service import resolve_session
from app.modules.identity.errors import IdentityError
from app.modules.research.schemas import (
    AdminAssessmentResultRowDTO,
    AdminIdentityRevealDTO,
    AdminParticipantViewDTO,
    AdminReassignGroupRequestDTO,
    AllocateParticipantRequestDTO,
    BlindedExperimentStatusDTO,
    ConsentDocumentDTO,
    CreateStudyRequestDTO,
    EnrollmentReceiptDTO,
    EnrollmentRequestDTO,
    ETHICS_DISCLAIMER,
    GroupAllocationReceiptDTO,
    ParticipantEligibilityDTO,
    ParticipantStatusDTO,
    ResearchAssessmentDetailDTO,
    ResearchAssessmentItemDTO,
    ResearchAssessmentListItemDTO,
    ResearchGroupSummaryDTO,
    ResearchLevelDTO,
    ResearchStudyDTO,
    RETENTION_POLICY_NOTICE,
    StartAssessmentReceiptDTO,
    SubmitAssessmentReceiptDTO,
    SubmitAssessmentRequestDTO,
    WithdrawalReceiptDTO,
    WithdrawalRequestDTO,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def fail(status_code: int = 400, code: str = "research_error", message: str = "Research operation failed."):
    return IdentityError(status_code, code, message)


def seed_research_studies_if_empty(db: Session) -> list[ResearchStudy]:
    """Ensures foundational thesis studies exist in the database."""
    from app.modules.research.experiment_service import ensure_study_experiment_infrastructure

    existing = list(db.scalars(select(ResearchStudy)).all())
    if existing:
        for s in existing:
            ensure_study_experiment_infrastructure(db, s)
        return existing

    now = utcnow()
    tag_conditions = {
        "consent_document_version": "consent-tag-v1.0",
        "retention_policy_version": "research-retention-v1",
        "purpose": (
            "Evaluate learning gains and retention stability in Tagalog vocabulary and grammar using adaptive spaced "
            "repetition (SM-2 baseline vs. Enhanced Spaced Repetition with FIFAKT knowledge tracing)."
        ),
        "procedures": (
            "Participants complete pre-test assessments, daily 10-15 minute vocabulary and grammar review sessions "
            "across 5 structured curriculum levels, followed by post-test and delayed retention evaluations."
        ),
        "voluntary_nature": (
            "Participation is completely voluntary. You may decline or withdraw at any point without penalty or "
            "impact on your regular classroom standing."
        ),
        "confidentiality": (
            "All experimental data is pseudonymized using a generated research participant code. Your student account "
            "identity is stored in a separate, access-restricted database schema accessible only to authorized research personnel."
        ),
        "withdrawal_rights": (
            "You may withdraw from the study at any time through the research interface. Upon withdrawal, future "
            "experimental sessions will cease immediately. Previously collected records are retained in pseudonymized form "
            "to maintain scientific integrity and audit compliance."
        ),
        "ethics_statement": ETHICS_DISCLAIMER,
        "required_affirmation": (
            "I have read and understood the study information, voluntarily agree to participate, and understand that "
            "I may withdraw at any time."
        ),
    }

    eng_conditions = {
        "consent_document_version": "consent-eng-v1.0",
        "retention_policy_version": "research-retention-v1",
        "purpose": (
            "Evaluate pronunciation accuracy, intelligibility, and oral fluency gains in English using multimodal "
            "speech recognition and NLP-driven phonetic scoring."
        ),
        "procedures": (
            "Participants complete baseline pronunciation recordings, guided conversation modules, and targeted "
            "phonetic assessment activities across 5 structured curriculum levels."
        ),
        "voluntary_nature": (
            "Participation is completely voluntary. You may decline or withdraw at any point without penalty or "
            "impact on your regular classroom standing."
        ),
        "confidentiality": (
            "All experimental audio and transcripts are pseudonymized under an unlinked participant code. Identifying "
            "links are kept in an isolated schema protected by strict research administration permissions."
        ),
        "withdrawal_rights": (
            "You may withdraw from the study at any time through the research interface. Upon withdrawal, future "
            "experimental sessions will cease immediately. Previously collected records are retained in pseudonymized form "
            "to maintain scientific integrity and audit compliance."
        ),
        "ethics_statement": ETHICS_DISCLAIMER,
        "required_affirmation": (
            "I have read and understood the study information, voluntarily agree to participate, and understand that "
            "I may withdraw at any time."
        ),
    }

    study_tag = ResearchStudy(
        code="FLUENTT-EXP-TAG-2026",
        title="FLUENTT Adaptive Learning & Spaced Repetition Evaluation (Tagalog)",
        status="active",
        target_language="tagalog",
        protocol_version="thesis-protocol-tag-v1.0",
        target_participants=30,
        conditions=tag_conditions,
    )
    study_eng = ResearchStudy(
        code="FLUENTT-EXP-ENG-2026",
        title="FLUENTT Adaptive Learning & Pronunciation Evaluation (English)",
        status="active",
        target_language="english",
        protocol_version="thesis-protocol-eng-v1.0",
        target_participants=30,
        conditions=eng_conditions,
    )
    db.add(study_tag)
    db.add(study_eng)
    db.flush()
    ensure_study_experiment_infrastructure(db, study_tag)
    ensure_study_experiment_infrastructure(db, study_eng)
    return [study_tag, study_eng]


def generate_pseudonymous_participant_code(db: Session, study: ResearchStudy) -> str:
    """Generates an opaque, cryptographically secure participant code without personal markers."""
    match = re.search(r"(TAG|ENG)", study.code)
    prefix = match.group(1) if match else "EXP"
    for _ in range(20):
        token = secrets.token_hex(3).upper()
        candidate = f"P-{prefix}-{token}"
        existing = db.scalar(
            select(ResearchParticipant.id).where(
                ResearchParticipant.study_id == study.id,
                ResearchParticipant.participant_code == candidate,
            )
        )
        if not existing:
            return candidate
    # Fallback to longer token if namespace fills up
    return f"P-{prefix}-{secrets.token_hex(5).upper()}"


def get_available_studies(db: Session, user: User, language: str | None = None) -> list[ResearchStudyDTO]:
    """Retrieves all active recruiting studies eligible for the authenticated learner."""
    seed_research_studies_if_empty(db)
    query = select(ResearchStudy).where(ResearchStudy.status.in_(["approved", "active"]))
    if language:
        query = query.where(ResearchStudy.target_language == language)
    query = query.order_by(ResearchStudy.created_at.asc())
    studies = list(db.scalars(query).all())

    results = []
    for s in studies:
        enrolled_count = db.scalar(
            select(func.count(ResearchParticipant.id)).where(
                ResearchParticipant.study_id == s.id,
                ResearchParticipant.enrollment_status.in_(["enrolled", "completed"]),
            )
        ) or 0
        withdrawn_count = db.scalar(
            select(func.count(ResearchParticipant.id)).where(
                ResearchParticipant.study_id == s.id,
                ResearchParticipant.enrollment_status == "withdrawn",
            )
        ) or 0

        dto = ResearchStudyDTO(
            id=s.id,
            code=s.code,
            title=s.title,
            status=s.status,
            target_language=s.target_language,
            protocol_version=s.protocol_version,
            target_participants=s.target_participants,
            enrolled_count=enrolled_count,
            withdrawn_count=withdrawn_count,
            starts_at=s.starts_at,
            ends_at=s.ends_at,
            conditions=s.conditions or {},
            locked_at=s.locked_at,
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        results.append(dto)
    return results


def get_study_or_fail(db: Session, study_id: UUID) -> ResearchStudy:
    seed_research_studies_if_empty(db)
    study = db.get(ResearchStudy, study_id)
    if not study:
        raise fail(404, "study_not_found", "Research study not found.")
    return study


def get_consent_document(db: Session, study_id: UUID) -> ConsentDocumentDTO:
    """Provides the full informed consent document and protocol version for review prior to enrollment."""
    study = get_study_or_fail(db, study_id)
    cond = study.conditions or {}

    return ConsentDocumentDTO(
        study_id=study.id,
        study_code=study.code,
        study_title=study.title,
        target_language=study.target_language,
        protocol_version=study.protocol_version,
        consent_document_version=cond.get("consent_document_version", f"consent-{study.code.lower()}-v1.0"),
        purpose=cond.get("purpose", f"Educational research on adaptive language learning in {study.target_language}."),
        procedures=cond.get("procedures", "Assessment and practice activities linked to the curriculum."),
        voluntary_nature=cond.get("voluntary_nature", "Participation is entirely voluntary. Withdrawal is permitted at any time."),
        confidentiality_and_pseudonymization=cond.get(
            "confidentiality",
            "Research records are pseudonymized with an unlinked participant code. Identifying mappings are restricted."
        ),
        data_retention_policy=cond.get(
            "retention_policy",
            "Pre-withdrawal records are permanently retained in tamper-evident research audit storage."
        ),
        withdrawal_rights=cond.get("withdrawal_rights", "Participants may withdraw at any time through the research interface."),
        ethics_statement=ETHICS_DISCLAIMER,
        required_affirmation=cond.get(
            "required_affirmation",
            "I have read and understood the study information and voluntarily agree to participate."
        ),
        retention_notice=RETENTION_POLICY_NOTICE,
    )


def check_participant_eligibility(db: Session, user: User, study_id: UUID) -> ParticipantEligibilityDTO:
    """Verifies whether the student qualifies for recruitment under protocol inclusion/exclusion criteria."""
    study = get_study_or_fail(db, study_id)
    now = utcnow()
    reasons: list[str] = []

    # Role validation
    if user.role not in {"personal_student", "school_student"}:
        reasons.append("Only registered student accounts may participate in learner studies.")
    if user.profile_status != "active" or user.archived_at is not None:
        reasons.append("Account must be active and not archived.")

    # Status & window validation
    recruitment_open = True
    if study.status != "active":
        recruitment_open = False
        reasons.append(f"Study is not currently recruiting (current status: {study.status}).")
    if study.starts_at and now < study.starts_at:
        recruitment_open = False
        reasons.append("Study recruitment window has not opened yet.")
    if study.ends_at and now > study.ends_at:
        recruitment_open = False
        reasons.append("Study recruitment window has closed.")

    # Quota validation
    enrolled_count = db.scalar(
        select(func.count(ResearchParticipant.id)).where(
            ResearchParticipant.study_id == study.id,
            ResearchParticipant.enrollment_status.in_(["enrolled", "completed"]),
        )
    ) or 0
    quota_available = enrolled_count < study.target_participants
    if not quota_available:
        reasons.append("Study participant recruitment quota has been reached.")

    # Check language match
    target_language_match = True
    if hasattr(user, "preferred_language") and user.preferred_language:
        if user.preferred_language.lower() != study.target_language.lower():
            # Allow participating if student is interested, but flag match
            target_language_match = False

    # Check existing identity link
    link = db.scalar(
        select(ResearchIdentityLink).where(
            ResearchIdentityLink.study_id == study.id,
            ResearchIdentityLink.user_id == user.id,
        )
    )
    current_status = None
    if link:
        participant = db.get(ResearchParticipant, link.participant_id)
        if participant:
            current_status = participant.enrollment_status
            if participant.enrollment_status == "enrolled":
                reasons.append("Student is already enrolled in this study.")
            elif participant.enrollment_status == "withdrawn":
                reasons.append("Student previously withdrew from this study. Re-enrollment is prohibited under protocol policy.")
            elif participant.enrollment_status == "completed":
                reasons.append("Student has already completed this study.")

    return ParticipantEligibilityDTO(
        study_id=study.id,
        study_code=study.code,
        eligible=len(reasons) == 0,
        reasons=reasons,
        current_status=current_status,
        target_language_match=target_language_match,
        recruitment_open=recruitment_open,
        quota_available=quota_available,
        protocol_version=study.protocol_version,
    )


def enroll_participant(
    db: Session,
    user: User,
    study_id: UUID,
    payload: EnrollmentRequestDTO,
) -> EnrollmentReceiptDTO:
    """Atomically executes informed consent verification, pseudonymous code issuance, and enrollment."""
    study = get_study_or_fail(db, study_id)
    now = utcnow()

    # Protocol version check
    if payload.protocol_version != study.protocol_version:
        raise fail(
            422,
            "protocol_version_mismatch",
            f"Consent protocol version mismatch. Active study protocol is '{study.protocol_version}'.",
        )

    # Affirmation check
    if not payload.affirmation_confirmed or payload.consent_decision != "granted":
        raise fail(422, "consent_required", "Informed consent must be affirmatively confirmed.")

    # User role check
    if user.role not in {"personal_student", "school_student"}:
        raise fail(403, "ineligible_role", "Only student accounts are eligible for research study participation.")

    # Verify study is recruiting
    if study.status != "active":
        raise fail(409, "study_inactive", f"Study is not currently recruiting (status: {study.status}).")

    # Serialize participant creation per study with advisory lock if supported
    try:
        db.execute(text("SELECT pg_advisory_xact_lock(78090001)"))
    except Exception:
        pass  # In unit test sqlite environments advisory locks don't exist

    # Check for existing identity link
    existing_link = db.scalar(
        select(ResearchIdentityLink).where(
            ResearchIdentityLink.study_id == study.id,
            ResearchIdentityLink.user_id == user.id,
        )
    )
    if existing_link:
        participant = db.get(ResearchParticipant, existing_link.participant_id)
        if participant and participant.enrollment_status == "withdrawn":
            raise fail(409, "re_enrollment_prohibited", "Re-enrollment after withdrawal is prohibited under protocol policy.")
        if participant and participant.enrollment_status == "enrolled":
            raise fail(409, "already_enrolled", "Student is already enrolled in this study.")
        if participant and participant.enrollment_status == "completed":
            raise fail(409, "study_completed", "Student has already completed participation in this study.")

    # Check quota
    enrolled_count = db.scalar(
        select(func.count(ResearchParticipant.id)).where(
            ResearchParticipant.study_id == study.id,
            ResearchParticipant.enrollment_status.in_(["enrolled", "completed"]),
        )
    ) or 0
    if enrolled_count >= study.target_participants:
        raise fail(409, "target_quota_reached", "Study participant recruitment quota has been reached.")

    # 1. Generate pseudonymous participant code
    participant_code = generate_pseudonymous_participant_code(db, study)

    # 2. Create ResearchParticipant
    participant = ResearchParticipant(
        study_id=study.id,
        participant_code=participant_code,
        enrollment_status="enrolled",
        eligibility_status="eligible",
        enrolled_at=now,
        withdrawn_at=None,
    )
    db.add(participant)
    db.flush()

    # 3. Create ResearchIdentityLink in research_private schema
    identity_link = ResearchIdentityLink(
        participant_id=participant.id,
        study_id=study.id,
        user_id=user.id,
    )
    db.add(identity_link)
    db.flush()

    # 4. Create ResearchConsentRecord in research_private schema (append-only)
    evidence_hash = hashlib.sha256(
        f"{user.id}:{study.id}:{study.protocol_version}:{now.isoformat()}".encode("utf-8")
    ).hexdigest()[:24]
    evidence_ref = f"electronic-consent:{study.protocol_version}:{evidence_hash}"

    consent_record = ResearchConsentRecord(
        participant_id=participant.id,
        kind=payload.consent_kind,
        protocol_version=study.protocol_version,
        status="granted",
        evidence_reference=evidence_ref,
        recorded_at=now,
    )
    db.add(consent_record)
    db.flush()

    # 5. Create LearningContext (strictly research context: student_id=None, class_id=None)
    research_context = LearningContext(
        kind="research",
        participant_id=participant.id,
        student_id=None,
        class_id=None,
    )
    db.add(research_context)
    db.flush()

    # 6. Create ResearchEvent (append-only)
    research_event = ResearchEvent(
        participant_id=participant.id,
        event_type="participant_enrolled",
        event_version=1,
        occurred_at=now,
        payload={
            "protocol_version": study.protocol_version,
            "pseudonym_issued": True,
            "consent_kind": payload.consent_kind,
        },
    )
    db.add(research_event)
    db.flush()

    # 7. Create AuditLog (append-only, privacy safe: no student name or consent text)
    audit = AuditLog(
        actor_id=user.id,
        action="research.participant_enrolled",
        entity_type="research_participant",
        entity_id=participant.id,
        occurred_at=now,
        safe_metadata={
            "study_code": study.code,
            "protocol_version": study.protocol_version,
            "consent_kind": payload.consent_kind,
        },
    )
    db.add(audit)
    db.flush()

    return EnrollmentReceiptDTO(
        participant_id=participant.id,
        participant_code=participant.participant_code,
        study_id=study.id,
        study_code=study.code,
        protocol_version=study.protocol_version,
        enrollment_status=participant.enrollment_status,
        enrolled_at=participant.enrolled_at,
        ethics_disclaimer=ETHICS_DISCLAIMER,
        retention_notice=RETENTION_POLICY_NOTICE,
    )


def get_participant_status(db: Session, user: User) -> list[ParticipantStatusDTO]:
    """Retrieves all research participation records for the authenticated user."""
    seed_research_studies_if_empty(db)
    query = (
        select(ResearchIdentityLink, ResearchParticipant, ResearchStudy)
        .join(ResearchParticipant, ResearchParticipant.id == ResearchIdentityLink.participant_id)
        .join(ResearchStudy, ResearchStudy.id == ResearchIdentityLink.study_id)
        .where(ResearchIdentityLink.user_id == user.id)
        .order_by(ResearchParticipant.created_at.desc())
    )
    records = db.execute(query).all()

    statuses = []
    for link, participant, study in records:
        dto = ParticipantStatusDTO(
            participant_id=participant.id,
            participant_code=participant.participant_code,
            study_id=study.id,
            study_code=study.code,
            study_title=study.title,
            target_language=study.target_language,
            protocol_version=study.protocol_version,
            enrollment_status=participant.enrollment_status,
            eligibility_status=participant.eligibility_status,
            enrolled_at=participant.enrolled_at,
            withdrawn_at=participant.withdrawn_at,
            ethics_disclaimer=ETHICS_DISCLAIMER,
            retention_notice=RETENTION_POLICY_NOTICE,
        )
        statuses.append(dto)
    return statuses


def withdraw_participant(
    db: Session,
    user: User,
    study_id: UUID,
    payload: WithdrawalRequestDTO,
) -> WithdrawalReceiptDTO:
    """Executes voluntary participant withdrawal, preserving pre-withdrawal audit and research logs."""
    study = get_study_or_fail(db, study_id)
    now = utcnow()

    link = db.scalar(
        select(ResearchIdentityLink).where(
            ResearchIdentityLink.study_id == study.id,
            ResearchIdentityLink.user_id == user.id,
        )
    )
    if not link:
        raise fail(404, "not_enrolled", "No research enrollment found for this study.")

    participant = db.get(ResearchParticipant, link.participant_id)
    if not participant:
        raise fail(404, "participant_not_found", "Research participant record not found.")

    if participant.enrollment_status == "withdrawn":
        raise fail(409, "already_withdrawn", "Participant has already withdrawn from this study.")

    # 1. Update participant status
    participant.enrollment_status = "withdrawn"
    participant.withdrawn_at = now
    db.flush()

    # 2. Append new consent record marking withdrawal (research_consent_records is append-only)
    consent_withdrawal = ResearchConsentRecord(
        participant_id=participant.id,
        kind="consent",
        protocol_version=study.protocol_version,
        status="withdrawn",
        evidence_reference=f"electronic-withdrawal:{payload.reason_category}",
        recorded_at=now,
    )
    db.add(consent_withdrawal)
    db.flush()

    # 3. Append ResearchEvent
    event = ResearchEvent(
        participant_id=participant.id,
        event_type="participant_withdrawn",
        event_version=1,
        occurred_at=now,
        payload={
            "reason_category": payload.reason_category,
            "withdrawn_at": now.isoformat(),
        },
    )
    db.add(event)
    db.flush()

    # 4. Append AuditLog
    audit = AuditLog(
        actor_id=user.id,
        action="research.participant_withdrawn",
        entity_type="research_participant",
        entity_id=participant.id,
        occurred_at=now,
        safe_metadata={
            "study_code": study.code,
            "reason_category": payload.reason_category,
        },
    )
    db.add(audit)
    db.flush()

    return WithdrawalReceiptDTO(
        participant_id=participant.id,
        study_code=study.code,
        enrollment_status="withdrawn",
        withdrawn_at=now,
        retention_notice=RETENTION_POLICY_NOTICE,
    )


# =========================================================================
# ADMINISTRATOR & RESEARCHER OPERATIONS (Protected by resolve_session)
# =========================================================================

def admin_list_studies(
    admin_repo,
    credential: str,
    *,
    csrf: str | None = None,
    request_id: str | None = None,
) -> list[ResearchStudyDTO]:
    """Lists research studies with aggregate participant metrics (requires 'research.read')."""
    db = admin_repo.session

    def op(user):
        seed_research_studies_if_empty(db)
        studies = list(db.scalars(select(ResearchStudy).order_by(ResearchStudy.created_at.asc())).all())
        results = []
        for s in studies:
            enrolled = db.scalar(
                select(func.count(ResearchParticipant.id)).where(
                    ResearchParticipant.study_id == s.id,
                    ResearchParticipant.enrollment_status.in_(["enrolled", "completed"]),
                )
            ) or 0
            withdrawn = db.scalar(
                select(func.count(ResearchParticipant.id)).where(
                    ResearchParticipant.study_id == s.id,
                    ResearchParticipant.enrollment_status == "withdrawn",
                )
            ) or 0
            results.append(
                ResearchStudyDTO(
                    id=s.id,
                    code=s.code,
                    title=s.title,
                    status=s.status,
                    target_language=s.target_language,
                    protocol_version=s.protocol_version,
                    target_participants=s.target_participants,
                    enrolled_count=enrolled,
                    withdrawn_count=withdrawn,
                    starts_at=s.starts_at,
                    ends_at=s.ends_at,
                    conditions=s.conditions or {},
                    locked_at=s.locked_at,
                    created_at=s.created_at,
                    updated_at=s.updated_at,
                )
            )
        return results

    return resolve_session(
        admin_repo,
        credential,
        csrf=csrf,
        request_id=request_id,
        required_permission="research.read",
        read_operation=op,
    )


def admin_create_study(
    admin_repo,
    credential: str,
    payload: CreateStudyRequestDTO,
    *,
    csrf: str | None = None,
    request_id: str | None = None,
) -> ResearchStudyDTO:
    """Creates a new research study in 'draft' status (requires 'research.manage')."""
    db = admin_repo.session

    def op(user):
        existing = db.scalar(select(ResearchStudy).where(ResearchStudy.code == payload.code))
        if existing:
            raise fail(409, "code_taken", f"Study code '{payload.code}' is already allocated.")

        study = ResearchStudy(
            code=payload.code,
            title=payload.title,
            status="draft",
            target_language=payload.target_language,
            protocol_version=payload.protocol_version,
            target_participants=payload.target_participants,
            starts_at=payload.starts_at,
            ends_at=payload.ends_at,
            conditions=payload.conditions,
        )
        db.add(study)
        db.flush()

        admin_repo.audit(
            "research.study_created",
            utcnow(),
            actor=user.id,
            entity=study.id,
            request_id=request_id,
            reason=f"code={study.code}",
        )
        return ResearchStudyDTO(
            id=study.id,
            code=study.code,
            title=study.title,
            status=study.status,
            target_language=study.target_language,
            protocol_version=study.protocol_version,
            target_participants=study.target_participants,
            enrolled_count=0,
            withdrawn_count=0,
            starts_at=study.starts_at,
            ends_at=study.ends_at,
            conditions=study.conditions or {},
            locked_at=study.locked_at,
            created_at=study.created_at,
            updated_at=study.updated_at,
        )

    return resolve_session(
        admin_repo,
        credential,
        csrf=csrf,
        request_id=request_id,
        required_permission="research.manage",
        mutation_operation=op,
    )


def admin_lock_study_protocol(
    admin_repo,
    credential: str,
    study_id: UUID,
    *,
    csrf: str | None = None,
    request_id: str | None = None,
) -> ResearchStudyDTO:
    """Locks a study protocol permanently, preventing further configuration changes (requires 'research.manage')."""
    db = admin_repo.session

    def op(user):
        study = db.get(ResearchStudy, study_id)
        if not study:
            raise fail(404, "study_not_found", "Research study not found.")
        if study.locked_at is not None:
            raise fail(409, "already_locked", "Study protocol is already locked.")

        study.locked_at = utcnow()
        study.status = "approved"
        db.flush()

        admin_repo.audit(
            "research.study_protocol_locked",
            utcnow(),
            actor=user.id,
            entity=study.id,
            request_id=request_id,
            reason=f"code={study.code}",
        )
        return ResearchStudyDTO(
            id=study.id,
            code=study.code,
            title=study.title,
            status=study.status,
            target_language=study.target_language,
            protocol_version=study.protocol_version,
            target_participants=study.target_participants,
            enrolled_count=0,
            withdrawn_count=0,
            starts_at=study.starts_at,
            ends_at=study.ends_at,
            conditions=study.conditions or {},
            locked_at=study.locked_at,
            created_at=study.created_at,
            updated_at=study.updated_at,
        )

    return resolve_session(
        admin_repo,
        credential,
        csrf=csrf,
        request_id=request_id,
        required_permission="research.manage",
        mutation_operation=op,
    )


def admin_list_participants(
    admin_repo,
    credential: str,
    study_id: UUID,
    *,
    csrf: str | None = None,
    request_id: str | None = None,
) -> list[AdminParticipantViewDTO]:
    """Lists participants under their pseudonymous identifiers only. Absolutely NO personal info (requires 'research.read')."""
    db = admin_repo.session

    def op(user):
        study = db.get(ResearchStudy, study_id)
        if not study:
            raise fail(404, "study_not_found", "Research study not found.")

        participants = list(
            db.scalars(
                select(ResearchParticipant)
                .where(ResearchParticipant.study_id == study_id)
                .order_by(ResearchParticipant.created_at.asc())
            ).all()
        )

        results = []
        for p in participants:
            # Query latest consent status from consent record
            latest_consent = db.scalar(
                select(ResearchConsentRecord)
                .where(ResearchConsentRecord.participant_id == p.id)
                .order_by(ResearchConsentRecord.recorded_at.desc())
            )
            results.append(
                AdminParticipantViewDTO(
                    participant_id=p.id,
                    study_id=p.study_id,
                    study_code=study.code,
                    participant_code=p.participant_code,
                    enrollment_status=p.enrollment_status,
                    eligibility_status=p.eligibility_status,
                    enrolled_at=p.enrolled_at,
                    withdrawn_at=p.withdrawn_at,
                    consent_kind=latest_consent.kind if latest_consent else None,
                    consent_status=latest_consent.status if latest_consent else None,
                )
            )
        return results

    return resolve_session(
        admin_repo,
        credential,
        csrf=csrf,
        request_id=request_id,
        required_permission="research.read",
        read_operation=op,
    )


def admin_reveal_identity(
    admin_repo,
    credential: str,
    participant_id: UUID,
    *,
    csrf: str | None = None,
    request_id: str | None = None,
) -> AdminIdentityRevealDTO:
    """Privileged de-pseudonymization lookup strictly restricted to 'research.manage' with mandatory audit logging."""
    db = admin_repo.session

    def op(user):
        participant = db.get(ResearchParticipant, participant_id)
        if not participant:
            raise fail(404, "participant_not_found", "Research participant not found.")

        link = db.scalar(
            select(ResearchIdentityLink).where(ResearchIdentityLink.participant_id == participant.id)
        )
        if not link:
            raise fail(404, "link_not_found", "No identity mapping exists for this participant.")

        linked_user = db.get(User, link.user_id)
        if not linked_user:
            raise fail(404, "user_not_found", "Underlying student user account no longer exists.")

        study = db.get(ResearchStudy, participant.study_id)
        study_code = study.code if study else "UNKNOWN"

        # Mandatory high-priority audit log for identity revelation
        admin_repo.audit(
            "research.identity_revealed",
            utcnow(),
            actor=user.id,
            entity=participant.id,
            request_id=request_id,
            reason=f"participant_code={participant.participant_code}; study={study_code}",
        )

        return AdminIdentityRevealDTO(
            participant_id=participant.id,
            participant_code=participant.participant_code,
            study_id=participant.study_id,
            study_code=study_code,
            user_id=linked_user.id,
            username=linked_user.username,
            canonical_username=linked_user.canonical_username,
            linked_at=link.created_at,
        )

    return resolve_session(
        admin_repo,
        credential,
        csrf=csrf,
        request_id=request_id,
        required_permission="research.manage",
        mutation_operation=op,
    )


def admin_withdraw_participant(
    admin_repo,
    credential: str,
    study_id: UUID,
    participant_id: UUID,
    payload: WithdrawalRequestDTO,
    *,
    csrf: str | None = None,
    request_id: str | None = None,
) -> WithdrawalReceiptDTO:
    """Administrative withdrawal of a participant (requires 'research.manage')."""
    db = admin_repo.session

    def op(user):
        study = db.get(ResearchStudy, study_id)
        if not study:
            raise fail(404, "study_not_found", "Research study not found.")

        participant = db.get(ResearchParticipant, participant_id)
        if not participant or participant.study_id != study.id:
            raise fail(404, "participant_not_found", "Participant not found in this study.")

        if participant.enrollment_status == "withdrawn":
            raise fail(409, "already_withdrawn", "Participant is already withdrawn.")

        now = utcnow()
        participant.enrollment_status = "withdrawn"
        participant.withdrawn_at = now
        db.flush()

        # Append withdrawal consent record
        consent = ResearchConsentRecord(
            participant_id=participant.id,
            kind="consent",
            protocol_version=study.protocol_version,
            status="withdrawn",
            evidence_reference=f"admin-withdrawal:{payload.reason_category}",
            recorded_at=now,
        )
        db.add(consent)

        # Append research event
        event = ResearchEvent(
            participant_id=participant.id,
            event_type="participant_withdrawn",
            event_version=1,
            occurred_at=now,
            payload={
                "reason_category": payload.reason_category,
                "administered_by": "research_operator",
                "withdrawn_at": now.isoformat(),
            },
        )
        db.add(event)

        admin_repo.audit(
            "research.participant_administratively_withdrawn",
            now,
            actor=user.id,
            entity=participant.id,
            request_id=request_id,
            reason=f"participant_code={participant.participant_code}; reason={payload.reason_category}",
        )
        db.flush()

        return WithdrawalReceiptDTO(
            participant_id=participant.id,
            study_code=study.code,
            enrollment_status="withdrawn",
            withdrawn_at=now,
            retention_notice=RETENTION_POLICY_NOTICE,
        )

    return resolve_session(
        admin_repo,
        credential,
        csrf=csrf,
        request_id=request_id,
        required_permission="research.manage",
        mutation_operation=op,
    )


# Re-export Section 37 experiment services
from app.modules.research.experiment_service import (  # noqa: E402
    ensure_study_experiment_infrastructure,
    allocate_participant_to_group,
    admin_reassign_participant_group,
    get_participant_experiment_status,
    list_participant_assessments,
    get_participant_assessment_instrument,
    start_participant_assessment,
    submit_participant_assessment,
    admin_list_study_groups,
    admin_list_assessment_results,
)

# Re-export Section 38 analytics & export services
from app.modules.research.analytics_service import (  # noqa: E402
    compute_study_participant_flow,
    compute_study_assessment_metrics,
    compute_study_engagement_metrics,
    get_study_analytics_summary,
    export_participants_longitudinal_csv,
    export_assessment_results_csv,
    export_review_events_csv,
    get_research_data_dictionary,
    sanitize_csv_cell,
    calculate_descriptive_stats,
)

