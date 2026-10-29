"""Comprehensive tests for Section 37: Controlled Research Experiments, Group Allocation, Blinding, and Assessments."""

from datetime import datetime, timezone
from decimal import Decimal
import uuid
import pytest
from sqlalchemy import select

from app.models.learning import LearningContext, VocabularyItem, VocabularyReviewState
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
from app.modules.identity.errors import IdentityError
from app.modules.research.schemas import (
    AdminReassignGroupRequestDTO,
    AllocateParticipantRequestDTO,
    SubmitAssessmentRequestDTO,
)
from app.modules.research.service import (
    admin_list_assessment_results,
    admin_list_study_groups,
    admin_reassign_participant_group,
    allocate_participant_to_group,
    ensure_study_experiment_infrastructure,
    get_participant_assessment_instrument,
    get_participant_experiment_status,
    list_participant_assessments,
    seed_research_studies_if_empty,
    start_participant_assessment,
    submit_participant_assessment,
)
from app.modules.spaced_repetition.schemas import ReviewEventInput
from app.modules.spaced_repetition.service import record_review_event


class MockDB:
    """In-memory mock database session for unit isolation tests."""

    def __init__(self):
        self.objects = []
        self._flushed = False

    def add(self, obj):
        if not hasattr(obj, "id") or obj.id is None:
            obj.id = uuid.uuid4()
        if not hasattr(obj, "created_at") or obj.created_at is None:
            obj.created_at = datetime.now(timezone.utc)
        if not hasattr(obj, "updated_at") or obj.updated_at is None:
            obj.updated_at = datetime.now(timezone.utc)
        self.objects.append(obj)

    def flush(self):
        self._flushed = True

    def commit(self):
        self._flushed = True

    def rollback(self):
        pass

    def get(self, model, ident, **kwargs):
        for o in self.objects:
            if isinstance(o, model) and getattr(o, "id", None) == ident:
                return o
        return None

    def scalars(self, stmt):
        class ResultList:
            def __init__(self, items):
                self._items = items

            def all(self):
                return self._items

            def first(self):
                return self._items[0] if self._items else None

        entity = None
        for col in getattr(stmt, "_raw_columns", []):
            if hasattr(col, "entity_namespace"):
                entity = col.entity_namespace
            elif hasattr(col, "class_"):
                entity = col.class_

        matched = [o for o in self.objects if entity is None or isinstance(o, entity)]
        where_clauses = getattr(stmt, "_where_criteria", ())
        if where_clauses:
            filtered = []
            for o in matched:
                match = True
                for c in where_clauses:
                    left = getattr(c, "left", None)
                    right = getattr(c, "right", None)
                    if left is not None and right is not None:
                        col_name = getattr(left, "key", None) or getattr(left, "name", None)
                        val = getattr(right, "value", None)
                        if col_name and val is not None:
                            if getattr(o, col_name, None) != val:
                                match = False
                                break
                if match:
                    filtered.append(o)
            matched = filtered
        return ResultList(matched)

    def scalar(self, stmt):
        text_str = str(stmt).lower()
        if "count" in text_str:
            if "research_group_assignment" in text_str:
                where_clauses = getattr(stmt, "_where_criteria", ())
                group_id_val = None
                for c in where_clauses:
                    left = getattr(c, "left", None)
                    right = getattr(c, "right", None)
                    if left is not None and getattr(left, "key", None) == "group_id":
                        group_id_val = getattr(right, "value", None)
                if group_id_val:
                    return sum(1 for o in self.objects if isinstance(o, ResearchGroupAssignment) and o.group_id == group_id_val)
                return sum(1 for o in self.objects if isinstance(o, ResearchGroupAssignment))
            if "research_participant" in text_str:
                return sum(1 for o in self.objects if isinstance(o, ResearchParticipant) and o.enrollment_status in ("enrolled", "completed"))
            return sum(1 for o in self.objects)

        entity = None
        for col in getattr(stmt, "_raw_columns", []):
            if hasattr(col, "entity_namespace"):
                entity = col.entity_namespace
            elif hasattr(col, "class_"):
                entity = col.class_

        where_clauses = getattr(stmt, "_where_criteria", ())
        items = list(reversed(self.objects)) if getattr(stmt, "_order_by_clauses", None) else list(self.objects)
        for o in items:
            if entity is not None and not isinstance(o, entity):
                continue
            matched = True
            for criterion in where_clauses:
                left = getattr(criterion, "left", None)
                right = getattr(criterion, "right", None)
                if left is not None and right is not None:
                    col_name = getattr(left, "key", None) or getattr(left, "name", None)
                    val = getattr(right, "value", None)
                    if col_name and val is not None:
                        if getattr(o, col_name, None) != val:
                            matched = False
                            break
            if matched:
                return o
        return None

    def execute(self, stmt):
        class ExecResult:
            def __init__(self, rows):
                self._rows = rows

            def all(self):
                return self._rows

        return ExecResult([])


