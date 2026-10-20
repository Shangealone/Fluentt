"""Unit and integration tests for Section 38 Research Analytics, Reporting, and Secure Exports."""

from datetime import datetime, timezone
from decimal import Decimal
import uuid
import pytest
from sqlalchemy import select

from app.models.learning import LearningContext, VocabularyItem, VocabularyReviewEvent, VocabularyReviewState
from app.models.operations import AuditLog
from app.models.research import (
    ResearchAssessment,
    ResearchAssessmentResult,
    ResearchConsentRecord,
    ResearchGroup,
    ResearchGroupAssignment,
    ResearchIdentityLink,
    ResearchParticipant,
    ResearchStudy,
    SchedulerConfiguration,
)
from app.models.users import User
from app.modules.identity.errors import IdentityError
from app.modules.research.analytics_service import (
    calculate_descriptive_stats,
    compute_study_assessment_metrics,
    compute_study_engagement_metrics,
    compute_study_participant_flow,
    export_assessment_results_csv,
    export_participants_longitudinal_csv,
    export_review_events_csv,
    get_research_data_dictionary,
    get_study_analytics_summary,
    sanitize_csv_cell,
)
from app.modules.research.service import (
    allocate_participant_to_group,
    ensure_study_experiment_infrastructure,
    seed_research_studies_if_empty,
)


class MockDB:
    """In-memory mock database session for unit analytics tests."""

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
                            if isinstance(val, (list, tuple, set)):
                                if getattr(o, col_name, None) not in val:
                                    match = False
                                    break
                            elif getattr(o, col_name, None) != val:
                                match = False
                                break
                    # Handle .in_() clauses
                    elif left is not None and hasattr(c, "right") and hasattr(c.right, "clauses"):
                        col_name = getattr(left, "key", None) or getattr(left, "name", None)
                        in_vals = [getattr(v, "value", None) for v in c.right.clauses]
                        if col_name and getattr(o, col_name, None) not in in_vals:
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
                        if isinstance(val, (list, tuple, set)):
                            if getattr(o, col_name, None) not in val:
                                matched = False
                                break
                        elif getattr(o, col_name, None) != val:
                            matched = False
                            break
                elif left is not None and hasattr(criterion, "right") and hasattr(criterion.right, "clauses"):
                    col_name = getattr(left, "key", None) or getattr(left, "name", None)
                    in_vals = [getattr(v, "value", None) for v in criterion.right.clauses]
                    if col_name and getattr(o, col_name, None) not in in_vals:
                        matched = False
                        break
            if matched:
                return o
        return None


class MockAdminRepo:
    def __init__(self, db: MockDB, permissions: list[str] | None = None):
        self.session = db
        self.permissions = permissions or ["dashboard.view", "research.read", "research.manage"]
        self.audits = []

    def resolve_session(self, token: str):
        if token == "expired_token":
            raise IdentityError(401, "invalid_session", "Session expired")
        return User(id=uuid.uuid4(), username="admin_tester", canonical_username="admin_tester", role="administrator")

    def require_permission(self, token: str, permission: str):
        if permission not in self.permissions:
            raise IdentityError(403, "permission_denied", f"Missing {permission}")

    def audit(self, action: str, occurred_at: datetime, actor=None, entity=None, request_id=None, reason=None):
        self.audits.append({"action": action, "actor": actor, "entity": entity, "reason": reason})


@pytest.fixture
def db_session():
    return MockDB()


def _create_test_student(db: MockDB, name: str) -> User:
    u = User(
        username=name,
        canonical_username=name.lower(),
        role="personal_student",
    )
    db.add(u)
    return u


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
# TESTS: CSV FORMULA INJECTION PREVENTION (CWE-1236)
# =========================================================================

