"""FastAPI routers for student research participation and administrator research oversight."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from app.models.research import ResearchStudy
from .reporting_service import guard_legacy_reporting
from .execution_guard import assert_no_managed_execution

from app.modules.administration.repository import AdminRepository
from app.modules.administration.router import credential, origin_required, request_id
from app.modules.classrooms.router import Credential, Repo
from app.modules.curriculum.router import get_admin_repository
from app.modules.identity.dependencies import require_secure_transport, throttle_sessions
from app.modules.identity.session_service import authenticated_session
from app.modules.research.schemas import (
    AdminAssessmentResultRowDTO,
    AdminIdentityRevealDTO,
    AdminParticipantViewDTO,
    AdminReassignGroupRequestDTO,
    AllocateParticipantRequestDTO,
    AvailableStudiesResponse,
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
    ResearchAssessmentListItemDTO,
    ResearchGroupSummaryDTO,
    ResearchStudyDTO,
    StartAssessmentReceiptDTO,
    StudyAnalyticsSummaryDTO,
    SubmitAssessmentReceiptDTO,
    SubmitAssessmentRequestDTO,
    WithdrawalReceiptDTO,
    WithdrawalRequestDTO,
)
from app.modules.research.service import (
    admin_create_study,
    admin_list_assessment_results,
    admin_list_participants,
    admin_list_studies,
    admin_list_study_groups,
    admin_lock_study_protocol,
    admin_reassign_participant_group,
    admin_reveal_identity,
    admin_withdraw_participant,
    allocate_participant_to_group,
    check_participant_eligibility,
    enroll_participant,
    export_assessment_results_csv,
    export_participants_longitudinal_csv,
    export_review_events_csv,
    get_available_studies,
    get_consent_document,
    get_participant_assessment_instrument,
    get_participant_experiment_status,
    get_participant_status,
    get_research_data_dictionary,
    get_study_analytics_summary,
    get_study_or_fail,
    list_participant_assessments,
    start_participant_assessment,
    submit_participant_assessment,
    withdraw_participant,
)

# Student-facing research router
student_router = APIRouter(
    prefix="/me/research",
    tags=["research participant"],
    dependencies=[Depends(require_secure_transport), Depends(throttle_sessions)],
)

# Admin / researcher management router
admin_router = APIRouter(
    prefix="/admin/research",
    tags=["research administration"],
    dependencies=[Depends(require_secure_transport)],
)

Admin = Annotated[AdminRepository, Depends(get_admin_repository)]
AdminToken = Annotated[str, Depends(credential)]


# =========================================================================
# STUDENT ENDPOINTS (/me/research)
# =========================================================================

@student_router.get("/studies", response_model=AvailableStudiesResponse)
def list_studies(
    request: Request,
    credential: Credential,
    repo: Repo,
    language: str | None = Query(default=None),
):
    """Lists currently active research studies open for participant recruitment."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        studies = get_available_studies(repo.session, user, language=language)
        return AvailableStudiesResponse(
            studies=studies,
            count=len(studies),
            ethics_disclaimer=ETHICS_DISCLAIMER,
        )


@student_router.get("/studies/{study_id}", response_model=ResearchStudyDTO)
def get_study(
    request: Request,
    credential: Credential,
    repo: Repo,
    study_id: UUID,
):
    """Retrieves full descriptive information and protocol status for a specific study."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        study = get_study_or_fail(repo.session, study_id)
        assert_no_managed_execution(study)
        studies = get_available_studies(repo.session, user)
        for s in studies:
            if s.id == study.id:
                return s
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


@student_router.get("/studies/{study_id}/eligibility", response_model=ParticipantEligibilityDTO)
def check_eligibility(
    request: Request,
    credential: Credential,
    repo: Repo,
    study_id: UUID,
):
    """Evaluates the learner's qualification under the study inclusion/exclusion criteria."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return check_participant_eligibility(repo.session, user, study_id)