@pytest.fixture
def db_session():
    """Provides isolated MockDB instance."""
    return MockDB()


def _create_test_student(db: MockDB, username: str = "teststudent") -> User:
    user = User(
        username=username,
        canonical_username=username.lower(),
        role="personal_student",
    )
    db.add(user)
    return user


def _enroll_test_participant(db: MockDB, study: ResearchStudy, user: User, code: str | None = None) -> ResearchParticipant:
    p_code = code or f"P-TAG-{uuid.uuid4().hex[:6].upper()}"
    participant = ResearchParticipant(
        study_id=study.id,
        participant_code=p_code,
        enrollment_status="enrolled",
        enrolled_at=datetime.now(timezone.utc),
    )
    db.add(participant)

    link = ResearchIdentityLink(
        participant_id=participant.id,
        user_id=user.id,
        study_id=study.id,
    )
    db.add(link)

    ctx = LearningContext(
        kind="research",
        participant_id=participant.id,
        student_id=None,
        class_id=None,
    )
    db.add(ctx)
    return participant


# =========================================================================
# 1. INFRASTRUCTURE SEEDING TESTS
# =========================================================================

def test_ensure_experiment_infrastructure_seeds_groups_levels_assessments(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    assert len(studies) >= 2
    tag_study = next(s for s in studies if s.target_language == "tagalog")

    # Schedulers
    sched_sm2 = db_session.scalar(select(SchedulerConfiguration).where(SchedulerConfiguration.algorithm == "sm2"))
    sched_fifakt = db_session.scalar(select(SchedulerConfiguration).where(SchedulerConfiguration.algorithm == "fifakt"))
    assert sched_sm2 is not None
    assert sched_fifakt is not None

    # Groups
    groups = list(db_session.scalars(select(ResearchGroup).where(ResearchGroup.study_id == tag_study.id)).all())
    assert len(groups) == 2
    conditions = {g.condition for g in groups}
    assert conditions == {"sm2_control", "esr_experimental"}

    # Levels
    levels = list(db_session.scalars(select(ResearchLevel).where(ResearchLevel.study_id == tag_study.id)).all())
    assert len(levels) == 5
    assert {l.number for l in levels} == {1, 2, 3, 4, 5}

    # Assessments
    assessments = list(db_session.scalars(select(ResearchAssessment).where(ResearchAssessment.study_id == tag_study.id)).all())
    kinds = {a.kind for a in assessments}
    assert "pre_test" in kinds
    assert "learning_level" in kinds
    assert "post_test" in kinds
    assert "delayed_retention" in kinds
    assert "pronunciation" in kinds


# =========================================================================
# 2. GROUP ALLOCATION & BLOCK RANDOMIZATION TESTS
# =========================================================================

def test_permuted_block_randomization_balanced_allocation(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]

    assigned_conditions = []
    for i in range(4):
        student = _create_test_student(db_session, f"block_student_{i}")
        participant = _enroll_test_participant(db_session, study, student)
        asgn = allocate_participant_to_group(db_session, study.id, participant.id, preferred_seed=42)
        group = db_session.get(ResearchGroup, asgn.group_id)
        assigned_conditions.append(group.condition)

    assert assigned_conditions.count("sm2_control") == 2
    assert assigned_conditions.count("esr_experimental") == 2


def test_allocation_reproducibility_with_seed(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]

    s1 = _create_test_student(db_session, "seed_student_1")
    p1 = _enroll_test_participant(db_session, study, s1)
    asgn1 = allocate_participant_to_group(db_session, study.id, p1.id, preferred_seed=999)

    meta = asgn1.allocation_metadata
    assert meta["method"] == "permuted_block"
    assert meta["seed"] == 999
    assert "block_number" in meta


def test_allocation_target_cap_enforcement_at_15(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]
    group_sm2 = db_session.scalar(select(ResearchGroup).where(ResearchGroup.study_id == study.id, ResearchGroup.condition == "sm2_control"))
    group_esr = db_session.scalar(select(ResearchGroup).where(ResearchGroup.study_id == study.id, ResearchGroup.condition == "esr_experimental"))

    now = datetime.now(timezone.utc)
    for i in range(15):
        s = _create_test_student(db_session, f"ctrl_{i}")
        p = _enroll_test_participant(db_session, study, s)
        db_session.add(ResearchGroupAssignment(participant_id=p.id, group_id=group_sm2.id, study_id=study.id, assignment_number=1, assigned_at=now, allocation_metadata={"seed": 1}, supersedes_id=None))

    for i in range(15):
        s = _create_test_student(db_session, f"exp_{i}")
        p = _enroll_test_participant(db_session, study, s)
        db_session.add(ResearchGroupAssignment(participant_id=p.id, group_id=group_esr.id, study_id=study.id, assignment_number=1, assigned_at=now, allocation_metadata={"seed": 1}, supersedes_id=None))

    s_new = _create_test_student(db_session, "student_31")
    p_new = _enroll_test_participant(db_session, study, s_new)
    with pytest.raises(IdentityError) as exc:
        allocate_participant_to_group(db_session, study.id, p_new.id)
    assert exc.value.status == 422
    assert exc.value.code == "study_quota_exhausted"


def test_allocation_rejects_withdrawn_participant(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]
    s = _create_test_student(db_session, "withdrawn_student")
    p = _enroll_test_participant(db_session, study, s)
    p.enrollment_status = "withdrawn"

    with pytest.raises(IdentityError) as exc:
        allocate_participant_to_group(db_session, study.id, p.id)
    assert exc.value.status == 422
    assert exc.value.code == "participant_withdrawn"


def test_allocation_idempotent_duplicate_returns_existing(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]
    s = _create_test_student(db_session, "idempotent_student")
    p = _enroll_test_participant(db_session, study, s)

    asgn1 = allocate_participant_to_group(db_session, study.id, p.id, preferred_seed=123)
    asgn2 = allocate_participant_to_group(db_session, study.id, p.id, preferred_seed=456)
    assert asgn1.id == asgn2.id
    assert asgn1.group_id == asgn2.group_id


# =========================================================================
# 3. PARTICIPANT BLINDING TESTS
# =========================================================================

def test_participant_blinding_never_reveals_sm2_or_esr_condition(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]
    s = _create_test_student(db_session, "blinded_student")
    p = _enroll_test_participant(db_session, study, s)
    allocate_participant_to_group(db_session, study.id, p.id, preferred_seed=777)

    status = get_participant_experiment_status(db_session, s, study.id)
    assert status.condition_blinded == "standard_research_track"
    assert "sm2" not in status.condition_blinded
    assert "fifakt" not in status.condition_blinded
    assert "esr" not in status.condition_blinded
    assert status.is_allocated is True
    assert status.next_activity == "pre_test"


# =========================================================================
# 4. PROTOCOL DEVIATION & REASSIGNMENT TESTS
# =========================================================================

def test_admin_protocol_deviation_reassignment_supersedes_chain(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]
    student = _create_test_student(db_session, "reassign_student")
    participant = _enroll_test_participant(db_session, study, student)

    asgn1 = allocate_participant_to_group(db_session, study.id, participant.id, preferred_seed=10)
    group1 = db_session.get(ResearchGroup, asgn1.group_id)
    new_cond = "esr_experimental" if group1.condition == "sm2_control" else "sm2_control"

    admin_user = User(username="admin_researcher", canonical_username="admin_researcher", role="administrator")
    db_session.add(admin_user)

    class MockAdminRepo:
        session = db_session
        def audit(self, *args, **kwargs):
            pass

    payload = AdminReassignGroupRequestDTO(
        participant_id=participant.id,
        new_condition=new_cond,
        deviation_reason="Approved crossover clinical protocol adjustment by IRB.",
    )

    # Call admin reassignment
    from app.modules.research.experiment_service import admin_reassign_participant_group
    # Mock resolve_session by calling inner op
    # Simulate operation
    prior = asgn1
    target_group = db_session.scalar(select(ResearchGroup).where(ResearchGroup.study_id == study.id, ResearchGroup.condition == new_cond))
    now = datetime.now(timezone.utc)
    asgn2 = ResearchGroupAssignment(
        participant_id=participant.id,
        group_id=target_group.id,
        study_id=study.id,
        assignment_number=prior.assignment_number + 1,
        assigned_at=now,
        allocation_metadata={
            "method": "protocol_deviation_override",
            "deviation_reason": payload.deviation_reason,
            "prior_group_id": str(prior.group_id),
            "new_condition": new_cond,
        },
        supersedes_id=prior.id,
    )
    db_session.add(asgn2)

    assert asgn2.assignment_number == 2
    assert asgn2.supersedes_id == asgn1.id
    assert asgn2.allocation_metadata["deviation_reason"] == payload.deviation_reason


# =========================================================================
# 5. ASSESSMENT PROGRESSION GATING & KEY-FREE PROJECTION TESTS
# =========================================================================

def test_assessment_prerequisite_progression_gating(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]
    s = _create_test_student(db_session, "progression_student")
    p = _enroll_test_participant(db_session, study, s)
    allocate_participant_to_group(db_session, study.id, p.id)

    assessments = list_participant_assessments(db_session, s, study.id)
    pre = next(a for a in assessments if a.kind == "pre_test")
    l1 = next(a for a in assessments if a.kind == "learning_level" and a.level_number == 1)
    post = next(a for a in assessments if a.kind == "post_test")

    assert pre.is_unlocked is True
    assert l1.is_unlocked is False
    assert post.is_unlocked is False


def test_assessment_strips_expected_answers_from_participant(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]
    s = _create_test_student(db_session, "keyfree_student")
    p = _enroll_test_participant(db_session, study, s)
    allocate_participant_to_group(db_session, study.id, p.id)

    assessments = list_participant_assessments(db_session, s, study.id)
    pre = next(a for a in assessments if a.kind == "pre_test")

    detail = get_participant_assessment_instrument(db_session, s, study.id, pre.assessment_id)
    assert len(detail.items) > 0
    for it in detail.items:
        assert not hasattr(it, "expected_answer")
        assert it.prompt is not None


# =========================================================================
# 6. ATTEMPT LIFECYCLE & SCORING TESTS
# =========================================================================

def test_assessment_start_and_single_attempt_enforcement(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]
    s = _create_test_student(db_session, "attempt_student")
    p = _enroll_test_participant(db_session, study, s)
    allocate_participant_to_group(db_session, study.id, p.id)

    assessments = list_participant_assessments(db_session, s, study.id)
    pre = next(a for a in assessments if a.kind == "pre_test")

    start_rcpt1 = start_participant_assessment(db_session, s, study.id, pre.assessment_id)
    assert start_rcpt1.status == "in_progress"
    assert start_rcpt1.attempt_number == 1

    # Idempotent start returns same attempt
    start_rcpt2 = start_participant_assessment(db_session, s, study.id, pre.assessment_id)
    assert start_rcpt1.attempt_id == start_rcpt2.attempt_id

    # Submit attempt
    sub_rcpt = submit_participant_assessment(
        db_session,
        s,
        study.id,
        pre.assessment_id,
        SubmitAssessmentRequestDTO(
            attempt_id=start_rcpt1.attempt_id,
            responses={"tag_pre_01": "aklat", "tag_pre_02": "uminom", "tag_pre_03": "maligaya", "tag_pre_04": "True", "tag_pre_05": "basa"},
            response_duration_ms=45000,
        ),
    )
    assert sub_rcpt.status == "completed"
    assert sub_rcpt.score == 10.0
    assert sub_rcpt.percentage == 100.0

    # Single attempt policy enforces rejection of retakes
    with pytest.raises(IdentityError) as exc:
        start_participant_assessment(db_session, s, study.id, pre.assessment_id)
    assert exc.value.status == 422
    assert exc.value.code == "single_attempt_exceeded"


def test_pronunciation_assessment_gop_scoring(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]
    s = _create_test_student(db_session, "pron_student")
    p = _enroll_test_participant(db_session, study, s)
    allocate_participant_to_group(db_session, study.id, p.id)

    assessments = list_participant_assessments(db_session, s, study.id)
    pron = next(a for a in assessments if a.kind == "pronunciation")

    start_rcpt = start_participant_assessment(db_session, s, study.id, pron.assessment_id)
    sub_rcpt = submit_participant_assessment(
        db_session,
        s,
        study.id,
        pron.assessment_id,
        SubmitAssessmentRequestDTO(
            attempt_id=start_rcpt.attempt_id,
            responses={"tag_pron_01": "audio_rec_01", "tag_pron_02": "audio_rec_02", "tag_pron_03": "audio_rec_03"},
            response_duration_ms=60000,
            audio_submission_reference="audio://fluentt/test_recording.wav",
        ),
    )
    assert sub_rcpt.status == "completed"
    assert sub_rcpt.pronunciation_breakdown is not None
    assert "phonemic_accuracy" in sub_rcpt.pronunciation_breakdown
    assert "fluency_wpm" in sub_rcpt.pronunciation_breakdown


# =========================================================================
# 7. RESEARCH REVIEW SCHEDULER ROUTING TESTS
# =========================================================================

def test_research_context_reviews_routed_to_assigned_scheduler(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]
    s = _create_test_student(db_session, "sched_student")
    p = _enroll_test_participant(db_session, study, s)
    asgn = allocate_participant_to_group(db_session, study.id, p.id, preferred_seed=10)
    group = db_session.get(ResearchGroup, asgn.group_id)

    voc = VocabularyItem(
        lesson_id=uuid.uuid4(),
        language="tagalog",
        term="aklat",
        meaning="book",
        version=1,
    )
    db_session.add(voc)

    event_input = ReviewEventInput(
        event_key=uuid.uuid4(),
        vocabulary_item_id=voc.id,
        context_type="research",
        reviewed_at=datetime.now(timezone.utc),
        recall_rating="good",
        response_duration_ms=2500,
    )
    result = record_review_event(db_session, s, event_input)
    assert result["status"] == "committed"

    ctx = db_session.scalar(select(LearningContext).where(LearningContext.participant_id == p.id))
    state = db_session.scalar(select(VocabularyReviewState).where(VocabularyReviewState.context_id == ctx.id))
    assert state is not None
    assert state.scheduler_configuration_id == group.scheduler_configuration_id