def test_formula_injection_sanitization():
    # Pure numbers (positive and negative) remain unchanged
    assert sanitize_csv_cell(10) == "10"
    assert sanitize_csv_cell(9.5) == "9.5"
    assert sanitize_csv_cell(-1.5) == "-1.5"
    assert sanitize_csv_cell("-4.25") == "-4.25"

    # Formula injection characters prepended with single quote
    assert sanitize_csv_cell("=1+1") == "'=1+1"
    assert sanitize_csv_cell("=SUM(A1:A10)") == "'=SUM(A1:A10)"
    assert sanitize_csv_cell("+cmd|' /C calc'!A0") == "'+cmd|' /C calc'!A0"
    assert sanitize_csv_cell("@HYPERLINK('http://evil.com')") == "'@HYPERLINK('http://evil.com')"
    assert sanitize_csv_cell("-2+cmd|...") == "'-2+cmd|..."
    assert sanitize_csv_cell("%USER%") == "'%USER%"
    assert sanitize_csv_cell("\tTAB_INJECT") == "'\tTAB_INJECT"
    assert sanitize_csv_cell("\rCR_INJECT") == "'\rCR_INJECT"

    # Standard clean text unchanged
    assert sanitize_csv_cell("P-TAG-A4F82C") == "P-TAG-A4F82C"
    assert sanitize_csv_cell("sm2_control") == "sm2_control"
    assert sanitize_csv_cell(None) == ""


# =========================================================================
# TESTS: DESCRIPTIVE STATISTICS
# =========================================================================

def test_descriptive_statistics_calculation():
    # Regular sample N >= 5
    scores = [6.0, 7.0, 8.0, 9.0, 10.0]
    stats = calculate_descriptive_stats(scores, max_possible=10.0)

    assert stats.count == 5
    assert stats.mean == 8.0
    assert stats.median == 8.0
    assert stats.min_value == 6.0
    assert stats.max_value == 10.0
    assert stats.std_dev == 1.58  # sqrt(10 / 4) = 1.5811
    assert stats.mean_percentage == 80.0
    assert stats.is_small_cell is False

    # Small cell N < 5
    small_scores = [8.0, 10.0]
    small_stats = calculate_descriptive_stats(small_scores, max_possible=10.0)
    assert small_stats.count == 2
    assert small_stats.mean == 9.0
    assert small_stats.median == 9.0
    assert small_stats.std_dev == 1.41
    assert small_stats.is_small_cell is True  # flagged for small cell privacy

    # Single score N = 1 (std dev must be None)
    single_stats = calculate_descriptive_stats([7.5], max_possible=10.0)
    assert single_stats.count == 1
    assert single_stats.mean == 7.5
    assert single_stats.std_dev is None
    assert single_stats.is_small_cell is True

    # Empty sample
    empty_stats = calculate_descriptive_stats([])
    assert empty_stats.count == 0
    assert empty_stats.mean is None
    assert empty_stats.std_dev is None
    assert empty_stats.is_small_cell is True


# =========================================================================
# TESTS: PARTICIPANT FLOW (CONSORT COUNTS)
# =========================================================================

def test_participant_flow_computation(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]

    # Create 6 participants
    participants = []
    for i in range(6):
        u = _create_test_student(db_session, f"flow_student_{i}")
        p = _enroll_test_participant(db_session, study, u)
        participants.append(p)

    # Allocate 4 participants (2 control, 2 experimental)
    for i in range(4):
        allocate_participant_to_group(db_session, study.id, participants[i].id, preferred_seed=42)

    # Mark 1 participant as withdrawn with voluntary reason
    participants[4].enrollment_status = "withdrawn"
    participants[4].withdrawn_at = datetime.now(timezone.utc)
    db_session.add(
        ResearchConsentRecord(
            participant_id=participants[4].id,
            kind="consent",
            protocol_version=study.protocol_version,
            status="withdrawn",
            evidence_reference="reason: voluntary_withdrawal",
            recorded_at=datetime.now(timezone.utc),
        )
    )

    flow = compute_study_participant_flow(db_session, study)
    assert flow.total_enrolled == 6
    assert flow.allocated_control == 2
    assert flow.allocated_experimental == 2
    assert flow.active_in_progress == 5
    assert flow.total_withdrawn == 1
    assert flow.withdrawn_by_reason["voluntary_withdrawal"] == 1
    assert flow.dropout_rate_pct == round(1 / 6 * 100, 2)


# =========================================================================
# TESTS: ASSESSMENT DESCRIPTIVE METRICS & PAIRED GAINS
# =========================================================================