@student_router.get("/studies/{study_id}/consent-document", response_model=ConsentDocumentDTO)
def get_study_consent_document(
    request: Request,
    credential: Credential,
    repo: Repo,
    study_id: UUID,
):
    """Returns the full informed-consent document, procedures, and retention notice."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_consent_document(repo.session, study_id)


@student_router.post("/studies/{study_id}/enroll", response_model=EnrollmentReceiptDTO, status_code=201)
def enroll_in_study(
    request: Request,
    credential: Credential,
    repo: Repo,
    study_id: UUID,
    payload: EnrollmentRequestDTO,
):
    """Validates informed consent, generates a pseudonymous participant code, and completes enrollment."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        receipt = enroll_participant(repo.session, user, study_id, payload)
        repo.session.commit()
        return receipt


@student_router.get("/status", response_model=list[ParticipantStatusDTO])
def get_my_status(
    request: Request,
    credential: Credential,
    repo: Repo,
):
    """Returns all research enrollments and participant codes for the authenticated student."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_participant_status(repo.session, user)


@student_router.post("/studies/{study_id}/withdraw", response_model=WithdrawalReceiptDTO)
def withdraw_from_study(
    request: Request,
    credential: Credential,
    repo: Repo,
    study_id: UUID,
    payload: WithdrawalRequestDTO,
):
    """Executes participant withdrawal, freezing future research interactions while retaining audit records."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        receipt = withdraw_participant(repo.session, user, study_id, payload)
        repo.session.commit()
        return receipt


# =========================================================================
# ADMINISTRATOR & RESEARCHER ENDPOINTS (/admin/research)
# =========================================================================

