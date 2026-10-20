"""Comprehensive tests for Section 36: Research Participant Management,

testing consent versioning, authorized enrollment, pseudonymous identifiers,
duplicate prevention, withdrawal lifecycle, re-enrollment prohibition,
and privacy-isolated identity links.
"""

from datetime import datetime, timezone
import pytest
from unittest.mock import MagicMock
from uuid import uuid4

from app.models.learning import LearningContext
from app.models.operations import AuditLog
from app.models.research import (
    ResearchConsentRecord,
    ResearchEvent,
    ResearchIdentityLink,
    ResearchParticipant,
    ResearchStudy,
)
from app.models.users import User
from app.modules.identity.errors import IdentityError
from app.modules.research.schemas import (
    CreateStudyRequestDTO,
    EnrollmentRequestDTO,
    ETHICS_DISCLAIMER,
    RETENTION_POLICY_NOTICE,
    WithdrawalRequestDTO,
)
from app.modules.research.service import (
    admin_create_study,
    admin_list_participants,
    admin_list_studies,
    admin_lock_study_protocol,
    admin_reveal_identity,
    admin_withdraw_participant,
    check_participant_eligibility,
    enroll_participant,
    generate_pseudonymous_participant_code,
    get_available_studies,
    get_consent_document,
    get_participant_status,
    get_study_or_fail,
    seed_research_studies_if_empty,
    withdraw_participant,
)


class MockDB:
    """In-memory mock database session for unit isolation tests."""

    def __init__(self):
        self.objects = []
        self._flushed = False

    def add(self, obj):
        if not hasattr(obj, "id") or obj.id is None:
            obj.id = uuid4()
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
            if isinstance(o, model) and o.id == ident:
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

        # Filter by entity type in stmt
        entity = None
        for col in getattr(stmt, "_raw_columns", []):
            if hasattr(col, "entity_namespace"):
                entity = col.entity_namespace
            elif hasattr(col, "class_"):
                entity = col.class_

        matched = [o for o in self.objects if entity is None or isinstance(o, entity)]
        return ResultList(matched)

    def scalar(self, stmt):
        # Handle count or simple filter
        text_str = str(stmt).lower()
        if "count" in text_str:
            if "research_participants" in text_str:
                return sum(1 for o in self.objects if isinstance(o, ResearchParticipant) and o.enrollment_status in ("enrolled", "completed"))
            return 0

        entity = None
        for col in getattr(stmt, "_raw_columns", []):
            if hasattr(col, "entity_namespace"):
                entity = col.entity_namespace
            elif hasattr(col, "class_"):
                entity = col.class_

        where_clauses = getattr(stmt, "_where_criteria", ())
        for o in self.objects:
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

            def fetchall(self):
                return self._rows

        return ExecResult([])


@pytest.fixture
def db():
    mock_db = MockDB()
    seed_research_studies_if_empty(mock_db)
    return mock_db


@pytest.fixture
def student_user():
    user = User(
        username="learner_juan",
        role="personal_student",
        profile_status="active",
    )
    user.id = uuid4()
    user.canonical_username = "learner_juan"
    user.preferred_language = "tagalog"
    return user


@pytest.fixture
def school_student():
    user = User(
        username="school_maria",
        role="school_student",
        profile_status="active",
    )
    user.id = uuid4()
    user.canonical_username = "school_maria"
    user.preferred_language = "english"
    return user


def test_seed_research_studies_creates_tagalog_and_english(db):
    studies = db.scalars(None).all()
    study_codes = {s.code for s in studies if isinstance(s, ResearchStudy)}
    assert "FLUENTT-EXP-TAG-2026" in study_codes
    assert "FLUENTT-EXP-ENG-2026" in study_codes

    # Idempotent
    count_before = len([s for s in db.objects if isinstance(s, ResearchStudy)])
    seed_research_studies_if_empty(db)
    count_after = len([s for s in db.objects if isinstance(s, ResearchStudy)])
    assert count_before == count_after


def test_get_available_studies_metadata(db, student_user):
    studies = get_available_studies(db, student_user)
    assert len(studies) >= 2
    tag_study = next(s for s in studies if s.code == "FLUENTT-EXP-TAG-2026")
    assert tag_study.target_language == "tagalog"
    assert tag_study.protocol_version == "thesis-protocol-tag-v1.0"
    assert tag_study.target_participants == 30
    assert tag_study.status == "active"


