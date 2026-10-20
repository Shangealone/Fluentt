"""Section 38 Research Analytics, Descriptive Statistics, and Secure Exports Engine.

Provides traceable, reproducible research reporting, CONSORT participant flow summaries,
condition-level descriptive statistics, and spreadsheet-injection-protected CSV exports.
"""

from datetime import datetime, timezone
from decimal import Decimal
import io
import math
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.learning import LearningContext, VocabularyItem, VocabularyReviewEvent, VocabularyReviewState
from app.models.operations import AuditLog
from app.models.research import (
    ResearchAssessment,
    ResearchAssessmentResult,
    ResearchConsentRecord,
    ResearchGroup,
    ResearchGroupAssignment,
    ResearchParticipant,
    ResearchStudy,
    SchedulerConfiguration,
)
from app.modules.administration.repository import AdminRepository
from app.modules.identity.errors import IdentityError
from app.modules.research.schemas import (
    ETHICS_DISCLAIMER,
    AssessmentComparisonDTO,
    DescriptiveMetricDTO,
    EngagementSummaryDTO,
    PairedComparisonsDTO,
    ParticipantFlowDTO,
    StudyAnalyticsSummaryDTO,
)


def sanitize_csv_cell(value: Any) -> str:
    """Sanitizes CSV cells against formula injection (CWE-1236 / CSV Injection).
    
    Prepends a single quote (') if the text begins with dangerous execution characters
    (=, +, -, @, tab, CR, %) and is not purely a valid numeric value.
    """
    if value is None:
        return ""
    if isinstance(value, (int, float, Decimal)):
        return str(value)
    text = str(value)
    # If text parses cleanly as a float/int, it's a safe numeric value (e.g. -1.5)
    try:
        float(text)
        return text
    except ValueError:
        pass
    # If text begins with formula triggers, prepend a single quote
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r", "%"):
        return f"'{text}"
    return text