def test_assessment_metrics_and_paired_learning_gains(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]

    # Create 4 students and allocate
    p1 = _enroll_test_participant(db_session, study, _create_test_student(db_session, "std_1"))
    p2 = _enroll_test_participant(db_session, study, _create_test_student(db_session, "std_2"))
    p3 = _enroll_test_participant(db_session, study, _create_test_student(db_session, "std_3"))
    p4 = _enroll_test_participant(db_session, study, _create_test_student(db_session, "std_4"))

    asgn1 = allocate_participant_to_group(db_session, study.id, p1.id, preferred_seed=42)
    asgn2 = allocate_participant_to_group(db_session, study.id, p2.id, preferred_seed=42)
    asgn3 = allocate_participant_to_group(db_session, study.id, p3.id, preferred_seed=42)
    asgn4 = allocate_participant_to_group(db_session, study.id, p4.id, preferred_seed=42)

    groups = {g.id: g for g in db_session.scalars(select(ResearchGroup).where(ResearchGroup.study_id == study.id)).all()}
    c1 = groups[asgn1.group_id].condition
    c2 = groups[asgn2.group_id].condition

    assessments = db_session.scalars(select(ResearchAssessment).where(ResearchAssessment.study_id == study.id)).all()
    pre = next(a for a in assessments if a.kind == "pre_test")
    post = next(a for a in assessments if a.kind == "post_test")
    ret = next(a for a in assessments if a.kind == "delayed_retention")

    now = datetime.now(timezone.utc)
    # Add pre-test results
    db_session.add(ResearchAssessmentResult(study_id=study.id, assessment_id=pre.id, participant_id=p1.id, attempt_number=1, started_at=now, completed_at=now, status="completed", score=Decimal("4.00"), maximum_score=Decimal("10.00"), response_duration_ms=30000, responses={}))
    db_session.add(ResearchAssessmentResult(study_id=study.id, assessment_id=pre.id, participant_id=p2.id, attempt_number=1, started_at=now, completed_at=now, status="completed", score=Decimal("5.00"), maximum_score=Decimal("10.00"), response_duration_ms=32000, responses={}))

    # Add post-test results
    db_session.add(ResearchAssessmentResult(study_id=study.id, assessment_id=post.id, participant_id=p1.id, attempt_number=1, started_at=now, completed_at=now, status="completed", score=Decimal("9.00"), maximum_score=Decimal("10.00"), response_duration_ms=28000, responses={}))
    db_session.add(ResearchAssessmentResult(study_id=study.id, assessment_id=post.id, participant_id=p2.id, attempt_number=1, started_at=now, completed_at=now, status="completed", score=Decimal("8.00"), maximum_score=Decimal("10.00"), response_duration_ms=29000, responses={}))

    # Add delayed retention results
    db_session.add(ResearchAssessmentResult(study_id=study.id, assessment_id=ret.id, participant_id=p1.id, attempt_number=1, started_at=now, completed_at=now, status="completed", score=Decimal("8.00"), maximum_score=Decimal("10.00"), response_duration_ms=31000, responses={}))

    asms_stats, paired = compute_study_assessment_metrics(db_session, study)

    pre_comp = next(a for a in asms_stats if a.kind == "pre_test")
    assert pre_comp.overall_stats.count == 2
    assert pre_comp.overall_stats.mean == 4.5
    assert pre_comp.overall_stats.is_small_cell is True

    # Check paired gains exist
    if c1 == "sm2_control":
        assert paired.absolute_gain_control.count >= 1
    else:
        assert paired.absolute_gain_experimental.count >= 1


# =========================================================================
# TESTS: ENGAGEMENT METRICS FROM REVIEW EVENTS
# =========================================================================