def test_get_consent_document_and_ethics_disclaimer(db):
    studies = [o for o in db.objects if isinstance(o, ResearchStudy)]
    study = studies[0]
    doc = get_consent_document(db, study.id)
    assert doc.study_code == study.code
    assert doc.protocol_version == study.protocol_version
    assert doc.ethics_statement == ETHICS_DISCLAIMER
    assert "software consent recording" in doc.ethics_statement.lower()
    assert "not constitute independent" in doc.ethics_statement.lower()
    assert doc.retention_notice == RETENTION_POLICY_NOTICE


def test_check_participant_eligibility_valid_and_invalid(db, student_user):
    study = next(o for o in db.objects if isinstance(o, ResearchStudy) and o.target_language == "tagalog")

    # 1. Valid personal student
    eligibility = check_participant_eligibility(db, student_user, study.id)
    assert eligibility.eligible is True
    assert eligibility.recruitment_open is True
    assert eligibility.quota_available is True
    assert eligibility.target_language_match is True

    # 2. Ineligible role (instructor)
    instructor = User(username="teacher_ana", role="instructor", profile_status="active")
    instructor.id = uuid4()
    instructor_eligibility = check_participant_eligibility(db, instructor, study.id)
    assert instructor_eligibility.eligible is False
    assert any("student accounts" in r for r in instructor_eligibility.reasons)

    # 3. Inactive study status
    study.status = "archived"
    archived_eligibility = check_participant_eligibility(db, student_user, study.id)
    assert archived_eligibility.eligible is False
    assert archived_eligibility.recruitment_open is False
    study.status = "active"


def test_generate_pseudonymous_participant_code_format(db):
    study = next(o for o in db.objects if isinstance(o, ResearchStudy) and o.target_language == "tagalog")
    code = generate_pseudonymous_participant_code(db, study)
    assert code.startswith("P-TAG-")
    assert len(code) == 12  # P-TAG-XXXXXX (6 hex chars)
    # Ensure uppercase
    assert code == code.upper()


def test_enroll_participant_consent_validation_failures(db, student_user):
    study = next(o for o in db.objects if isinstance(o, ResearchStudy) and o.target_language == "tagalog")

    # Mismatched protocol version
    with pytest.raises(IdentityError) as exc_info:
        enroll_participant(
            db,
            student_user,
            study.id,
            EnrollmentRequestDTO(
                protocol_version="invalid-protocol-v9.9",
                consent_decision="granted",
                affirmation_confirmed=True,
            ),
        )
    assert exc_info.value.status == 422
    assert exc_info.value.code == "protocol_version_mismatch"

    # Missing affirmation confirmation
    with pytest.raises(IdentityError) as exc_info:
        enroll_participant(
            db,
            student_user,
            study.id,
            EnrollmentRequestDTO(
                protocol_version=study.protocol_version,
                consent_decision="granted",
                affirmation_confirmed=False,
            ),
        )
    assert exc_info.value.status == 422
    assert exc_info.value.code == "consent_required"


def test_enroll_participant_atomic_creation_and_privacy_isolation(db, student_user):
    study = next(o for o in db.objects if isinstance(o, ResearchStudy) and o.target_language == "tagalog")

    receipt = enroll_participant(
        db,
        student_user,
        study.id,
        EnrollmentRequestDTO(
            protocol_version=study.protocol_version,
            consent_kind="consent",
            consent_decision="granted",
            affirmation_confirmed=True,
        ),
    )

    assert receipt.study_code == study.code
    assert receipt.protocol_version == study.protocol_version
    assert receipt.enrollment_status == "enrolled"
    assert receipt.participant_code.startswith("P-TAG-")
    # Verify no student username in participant code
    assert student_user.username not in receipt.participant_code

    # Check ResearchParticipant created
    participant = next(o for o in db.objects if isinstance(o, ResearchParticipant) and o.id == receipt.participant_id)
    assert participant.study_id == study.id
    assert participant.enrollment_status == "enrolled"
    assert participant.eligibility_status == "eligible"
    assert participant.enrolled_at is not None

    # Check ResearchIdentityLink created in research_private
    link = next(o for o in db.objects if isinstance(o, ResearchIdentityLink) and o.participant_id == participant.id)
    assert link.study_id == study.id
    assert link.user_id == student_user.id

    # Check ResearchConsentRecord created with status granted
    consent = next(o for o in db.objects if isinstance(o, ResearchConsentRecord) and o.participant_id == participant.id)
    assert consent.kind == "consent"
    assert consent.status == "granted"
    assert consent.protocol_version == study.protocol_version
    assert consent.evidence_reference.startswith(f"electronic-consent:{study.protocol_version}:")

    # Check LearningContext created with kind='research' and STRICTLY NULL student_id and class_id
    context = next(o for o in db.objects if isinstance(o, LearningContext) and o.participant_id == participant.id)
    assert context.kind == "research"
    assert context.student_id is None
    assert context.class_id is None

    # Check ResearchEvent created
    event = next(o for o in db.objects if isinstance(o, ResearchEvent) and o.participant_id == participant.id)
    assert event.event_type == "participant_enrolled"

    # Check AuditLog created
    audit = next(o for o in db.objects if isinstance(o, AuditLog) and o.entity_id == participant.id)
    assert audit.action == "research.participant_enrolled"
    assert audit.actor_id == student_user.id
    # Ensure safe metadata (no sensitive personal info)
    assert audit.safe_metadata["study_code"] == study.code