def calculate_descriptive_stats(values: list[float], max_possible: float | None = None) -> DescriptiveMetricDTO:
    """Computes transparent sample descriptive statistics without speculative inferential claims."""
    n = len(values)
    if n == 0:
        return DescriptiveMetricDTO(
            count=0,
            mean=None,
            median=None,
            std_dev=None,
            min_value=None,
            max_value=None,
            mean_percentage=None,
            is_small_cell=True,
        )

    mean_val = sum(values) / n
    sorted_vals = sorted(values)
    if n % 2 == 1:
        median_val = sorted_vals[n // 2]
    else:
        median_val = (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2.0

    if n >= 2:
        variance = sum((x - mean_val) ** 2 for x in values) / (n - 1)
        std_dev = math.sqrt(variance)
    else:
        std_dev = None

    min_val = sorted_vals[0]
    max_val = sorted_vals[-1]
    mean_pct = (mean_val / max_possible * 100.0) if max_possible and max_possible > 0 else None

    return DescriptiveMetricDTO(
        count=n,
        mean=round(mean_val, 2),
        median=round(median_val, 2),
        std_dev=round(std_dev, 2) if std_dev is not None else None,
        min_value=round(min_val, 2),
        max_value=round(max_val, 2),
        mean_percentage=round(mean_pct, 2) if mean_pct is not None else None,
        is_small_cell=n < 5,
    )


def compute_study_participant_flow(db: Session, study: ResearchStudy) -> ParticipantFlowDTO:
    """Computes exact CONSORT participant flow counts derived from immutable database records."""
    participants = db.scalars(
        select(ResearchParticipant).where(ResearchParticipant.study_id == study.id)
    ).all()

    total_enrolled = len(participants)
    withdrawn_participants = [p for p in participants if p.enrollment_status == "withdrawn"]
    active_participants = [p for p in participants if p.enrollment_status == "enrolled"]

    # Map participant IDs to their active group assignment (highest assignment_number)
    assignments = db.scalars(
        select(ResearchGroupAssignment).where(ResearchGroupAssignment.study_id == study.id)
    ).all()
    groups = {g.id: g for g in db.scalars(select(ResearchGroup).where(ResearchGroup.study_id == study.id)).all()}

    # Resolve latest assignment per participant
    latest_asgns: dict[UUID, ResearchGroupAssignment] = {}
    for a in assignments:
        if a.participant_id not in latest_asgns or a.assignment_number > latest_asgns[a.participant_id].assignment_number:
            latest_asgns[a.participant_id] = a

    allocated_control = 0
    allocated_experimental = 0
    for p in participants:
        asgn = latest_asgns.get(p.id)
        if asgn and asgn.group_id in groups:
            cond = groups[asgn.group_id].condition
            if cond == "sm2_control":
                allocated_control += 1
            elif cond == "esr_experimental":
                allocated_experimental += 1

    # Withdrawal reason categorization from consent withdrawal records
    withdrawn_by_reason: dict[str, int] = {
        "voluntary_withdrawal": 0,
        "scheduling_conflict": 0,
        "privacy_concerns": 0,
        "other": 0,
    }
    withdrawn_ids = {p.id for p in withdrawn_participants}
    if withdrawn_ids:
        # Check consent records
        consent_records = db.scalars(
            select(ResearchConsentRecord).where(
                ResearchConsentRecord.participant_id.in_(withdrawn_ids),
                ResearchConsentRecord.status == "withdrawn",
            )
        ).all()
        for c in consent_records:
            ref = c.evidence_reference or ""
            matched = False
            for r in withdrawn_by_reason:
                if r in ref:
                    withdrawn_by_reason[r] += 1
                    matched = True
                    break
            if not matched:
                withdrawn_by_reason["voluntary_withdrawal"] += 1

    # Completed count: participants who completed both pre_test and post_test
    assessments = db.scalars(select(ResearchAssessment).where(ResearchAssessment.study_id == study.id)).all()
    post_test_asm = next((a for a in assessments if a.kind == "post_test"), None)

    completed_count = 0
    if post_test_asm:
        completed_results = db.scalars(
            select(ResearchAssessmentResult).where(
                ResearchAssessmentResult.assessment_id == post_test_asm.id,
                ResearchAssessmentResult.status == "completed",
            )
        ).all()
        completed_count = len(completed_results)

    completion_rate = (completed_count / total_enrolled * 100.0) if total_enrolled > 0 else 0.0
    dropout_rate = (len(withdrawn_participants) / total_enrolled * 100.0) if total_enrolled > 0 else 0.0

    return ParticipantFlowDTO(
        target_participants=study.target_participants,
        total_enrolled=total_enrolled,
        allocated_control=allocated_control,
        allocated_experimental=allocated_experimental,
        active_in_progress=len(active_participants),
        completed_study=completed_count,
        total_withdrawn=len(withdrawn_participants),
        withdrawn_by_reason=withdrawn_by_reason,
        completion_rate_pct=round(completion_rate, 2),
        dropout_rate_pct=round(dropout_rate, 2),
    )


def compute_study_assessment_metrics(db: Session, study: ResearchStudy) -> tuple[list[AssessmentComparisonDTO], PairedComparisonsDTO]:
    """Computes condition-separated descriptive metrics and paired learning gain / retention loss."""
    assessments = db.scalars(
        select(ResearchAssessment).where(ResearchAssessment.study_id == study.id)
    ).all()
    groups = {g.id: g for g in db.scalars(select(ResearchGroup).where(ResearchGroup.study_id == study.id)).all()}
    assignments = db.scalars(select(ResearchGroupAssignment).where(ResearchGroupAssignment.study_id == study.id)).all()

    # Participant condition mapping
    latest_asgns: dict[UUID, str] = {}
    for a in assignments:
        if a.group_id in groups:
            cond = groups[a.group_id].condition
            if a.participant_id not in latest_asgns or a.assignment_number > 1:
                latest_asgns[a.participant_id] = cond

    # Fetch all completed assessment results for this study
    results = db.scalars(
        select(ResearchAssessmentResult).where(
            ResearchAssessmentResult.study_id == study.id,
            ResearchAssessmentResult.status == "completed",
        )
    ).all()

    # Group results by assessment_id and participant_id
    results_by_asm: dict[UUID, list[ResearchAssessmentResult]] = {}
    results_by_part: dict[UUID, dict[str, float]] = {}  # participant_id -> {kind -> score}

    for r in results:
        results_by_asm.setdefault(r.assessment_id, []).append(r)
        # Find assessment kind
        asm = next((a for a in assessments if a.id == r.assessment_id), None)
        if asm and r.score is not None:
            results_by_part.setdefault(r.participant_id, {})[asm.kind] = float(r.score)

    comparison_dtos: list[AssessmentComparisonDTO] = []

    # Sort assessments in canonical chronological order
    kind_order = ["pre_test", "learning_level", "post_test", "delayed_retention", "pronunciation"]
    sorted_asms = sorted(
        assessments,
        key=lambda a: (kind_order.index(a.kind) if a.kind in kind_order else 99, a.instrument_snapshot.get("title", ""))
    )

    for asm in sorted_asms:
        max_score = float(asm.instrument_snapshot.get("total_points", 10.0))
        asm_results = results_by_asm.get(asm.id, [])

        control_scores: list[float] = []
        exp_scores: list[float] = []
        all_scores: list[float] = []

        for r in asm_results:
            if r.score is not None:
                val = float(r.score)
                all_scores.append(val)
                cond = latest_asgns.get(r.participant_id)
                if cond == "sm2_control":
                    control_scores.append(val)
                elif cond == "esr_experimental":
                    exp_scores.append(val)

        comparison_dtos.append(
            AssessmentComparisonDTO(
                assessment_id=asm.id,
                kind=asm.kind,
                title=asm.instrument_snapshot.get("title", asm.kind.replace("_", " ").title()),
                instrument_version=asm.instrument_version,
                maximum_possible=max_score,
                control_stats=calculate_descriptive_stats(control_scores, max_score),
                experimental_stats=calculate_descriptive_stats(exp_scores, max_score),
                overall_stats=calculate_descriptive_stats(all_scores, max_score),
            )
        )

    # Compute paired metrics: Absolute Learning Gain (Post - Pre) and Retention Loss (Post - Retention)
    gain_control: list[float] = []
    gain_exp: list[float] = []
    norm_gain_control: list[float] = []
    norm_gain_exp: list[float] = []
    loss_control: list[float] = []
    loss_exp: list[float] = []

    post_max = 10.0
    for p_id, kinds in results_by_part.items():
        cond = latest_asgns.get(p_id)
        if "pre_test" in kinds and "post_test" in kinds:
            raw_gain = kinds["post_test"] - kinds["pre_test"]
            denom = post_max - kinds["pre_test"]
            norm_g = (raw_gain / denom) if denom > 0 else 0.0

            if cond == "sm2_control":
                gain_control.append(raw_gain)
                norm_gain_control.append(norm_g)
            elif cond == "esr_experimental":
                gain_exp.append(raw_gain)
                norm_gain_exp.append(norm_g)

        if "post_test" in kinds and "delayed_retention" in kinds:
            ret_loss = kinds["post_test"] - kinds["delayed_retention"]
            if cond == "sm2_control":
                loss_control.append(ret_loss)
            elif cond == "esr_experimental":
                loss_exp.append(ret_loss)

    paired_dto = PairedComparisonsDTO(
        absolute_gain_control=calculate_descriptive_stats(gain_control),
        absolute_gain_experimental=calculate_descriptive_stats(gain_exp),
        normalized_gain_control=calculate_descriptive_stats(norm_gain_control),
        normalized_gain_experimental=calculate_descriptive_stats(norm_gain_exp),
        retention_loss_control=calculate_descriptive_stats(loss_control),
        retention_loss_experimental=calculate_descriptive_stats(loss_exp),
    )

    return comparison_dtos, paired_dto


def compute_study_engagement_metrics(db: Session, study: ResearchStudy) -> tuple[EngagementSummaryDTO, EngagementSummaryDTO]:
    """Computes spaced repetition learning engagement and retention metrics by condition."""
    participants = db.scalars(select(ResearchParticipant).where(ResearchParticipant.study_id == study.id)).all()
    p_map = {p.id: p for p in participants}
    groups = {g.id: g for g in db.scalars(select(ResearchGroup).where(ResearchGroup.study_id == study.id)).all()}
    assignments = db.scalars(select(ResearchGroupAssignment).where(ResearchGroupAssignment.study_id == study.id)).all()

    cond_by_participant: dict[UUID, str] = {}
    for a in assignments:
        if a.group_id in groups:
            cond_by_participant[a.participant_id] = groups[a.group_id].condition

    # Fetch all learning contexts for these participants
    contexts = db.scalars(
        select(LearningContext).where(
            LearningContext.kind == "research",
            LearningContext.participant_id.in_(list(p_map.keys())),
        )
    ).all()
    ctx_to_part = {c.id: c.participant_id for c in contexts if c.participant_id}

    if not ctx_to_part:
        empty = EngagementSummaryDTO(
            total_review_events=0,
            active_learners=0,
            mean_reviews_per_learner=0.0,
            retention_accuracy_pct=0.0,
            mean_duration_ms=0,
            total_lapses=0,
            rating_counts={"again": 0, "hard": 0, "good": 0, "easy": 0},
        )
        return empty, empty

    # Fetch all vocabulary review states and review events
    review_states = db.scalars(
        select(VocabularyReviewState).where(VocabularyReviewState.context_id.in_(list(ctx_to_part.keys())))
    ).all()
    state_to_part = {s.id: ctx_to_part[s.context_id] for s in review_states if s.context_id in ctx_to_part}

    events = db.scalars(
        select(VocabularyReviewEvent).where(
            VocabularyReviewEvent.review_state_id.in_(list(state_to_part.keys()))
        )
    ).all()

    def summarize_events(target_cond: str) -> EngagementSummaryDTO:
        target_events: list[VocabularyReviewEvent] = []
        active_parts: set[UUID] = set()
        for ev in events:
            p_id = state_to_part.get(ev.review_state_id)
            if p_id and cond_by_participant.get(p_id) == target_cond:
                target_events.append(ev)
                active_parts.add(p_id)

        tot = len(target_events)
        if tot == 0:
            return EngagementSummaryDTO(
                total_review_events=0,
                active_learners=len(active_parts),
                mean_reviews_per_learner=0.0,
                retention_accuracy_pct=0.0,
                mean_duration_ms=0,
                total_lapses=0,
                rating_counts={"again": 0, "hard": 0, "good": 0, "easy": 0},
            )

        ratings = {"again": 0, "hard": 0, "good": 0, "easy": 0}
        durations: list[int] = []
        for ev in target_events:
            if ev.recall_rating in ratings:
                ratings[ev.recall_rating] += 1
            if ev.response_duration_ms:
                durations.append(ev.response_duration_ms)

        retention_count = ratings["good"] + ratings["easy"]
        accuracy = (retention_count / tot * 100.0) if tot > 0 else 0.0
        mean_dur = sum(durations) // len(durations) if durations else 0
        mean_revs = tot / len(active_parts) if active_parts else 0.0

        return EngagementSummaryDTO(
            total_review_events=tot,
            active_learners=len(active_parts),
            mean_reviews_per_learner=round(mean_revs, 2),
            retention_accuracy_pct=round(accuracy, 2),
            mean_duration_ms=mean_dur,
            total_lapses=ratings["again"],
            rating_counts=ratings,
        )

    return summarize_events("sm2_control"), summarize_events("esr_experimental")


def get_study_analytics_summary(db: Session, admin_repo: AdminRepository, token: str, study_id: UUID) -> StudyAnalyticsSummaryDTO:
    """Returns comprehensive descriptive analytics and participant flow for the study."""
    admin_repo.resolve_session(token)
    admin_repo.require_permission(token, "research.read")

    study = db.get(ResearchStudy, study_id)
    if not study:
        raise IdentityError(404, "study_not_found", "Research study not found.")

    flow = compute_study_participant_flow(db, study)
    assessments, paired = compute_study_assessment_metrics(db, study)
    eng_control, eng_exp = compute_study_engagement_metrics(db, study)

    return StudyAnalyticsSummaryDTO(
        study_id=study.id,
        study_code=study.code,
        study_title=study.title,
        target_language=study.target_language,
        protocol_version=study.protocol_version,
        flow=flow,
        assessments=assessments,
        paired=paired,
        engagement_control=eng_control,
        engagement_experimental=eng_exp,
        ethics_disclaimer=ETHICS_DISCLAIMER,
        data_integrity_notice=(
            "Descriptive statistics only. No inferential significance claims or artificial p-values are asserted. "
            "Cells with N < 5 are flagged for privacy protection per educational research standards."
        ),
    )


# =========================================================================
# SECURE RESEARCH DATASET EXPORTS
# =========================================================================

def export_participants_longitudinal_csv(
    db: Session,
    admin_repo: AdminRepository,
    token: str,
    study_id: UUID,
    request_id: str | None = None,
) -> str:
    """Generates de-identified participant-level longitudinal CSV dataset with formula injection protection."""
    admin_user = admin_repo.resolve_session(token)
    admin_repo.require_permission(token, "research.read")

    study = db.get(ResearchStudy, study_id)
    if not study:
        raise IdentityError(404, "study_not_found", "Research study not found.")

    participants = db.scalars(
        select(ResearchParticipant).where(ResearchParticipant.study_id == study_id).order_by(ResearchParticipant.participant_code)
    ).all()

    groups = {g.id: g for g in db.scalars(select(ResearchGroup).where(ResearchGroup.study_id == study_id)).all()}
    assignments = db.scalars(select(ResearchGroupAssignment).where(ResearchGroupAssignment.study_id == study_id)).all()
    latest_asgns: dict[UUID, ResearchGroupAssignment] = {}
    for a in assignments:
        if a.participant_id not in latest_asgns or a.assignment_number > latest_asgns[a.participant_id].assignment_number:
            latest_asgns[a.participant_id] = a

    assessments = db.scalars(select(ResearchAssessment).where(ResearchAssessment.study_id == study_id)).all()
    asm_map = {a.id: a for a in assessments}
    results = db.scalars(
        select(ResearchAssessmentResult).where(
            ResearchAssessmentResult.study_id == study_id,
            ResearchAssessmentResult.status == "completed",
        )
    ).all()

    results_by_part: dict[UUID, dict[str, float]] = {}
    for r in results:
        asm = asm_map.get(r.assessment_id)
        if asm and r.score is not None:
            kind_key = asm.kind if asm.kind != "learning_level" else f"level_{asm.instrument_snapshot.get('number', 1)}"
            results_by_part.setdefault(r.participant_id, {})[kind_key] = float(r.score)

    output = io.StringIO()
    headers = [
        "participant_code",
        "study_code",
        "target_language",
        "condition",
        "allocation_method",
        "assignment_number",
        "enrollment_status",
        "enrolled_at_iso",
        "withdrawn_at_iso",
        "pre_test_score",
        "level_1_score",
        "level_2_score",
        "level_3_score",
        "level_4_score",
        "level_5_score",
        "post_test_score",
        "absolute_learning_gain",
        "normalized_learning_gain",
        "retention_score",
        "retention_loss",
        "pronunciation_score",
    ]
    output.write(",".join(headers) + "\n")

    for p in participants:
        asgn = latest_asgns.get(p.id)
        cond = groups[asgn.group_id].condition if asgn and asgn.group_id in groups else "unallocated"
        method = asgn.allocation_metadata.get("method", "permuted_block") if asgn else "NA"
        asgn_num = asgn.assignment_number if asgn else "NA"
        part_scores = results_by_part.get(p.id, {})

        pre = part_scores.get("pre_test")
        post = part_scores.get("post_test")
        ret = part_scores.get("delayed_retention")

        raw_gain = (post - pre) if (pre is not None and post is not None) else None
        denom = (10.0 - pre) if pre is not None else 0.0
        norm_gain = (raw_gain / denom) if (raw_gain is not None and denom > 0) else None
        ret_loss = (post - ret) if (post is not None and ret is not None) else None

        row = [
            sanitize_csv_cell(p.participant_code),
            sanitize_csv_cell(study.code),
            sanitize_csv_cell(study.target_language),
            sanitize_csv_cell(cond),
            sanitize_csv_cell(method),
            sanitize_csv_cell(asgn_num),
            sanitize_csv_cell(p.enrollment_status),
            sanitize_csv_cell(p.enrolled_at.isoformat() if p.enrolled_at else "NA"),
            sanitize_csv_cell(p.withdrawn_at.isoformat() if p.withdrawn_at else "NA"),
            sanitize_csv_cell(pre if pre is not None else "NA"),
            sanitize_csv_cell(part_scores.get("level_1", "NA")),
            sanitize_csv_cell(part_scores.get("level_2", "NA")),
            sanitize_csv_cell(part_scores.get("level_3", "NA")),
            sanitize_csv_cell(part_scores.get("level_4", "NA")),
            sanitize_csv_cell(part_scores.get("level_5", "NA")),
            sanitize_csv_cell(post if post is not None else "NA"),
            sanitize_csv_cell(round(raw_gain, 2) if raw_gain is not None else "NA"),
            sanitize_csv_cell(round(norm_gain, 4) if norm_gain is not None else "NA"),
            sanitize_csv_cell(ret if ret is not None else "NA"),
            sanitize_csv_cell(round(ret_loss, 2) if ret_loss is not None else "NA"),
            sanitize_csv_cell(part_scores.get("pronunciation", "NA")),
        ]
        output.write(",".join(row) + "\n")

    # Record AuditLog
    now = datetime.now(timezone.utc)
    audit = AuditLog(
        actor_id=admin_user.id,
        action="research.dataset_exported",
        entity_type="research_study",
        entity_id=study.id,
        occurred_at=now,
        request_id=UUID(request_id) if request_id else None,
        safe_metadata={
            "dataset": "participants_longitudinal",
            "study_code": study.code,
            "row_count": len(participants),
        },
    )
    db.add(audit)
    db.flush()

    return output.getvalue()


def export_assessment_results_csv(
    db: Session,
    admin_repo: AdminRepository,
    token: str,
    study_id: UUID,
    request_id: str | None = None,
) -> str:
    """Generates de-identified assessment attempts CSV dataset with formula injection protection."""
    admin_user = admin_repo.resolve_session(token)
    admin_repo.require_permission(token, "research.read")

    study = db.get(ResearchStudy, study_id)
    if not study:
        raise IdentityError(404, "study_not_found", "Research study not found.")

    participants = {p.id: p for p in db.scalars(select(ResearchParticipant).where(ResearchParticipant.study_id == study_id)).all()}
    groups = {g.id: g for g in db.scalars(select(ResearchGroup).where(ResearchGroup.study_id == study_id)).all()}
    assignments = db.scalars(select(ResearchGroupAssignment).where(ResearchGroupAssignment.study_id == study_id)).all()
    latest_asgns: dict[UUID, str] = {}
    for a in assignments:
        if a.group_id in groups:
            latest_asgns[a.participant_id] = groups[a.group_id].condition

    assessments = {a.id: a for a in db.scalars(select(ResearchAssessment).where(ResearchAssessment.study_id == study_id)).all()}
    results = db.scalars(
        select(ResearchAssessmentResult).where(
            ResearchAssessmentResult.study_id == study_id,
        ).order_by(ResearchAssessmentResult.completed_at.desc())
    ).all()

    output = io.StringIO()
    headers = [
        "result_id",
        "participant_code",
        "study_code",
        "condition",
        "assessment_kind",
        "instrument_version",
        "attempt_number",
        "score",
        "maximum_score",
        "percentage",
        "response_duration_ms",
        "status",
        "completed_at_iso",
    ]
    output.write(",".join(headers) + "\n")

    for r in results:
        p = participants.get(r.participant_id)
        asm = assessments.get(r.assessment_id)
        p_code = p.participant_code if p else "NA"
        cond = latest_asgns.get(r.participant_id, "unallocated")
        kind = asm.kind if asm else "NA"
        version = asm.instrument_version if asm else "NA"

        score_val = float(r.score) if r.score is not None else 0.0
        max_val = float(r.maximum_score) if r.maximum_score is not None else 10.0
        pct = (score_val / max_val * 100.0) if max_val > 0 else 0.0

        row = [
            sanitize_csv_cell(str(r.id)),
            sanitize_csv_cell(p_code),
            sanitize_csv_cell(study.code),
            sanitize_csv_cell(cond),
            sanitize_csv_cell(kind),
            sanitize_csv_cell(version),
            sanitize_csv_cell(r.attempt_number),
            sanitize_csv_cell(score_val),
            sanitize_csv_cell(max_val),
            sanitize_csv_cell(round(pct, 2)),
            sanitize_csv_cell(r.response_duration_ms or "NA"),
            sanitize_csv_cell(r.status),
            sanitize_csv_cell(r.completed_at.isoformat() if r.completed_at else "NA"),
        ]
        output.write(",".join(row) + "\n")

    now = datetime.now(timezone.utc)
    audit = AuditLog(
        actor_id=admin_user.id,
        action="research.dataset_exported",
        entity_type="research_study",
        entity_id=study.id,
        occurred_at=now,
        request_id=UUID(request_id) if request_id else None,
        safe_metadata={
            "dataset": "assessment_results",
            "study_code": study.code,
            "row_count": len(results),
        },
    )
    db.add(audit)
    db.flush()

    return output.getvalue()


def export_review_events_csv(
    db: Session,
    admin_repo: AdminRepository,
    token: str,
    study_id: UUID,
    request_id: str | None = None,
) -> str:
    """Generates de-identified spaced repetition review event log CSV dataset with formula injection protection."""
    admin_user = admin_repo.resolve_session(token)
    admin_repo.require_permission(token, "research.read")

    study = db.get(ResearchStudy, study_id)
    if not study:
        raise IdentityError(404, "study_not_found", "Research study not found.")

    participants = {p.id: p for p in db.scalars(select(ResearchParticipant).where(ResearchParticipant.study_id == study_id)).all()}
    groups = {g.id: g for g in db.scalars(select(ResearchGroup).where(ResearchGroup.study_id == study_id)).all()}
    assignments = db.scalars(select(ResearchGroupAssignment).where(ResearchGroupAssignment.study_id == study_id)).all()
    latest_asgns: dict[UUID, str] = {}
    for a in assignments:
        if a.group_id in groups:
            latest_asgns[a.participant_id] = groups[a.group_id].condition

    contexts = db.scalars(
        select(LearningContext).where(
            LearningContext.kind == "research",
            LearningContext.participant_id.in_(list(participants.keys())),
        )
    ).all()
    ctx_to_part = {c.id: c.participant_id for c in contexts if c.participant_id}

    output = io.StringIO()
    headers = [
        "event_id",
        "participant_code",
        "study_code",
        "condition",
        "scheduler_algorithm",
        "vocabulary_term",
        "recall_rating",
        "response_duration_ms",
        "reviewed_at_iso",
    ]
    output.write(",".join(headers) + "\n")

    event_count = 0
    if ctx_to_part:
        review_states = db.scalars(
            select(VocabularyReviewState).where(VocabularyReviewState.context_id.in_(list(ctx_to_part.keys())))
        ).all()
        state_map = {s.id: s for s in review_states}
        schedulers = {s.id: s for s in db.scalars(select(SchedulerConfiguration)).all()}
        vocabs = {v.id: v for v in db.scalars(select(VocabularyItem)).all()}

        events = db.scalars(
            select(VocabularyReviewEvent).where(
                VocabularyReviewEvent.review_state_id.in_(list(state_map.keys()))
            ).order_by(VocabularyReviewEvent.reviewed_at.desc())
        ).all()
        event_count = len(events)

        for ev in events:
            st = state_map.get(ev.review_state_id)
            p_id = ctx_to_part.get(st.context_id) if st else None
            p = participants.get(p_id) if p_id else None
            p_code = p.participant_code if p else "NA"
            cond = latest_asgns.get(p_id, "unallocated") if p_id else "NA"
            sched = schedulers.get(ev.scheduler_configuration_id)
            alg = sched.algorithm if sched else "NA"
            voc = vocabs.get(st.vocabulary_item_id) if st else None
            term = voc.term if voc else "NA"

            row = [
                sanitize_csv_cell(str(ev.id)),
                sanitize_csv_cell(p_code),
                sanitize_csv_cell(study.code),
                sanitize_csv_cell(cond),
                sanitize_csv_cell(alg),
                sanitize_csv_cell(term),
                sanitize_csv_cell(ev.recall_rating),
                sanitize_csv_cell(ev.response_duration_ms),
                sanitize_csv_cell(ev.reviewed_at.isoformat() if ev.reviewed_at else "NA"),
            ]
            output.write(",".join(row) + "\n")

    now = datetime.now(timezone.utc)
    audit = AuditLog(
        actor_id=admin_user.id,
        action="research.dataset_exported",
        entity_type="research_study",
        entity_id=study.id,
        occurred_at=now,
        request_id=UUID(request_id) if request_id else None,
        safe_metadata={
            "dataset": "review_events",
            "study_code": study.code,
            "row_count": event_count,
        },
    )
    db.add(audit)
    db.flush()

    return output.getvalue()


def get_research_data_dictionary() -> dict[str, Any]:
    """Returns thesis-compliant data dictionary and variable codebook."""
    return {
        "title": "FLUENTT Experimental Research Data Dictionary",
        "version": "1.0.0",
        "updated_at": "2026-10-20T00:00:00Z",
        "ethics_disclaimer": ETHICS_DISCLAIMER,
        "anonymization_standard": "Pseudonymous participant code (no direct identifiers). Pre-withdrawal records permanently preserved.",
        "variables": [
            {
                "name": "participant_code",
                "type": "string",
                "format": "P-[TAG|ENG]-[HEX6]",
                "description": "Cryptographically generated unique participant pseudonym.",
            },
            {
                "name": "study_code",
                "type": "string",
                "description": "Unique research protocol code (e.g. FLUENTT-EXP-TAG-2026).",
            },
            {
                "name": "condition",
                "type": "string",
                "allowed_values": ["sm2_control", "esr_experimental", "unallocated"],
                "description": "Assigned experimental arm (SM-2 classic vs ESR/FIFAKT hybrid).",
            },
            {
                "name": "enrollment_status",
                "type": "string",
                "allowed_values": ["enrolled", "withdrawn", "completed"],
                "description": "Final participation state under approved protocol.",
            },
            {
                "name": "pre_test_score",
                "type": "float",
                "range": [0.0, 10.0],
                "description": "Baseline assessment score administered prior to learning intervention.",
            },
            {
                "name": "post_test_score",
                "type": "float",
                "range": [0.0, 10.0],
                "description": "Summative assessment score administered immediately post-intervention.",
            },
            {
                "name": "absolute_learning_gain",
                "type": "float",
                "formula": "post_test_score - pre_test_score",
                "description": "Raw score change between baseline and summative post-test.",
            },
            {
                "name": "normalized_learning_gain",
                "type": "float",
                "formula": "(post_test_score - pre_test_score) / (10.0 - pre_test_score)",
                "description": "Hake's normalized learning gain relative to maximum possible improvement.",
            },
            {
                "name": "retention_score",
                "type": "float",
                "range": [0.0, 10.0],
                "description": "Delayed retention score administered 14 days post-intervention.",
            },
            {
                "name": "retention_loss",
                "type": "float",
                "formula": "post_test_score - retention_score",
                "description": "Memory decay measure over the 14-day delay interval.",
            },
            {
                "name": "pronunciation_score",
                "type": "float",
                "range": [0.0, 10.0],
                "description": "Acoustic Goodness-of-Pronunciation (GOP) speech evaluation score.",
            },
            {
                "name": "recall_rating",
                "type": "string",
                "allowed_values": ["again", "hard", "good", "easy"],
                "description": "Spaced repetition subjective recall response classification.",
            },
            {
                "name": "response_duration_ms",
                "type": "integer",
                "unit": "milliseconds",
                "description": "Elapsed latency from item display to participant response submission.",
            },
        ],
        "missing_data_codes": {
            "NA": "Data point not evaluable, skipped, or participant withdrew prior to administration.",
            "unallocated": "Participant enrolled but not yet assigned to an experimental condition.",
        },
    }