def test_engagement_metrics_from_review_events(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]

    s1 = _create_test_student(db_session, "eng_s1")
    p1 = _enroll_test_participant(db_session, study, s1)
    asgn = allocate_participant_to_group(db_session, study.id, p1.id, preferred_seed=42)
    group = db_session.get(ResearchGroup, asgn.group_id)

    voc = VocabularyItem(lesson_id=uuid.uuid4(), language="tagalog", term="aklat", meaning="book", version=1)
    db_session.add(voc)

    ctx = db_session.scalar(select(LearningContext).where(LearningContext.participant_id == p1.id))
    st = VocabularyReviewState(
        context_id=ctx.id,
        vocabulary_item_id=voc.id,
        scheduler_configuration_id=group.scheduler_configuration_id,
        state={"interval": 1},
        due_at=datetime.now(timezone.utc),
    )
    db_session.add(st)

    now = datetime.now(timezone.utc)
    ev1 = VocabularyReviewEvent(
        review_state_id=st.id,
        scheduler_configuration_id=group.scheduler_configuration_id,
        event_key=uuid.uuid4(),
        reviewed_at=now,
        recall_rating="good",
        answer_result={"correct": True},
        response_duration_ms=2500,
        previous_interval_seconds=Decimal("86400"),
        resulting_interval_seconds=Decimal("259200"),
        previous_state={},
        resulting_state={},
        state_revision=1,
    )
    db_session.add(ev1)

    ev2 = VocabularyReviewEvent(
        review_state_id=st.id,
        scheduler_configuration_id=group.scheduler_configuration_id,
        event_key=uuid.uuid4(),
        reviewed_at=now,
        recall_rating="again",
        answer_result={"correct": False},
        response_duration_ms=4000,
        previous_interval_seconds=Decimal("259200"),
        resulting_interval_seconds=Decimal("86400"),
        previous_state={},
        resulting_state={},
        state_revision=2,
    )
    db_session.add(ev2)

    ctrl_eng, exp_eng = compute_study_engagement_metrics(db_session, study)
    target = ctrl_eng if group.condition == "sm2_control" else exp_eng

    assert target.total_review_events == 2
    assert target.active_learners == 1
    assert target.total_lapses == 1  # 1 again
    assert target.rating_counts["good"] == 1
    assert target.retention_accuracy_pct == 50.0  # 1 out of 2 good/easy
    assert target.mean_duration_ms == 3250  # (2500 + 4000) // 2


# =========================================================================
# TESTS: SECURE CSV EXPORTS WITH AUDIT LOGGING
# =========================================================================

def test_export_participants_longitudinal_csv(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]

    s1 = _create_test_student(db_session, "exp_s1")
    p1 = _enroll_test_participant(db_session, study, s1, code="P-TAG-001001")
    allocate_participant_to_group(db_session, study.id, p1.id, preferred_seed=42)

    admin_repo = MockAdminRepo(db_session)
    csv_text = export_participants_longitudinal_csv(db_session, admin_repo, "valid_token", study.id)

    lines = csv_text.strip().split("\n")
    headers = lines[0].split(",")

    assert "participant_code" in headers
    assert "study_code" in headers
    assert "condition" in headers
    assert "post_test_score" in headers

    # Ensure pseudonymous participant code is present and NO user identity/email leaked
    assert "P-TAG-001001" in lines[1]
    assert "exp_s1" not in csv_text
    assert "@" not in csv_text

    # Verify AuditLog created
    audit = next((o for o in db_session.objects if isinstance(o, AuditLog) and o.action == "research.dataset_exported"), None)
    assert audit is not None
    assert audit.safe_metadata["dataset"] == "participants_longitudinal"


def test_export_assessment_results_csv(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]

    s1 = _create_test_student(db_session, "exp_s2")
    p1 = _enroll_test_participant(db_session, study, s1, code="P-TAG-002002")
    allocate_participant_to_group(db_session, study.id, p1.id, preferred_seed=42)

    assessments = db_session.scalars(select(ResearchAssessment).where(ResearchAssessment.study_id == study.id)).all()
    pre = next(a for a in assessments if a.kind == "pre_test")
    now = datetime.now(timezone.utc)
    db_session.add(
        ResearchAssessmentResult(
            study_id=study.id,
            assessment_id=pre.id,
            participant_id=p1.id,
            attempt_number=1,
            started_at=now,
            completed_at=now,
            status="completed",
            score=Decimal("8.50"),
            maximum_score=Decimal("10.00"),
            response_duration_ms=45000,
            responses={"item_1": "aklat"},
        )
    )

    admin_repo = MockAdminRepo(db_session)
    csv_text = export_assessment_results_csv(db_session, admin_repo, "valid_token", study.id)

    lines = csv_text.strip().split("\n")
    headers = lines[0].split(",")

    assert "result_id" in headers
    assert "participant_code" in headers
    assert "percentage" in headers
    assert "P-TAG-002002" in lines[1]
    assert "8.5" in lines[1]
    assert "85.0" in lines[1]