def test_duplicate_enrollment_prevention(db, student_user):
    study = next(o for o in db.objects if isinstance(o, ResearchStudy) and o.target_language == "tagalog")

    # First enrollment succeeds
    enroll_participant(
        db,
        student_user,
        study.id,
        EnrollmentRequestDTO(
            protocol_version=study.protocol_version,
            consent_decision="granted",
            affirmation_confirmed=True,
        ),
    )

    # Second enrollment fails with 409
    with pytest.raises(IdentityError) as exc_info:
        enroll_participant(
            db,
            student_user,
            study.id,
            EnrollmentRequestDTO(
                protocol_version=study.protocol_version,
                consent_decision="granted",
                affirmation_confirmed=True,
            ),
        )
    assert exc_info.value.status == 409
    assert exc_info.value.code == "already_enrolled"


def test_voluntary_withdrawal_and_re_enrollment_prohibition(db, student_user):
    study = next(o for o in db.objects if isinstance(o, ResearchStudy) and o.target_language == "tagalog")

    receipt = enroll_participant(
        db,
        student_user,
        study.id,
        EnrollmentRequestDTO(
            protocol_version=study.protocol_version,
            consent_decision="granted",
            affirmation_confirmed=True,
        ),
    )

    # Execute withdrawal
    withdraw_receipt = withdraw_participant(
        db,
        student_user,
        study.id,
        WithdrawalRequestDTO(
            reason_category="voluntary_withdrawal",
            notes="Personal scheduling conflict",
        ),
    )
    assert withdraw_receipt.enrollment_status == "withdrawn"
    assert withdraw_receipt.withdrawn_at is not None
    assert "retention policy" in withdraw_receipt.retention_notice.lower()

    # Verify participant record state
    participant = next(o for o in db.objects if isinstance(o, ResearchParticipant) and o.id == receipt.participant_id)
    assert participant.enrollment_status == "withdrawn"
    assert participant.withdrawn_at is not None

    # Verify append-only consent record for withdrawal
    withdrawal_consent = [
        o for o in db.objects if isinstance(o, ResearchConsentRecord) and o.participant_id == participant.id and o.status == "withdrawn"
    ]
    assert len(withdrawal_consent) == 1
    assert "electronic-withdrawal:voluntary_withdrawal" in withdrawal_consent[0].evidence_reference

    # Verify withdrawal event
    withdrawal_event = next(
        o for o in db.objects if isinstance(o, ResearchEvent) and o.participant_id == participant.id and o.event_type == "participant_withdrawn"
    )
    assert withdrawal_event.payload["reason_category"] == "voluntary_withdrawal"

    # Verify withdrawal audit log
    withdrawal_audit = next(
        o for o in db.objects if isinstance(o, AuditLog) and o.entity_id == participant.id and o.action == "research.participant_withdrawn"
    )
    assert withdrawal_audit.safe_metadata["reason_category"] == "voluntary_withdrawal"

    # Attempting to re-enroll in the same study MUST FAIL with 409
    with pytest.raises(IdentityError) as exc_info:
        enroll_participant(
            db,
            student_user,
            study.id,
            EnrollmentRequestDTO(
                protocol_version=study.protocol_version,
                consent_decision="granted",
                affirmation_confirmed=True,
            ),
        )
    assert exc_info.value.status == 409
    assert exc_info.value.code == "re_enrollment_prohibited"