@admin_router.get("/studies", response_model=list[ResearchStudyDTO])
def admin_studies(
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Lists research studies with participation metrics (requires 'research.read')."""
    return admin_list_studies(admin, token, request_id=request_id(request))


@admin_router.post("/studies", response_model=ResearchStudyDTO, status_code=201, dependencies=[Depends(origin_required)])
def admin_create(
    payload: CreateStudyRequestDTO,
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Creates a new research study draft (requires 'research.manage')."""
    return admin_create_study(
        admin,
        token,
        payload,
        csrf=request.headers.get("x-csrf-token"),
        request_id=request_id(request),
    )


@admin_router.post("/studies/{study_id}/lock", response_model=ResearchStudyDTO, dependencies=[Depends(origin_required)])
def admin_lock_study(
    study_id: UUID,
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Permanently locks a study protocol (requires 'research.manage')."""
    return admin_lock_study_protocol(
        admin,
        token,
        study_id,
        csrf=request.headers.get("x-csrf-token"),
        request_id=request_id(request),
    )


@admin_router.get("/studies/{study_id}/participants", response_model=list[AdminParticipantViewDTO])
def admin_participants(
    study_id: UUID,
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Lists participants under pseudonymous codes without revealing personal identity (requires 'research.read')."""
    guard_legacy_reporting(admin, token, study_id)
    return admin_list_participants(admin, token, study_id, request_id=request_id(request))


@admin_router.get("/participants/{participant_id}/identity", response_model=AdminIdentityRevealDTO)
def admin_reveal(
    participant_id: UUID,
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Privileged de-pseudonymization lookup with mandatory audit logging (requires 'research.manage')."""
    return admin_reveal_identity(
        admin,
        token,
        participant_id,
        csrf=request.headers.get("x-csrf-token"),
        request_id=request_id(request),
    )


@admin_router.post(
    "/studies/{study_id}/participants/{participant_id}/withdraw",
    response_model=WithdrawalReceiptDTO,
    dependencies=[Depends(origin_required)],
)
def admin_withdraw(
    study_id: UUID,
    participant_id: UUID,
    payload: WithdrawalRequestDTO,
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Administrative participant withdrawal (requires 'research.manage')."""
    return admin_withdraw_participant(
        admin,
        token,
        study_id,
        participant_id,
        payload,
        csrf=request.headers.get("x-csrf-token"),
        request_id=request_id(request),
    )


# =========================================================================
# SECTION 37: CONTROLLED EXPERIMENT PARTICIPANT ENDPOINTS
# =========================================================================

@student_router.get("/studies/{study_id}/experiment", response_model=BlindedExperimentStatusDTO)
def participant_experiment_status(
    study_id: UUID,
    request: Request,
    credential: Credential,
    repo: Repo,
):
    """Retrieves participant's blinded study progression, milestone status, and next activity."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_participant_experiment_status(repo.session, user, study_id)


@student_router.post("/studies/{study_id}/allocate", response_model=GroupAllocationReceiptDTO)
def participant_allocate_group(
    study_id: UUID,
    request: Request,
    credential: Credential,
    repo: Repo,
    payload: AllocateParticipantRequestDTO | None = None,
):
    """Assigns the enrolled participant to an experimental group (permuted block randomization). Condition is blinded."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        assert_no_managed_execution(repo.session.get(ResearchStudy, study_id))
        from app.models.research import ResearchIdentityLink
        link = repo.session.scalar(
            select(ResearchIdentityLink).where(
                ResearchIdentityLink.user_id == user.id,
                ResearchIdentityLink.study_id == study_id,
            )
        )
        if not link:
            from app.modules.research.service import fail
            raise fail(404, "not_enrolled", "Participant is not enrolled in this study.")
        preferred_seed = payload.preferred_seed if payload else None
        asgn = allocate_participant_to_group(repo.session, study_id, link.participant_id, actor_id=user.id, preferred_seed=preferred_seed)
        repo.session.commit()
        return GroupAllocationReceiptDTO(
            assignment_id=asgn.id,
            participant_id=asgn.participant_id,
            participant_code="P-ASSIGNED",
            study_id=study_id,
            assignment_number=asgn.assignment_number,
            assigned_at=asgn.assigned_at,
            allocation_method=asgn.allocation_metadata.get("method", "permuted_block"),
            condition_blinded="standard_research_track",
            condition_unblinded=None,
            reproducibility_seed=asgn.allocation_metadata.get("seed"),
            target_group_size=15,
        )


@student_router.get("/studies/{study_id}/assessments", response_model=list[ResearchAssessmentListItemDTO])
def participant_list_assessments(
    study_id: UUID,
    request: Request,
    credential: Credential,
    repo: Repo,
):
    """Lists study assessment instruments with milestone unlocking and status for the participant."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return list_participant_assessments(repo.session, user, study_id)


@student_router.get("/studies/{study_id}/assessments/{assessment_id}", response_model=ResearchAssessmentDetailDTO)
def participant_get_assessment(
    study_id: UUID,
    assessment_id: UUID,
    request: Request,
    credential: Credential,
    repo: Repo,
):
    """Retrieves key-free assessment instrument for participant taking (zero answer keys leaked)."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        return get_participant_assessment_instrument(repo.session, user, study_id, assessment_id)


@student_router.post("/studies/{study_id}/assessments/{assessment_id}/start", response_model=StartAssessmentReceiptDTO)
def participant_start_assessment(
    study_id: UUID,
    assessment_id: UUID,
    request: Request,
    credential: Credential,
    repo: Repo,
):
    """Starts or resumes an assessment attempt (enforces single-attempt rule)."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        receipt = start_participant_assessment(repo.session, user, study_id, assessment_id)
        repo.session.commit()
        return receipt


@student_router.post("/studies/{study_id}/assessments/{assessment_id}/submit", response_model=SubmitAssessmentReceiptDTO)
def participant_submit_assessment(
    study_id: UUID,
    assessment_id: UUID,
    submission: SubmitAssessmentRequestDTO,
    request: Request,
    credential: Credential,
    repo: Repo,
):
    """Submits answers for objective/pronunciation scoring and marks attempt completed."""
    with authenticated_session(repo, credential, request.app.state.settings) as (_, user):
        receipt = submit_participant_assessment(repo.session, user, study_id, assessment_id, submission)
        repo.session.commit()
        return receipt


# =========================================================================
# SECTION 37: CONTROLLED EXPERIMENT ADMIN ENDPOINTS
# =========================================================================

@admin_router.get("/studies/{study_id}/groups", response_model=list[ResearchGroupSummaryDTO])
def admin_groups(
    study_id: UUID,
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Lists unblinded study groups, conditions, and enrollments (requires 'research.read')."""
    guard_legacy_reporting(admin, token, study_id)
    return admin_list_study_groups(admin.session, admin, token, study_id)


@admin_router.post(
    "/studies/{study_id}/reassign",
    response_model=GroupAllocationReceiptDTO,
    dependencies=[Depends(origin_required)],
)
def admin_reassign(
    study_id: UUID,
    payload: AdminReassignGroupRequestDTO,
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Authorized researcher protocol deviation: reassigns group with mandatory justification (requires 'research.manage')."""
    return admin_reassign_participant_group(
        admin.session,
        admin,
        token,
        csrf=request.headers.get("x-csrf-token"),
        request_id=request_id(request),
        study_id=study_id,
        payload=payload,
    )


@admin_router.get("/studies/{study_id}/results", response_model=list[AdminAssessmentResultRowDTO])
def admin_results(
    study_id: UUID,
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Lists unblinded assessment scores across conditions for authorized research analysis (requires 'research.read')."""
    guard_legacy_reporting(admin, token, study_id)
    return admin_list_assessment_results(admin.session, admin, token, study_id)


# =========================================================================
# SECTION 38: RESEARCH ANALYTICS & SECURE EXPORTS
# =========================================================================

@admin_router.get("/studies/{study_id}/analytics", response_model=StudyAnalyticsSummaryDTO)
def admin_study_analytics(
    study_id: UUID,
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Computes descriptive research analytics, CONSORT flow, and condition comparisons (requires 'research.read')."""
    guard_legacy_reporting(admin, token, study_id)
    return get_study_analytics_summary(admin.session, admin, token, study_id)


@admin_router.get("/studies/{study_id}/exports/participants.csv")
def admin_export_participants(
    study_id: UUID,
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Exports de-identified participant-level longitudinal CSV dataset with formula injection protection (requires 'research.read')."""
    guard_legacy_reporting(admin, token, study_id, export=True)
    csv_content = export_participants_longitudinal_csv(
        admin.session,
        admin,
        token,
        study_id,
        request_id=request_id(request),
    )
    admin.session.commit()
    filename = f"fluentt_study_{study_id}_participants_longitudinal.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@admin_router.get("/studies/{study_id}/exports/assessments.csv")
def admin_export_assessments(
    study_id: UUID,
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Exports de-identified assessment attempts CSV dataset with formula injection protection (requires 'research.read')."""
    guard_legacy_reporting(admin, token, study_id, export=True)
    csv_content = export_assessment_results_csv(
        admin.session,
        admin,
        token,
        study_id,
        request_id=request_id(request),
    )
    admin.session.commit()
    filename = f"fluentt_study_{study_id}_assessments.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@admin_router.get("/studies/{study_id}/exports/reviews.csv")
def admin_export_reviews(
    study_id: UUID,
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Exports de-identified spaced repetition review event log CSV dataset with formula injection protection (requires 'research.read')."""
    guard_legacy_reporting(admin, token, study_id, export=True)
    csv_content = export_review_events_csv(
        admin.session,
        admin,
        token,
        study_id,
        request_id=request_id(request),
    )
    admin.session.commit()
    filename = f"fluentt_study_{study_id}_reviews.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@admin_router.get("/studies/{study_id}/exports/data-dictionary")
def admin_export_data_dictionary(
    study_id: UUID,
    request: Request,
    admin: Admin,
    token: AdminToken,
):
    """Returns thesis-compliant research data dictionary and variable codebook (requires 'research.read')."""
    guard_legacy_reporting(admin, token, study_id, export=True)
    admin.resolve_session(token)
    admin.require_permission(token, "research.read")
    return get_research_data_dictionary()