def test_export_review_events_csv(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]

    s1 = _create_test_student(db_session, "exp_s3")
    p1 = _enroll_test_participant(db_session, study, s1, code="P-TAG-003003")
    asgn = allocate_participant_to_group(db_session, study.id, p1.id, preferred_seed=42)
    group = db_session.get(ResearchGroup, asgn.group_id)

    voc = VocabularyItem(lesson_id=uuid.uuid4(), language="tagalog", term="mesa", meaning="table", version=1)
    db_session.add(voc)

    ctx = db_session.scalar(select(LearningContext).where(LearningContext.participant_id == p1.id))
    st = VocabularyReviewState(
        context_id=ctx.id,
        vocabulary_item_id=voc.id,
        scheduler_configuration_id=group.scheduler_configuration_id,
        state={},
        due_at=datetime.now(timezone.utc),
    )
    db_session.add(st)

    db_session.add(
        VocabularyReviewEvent(
            review_state_id=st.id,
            scheduler_configuration_id=group.scheduler_configuration_id,
            event_key=uuid.uuid4(),
            reviewed_at=datetime.now(timezone.utc),
            recall_rating="easy",
            answer_result={"correct": True},
            response_duration_ms=1800,
            previous_interval_seconds=Decimal("86400"),
            resulting_interval_seconds=Decimal("518400"),
            previous_state={},
            resulting_state={},
            state_revision=1,
        )
    )

    admin_repo = MockAdminRepo(db_session)
    csv_text = export_review_events_csv(db_session, admin_repo, "valid_token", study.id)

    lines = csv_text.strip().split("\n")
    headers = lines[0].split(",")

    assert "event_id" in headers
    assert "participant_code" in headers
    assert "vocabulary_term" in headers
    assert "P-TAG-003003" in lines[1]
    assert "mesa" in lines[1]
    assert "easy" in lines[1]


def test_data_dictionary_schema_completeness():
    dd = get_research_data_dictionary()
    assert dd["title"] == "FLUENTT Experimental Research Data Dictionary"
    assert "variables" in dd
    assert len(dd["variables"]) >= 10
    var_names = [v["name"] for v in dd["variables"]]
    assert "participant_code" in var_names
    assert "pre_test_score" in var_names
    assert "post_test_score" in var_names
    assert "normalized_learning_gain" in var_names
    assert "retention_loss" in var_names
    assert "missing_data_codes" in dd


def test_admin_permission_gating_raises_on_unauthorized(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]

    # Repo lacking research.read
    unauthorized_repo = MockAdminRepo(db_session, permissions=["dashboard.view"])
    with pytest.raises(IdentityError) as exc:
        get_study_analytics_summary(db_session, unauthorized_repo, "test_token", study.id)
    assert exc.value.status == 403
    assert exc.value.code == "permission_denied"

    with pytest.raises(IdentityError) as exc:
        export_participants_longitudinal_csv(db_session, unauthorized_repo, "test_token", study.id)
    assert exc.value.status == 403


def test_get_study_analytics_summary_success(db_session: MockDB):
    studies = seed_research_studies_if_empty(db_session)
    study = studies[0]

    s1 = _create_test_student(db_session, "summ_std_1")
    p1 = _enroll_test_participant(db_session, study, s1, code="P-TAG-999001")
    allocate_participant_to_group(db_session, study.id, p1.id, preferred_seed=42)

    admin_repo = MockAdminRepo(db_session, permissions=["dashboard.view", "research.read"])
    summary = get_study_analytics_summary(db_session, admin_repo, "valid_token", study.id)

    assert summary.study_id == study.id
    assert summary.study_code == study.code
    assert summary.flow.total_enrolled >= 1
    assert len(summary.assessments) >= 1
    assert summary.engagement_control is not None
    assert summary.engagement_experimental is not None
    assert summary.paired is not None