def test_admin_participant_view_and_identity_reveal(db, student_user):
    from unittest.mock import patch
    study = next(o for o in db.objects if isinstance(o, ResearchStudy) and o.target_language == "tagalog")

    receipt = enroll_participant(
        db,
        student_user,
        study.id,
        EnrollmentRequestDTO(
            protocol_version=study.protocol_version,
            consent_decision="granted",
            affirmation_confirmed=True,
        ),
    )

    admin_repo = MagicMock()
    admin_repo.session = db
    admin_user = User(username="dr_investigator", role="administrator", profile_status="active")
    admin_user.id = uuid4()

    def fake_resolve_session(repo, cred, read_operation=None, mutation_operation=None, **kwargs):
        op = read_operation or mutation_operation
        return op(admin_user)

    with patch("app.modules.research.service.resolve_session", side_effect=fake_resolve_session):
        # 1. Test Admin Listing (pseudonymous only)
        participants = admin_list_participants(admin_repo, "valid-token-placeholder", study.id)
        assert len(participants) == 1
        view = participants[0]
        assert view.participant_code == receipt.participant_code
        assert view.enrollment_status == "enrolled"
        # Ensure view does NOT contain username or user_id
        assert not hasattr(view, "username")
        assert not hasattr(view, "user_id")

        # 2. Test Privileged Identity Reveal
        db.objects.append(student_user)  # Ensure user is retrievable by get(User, student_user.id)
        reveal = admin_reveal_identity(admin_repo, "valid-token-placeholder", receipt.participant_id)
        assert reveal.participant_code == receipt.participant_code
        assert reveal.user_id == student_user.id
        assert reveal.username == student_user.username
        assert "CONFIDENTIAL" in reveal.audit_warning

        # Check audit called
        assert admin_repo.audit.called
        call_action = admin_repo.audit.call_args[0][0]
        call_kwargs = admin_repo.audit.call_args.kwargs
        assert call_action == "research.identity_revealed"
        assert call_kwargs["actor"] == admin_user.id
        assert call_kwargs["entity"] == receipt.participant_id
        assert f"participant_code={receipt.participant_code}" in call_kwargs["reason"]


def test_admin_create_and_lock_study(db):
    from unittest.mock import patch

    admin_repo = MagicMock()
    admin_repo.session = db
    admin_user = User(username="dr_investigator", role="administrator", profile_status="active")
    admin_user.id = uuid4()

    def fake_resolve_session(repo, cred, read_operation=None, mutation_operation=None, **kwargs):
        op = read_operation or mutation_operation
        return op(admin_user)

    with patch("app.modules.research.service.resolve_session", side_effect=fake_resolve_session):
        # 1. Create Study
        study_dto = admin_create_study(
            admin_repo,
            "valid-token",
            CreateStudyRequestDTO(
                code="FLUENTT-EXP-CUSTOM-2026",
                title="Custom Experimental Cohort",
                target_language="tagalog",
                protocol_version="protocol-custom-v1",
                target_participants=50,
            ),
        )
        assert study_dto.code == "FLUENTT-EXP-CUSTOM-2026"
        assert study_dto.status == "draft"

        # 2. Lock Protocol
        locked_dto = admin_lock_study_protocol(admin_repo, "valid-token", study_dto.id)
        assert locked_dto.status == "approved"
        assert locked_dto.locked_at is not None

        # Locking again raises 409
        with pytest.raises(IdentityError) as exc_info:
            admin_lock_study_protocol(admin_repo, "valid-token", study_dto.id)
        assert exc_info.value.status == 409
        assert exc_info.value.code == "already_locked"


def test_admin_withdraw_participant(db, student_user):
    from unittest.mock import patch

    study = next(o for o in db.objects if isinstance(o, ResearchStudy) and o.target_language == "tagalog")

    receipt = enroll_participant(
        db,
        student_user,
        study.id,
        EnrollmentRequestDTO(
            protocol_version=study.protocol_version,
            consent_decision="granted",
            affirmation_confirmed=True,
        ),
    )

    admin_repo = MagicMock()
    admin_repo.session = db
    admin_user = User(username="dr_investigator", role="administrator", profile_status="active")
    admin_user.id = uuid4()

    def fake_resolve_session(repo, cred, read_operation=None, mutation_operation=None, **kwargs):
        op = read_operation or mutation_operation
        return op(admin_user)

    with patch("app.modules.research.service.resolve_session", side_effect=fake_resolve_session):
        withdrawn = admin_withdraw_participant(
            admin_repo,
            "valid-token",
            study.id,
            receipt.participant_id,
            WithdrawalRequestDTO(reason_category="administrative_removal", notes="Operator administrative removal"),
        )
        assert withdrawn.enrollment_status == "withdrawn"
        assert withdrawn.withdrawn_at is not None

        # Confirm participant record updated
        participant = db.get(ResearchParticipant, receipt.participant_id)
        assert participant.enrollment_status == "withdrawn"

