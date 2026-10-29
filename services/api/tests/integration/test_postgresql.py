from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from app.db.base import Base
from app.models.assessments import (
    Assignment,
    AssignmentVersion,
    AssignmentQuestion,
    AssignmentAttempt,
    StudentResponse,
    Question,
    QuestionRevision,
    QuestionAnswerKey,
)
from app.models.learning import LearningContext, VocabularyItem, VocabularyReviewState, VocabularyReviewEvent
from app.models.research import (
    ResearchStudy,
    ResearchParticipant,
    ResearchIdentityLink,
    ResearchGroup,
    ResearchGroupAssignment,
    ResearchAssessment,
    ResearchAssessmentResult,
    SchedulerConfiguration,
)
from app.models.users import UserSession, ClassJoinCode, ClassMembership
from tests.integration.conftest import ROOT
from tests.test_question_config import EXAMPLES

pytestmark = pytest.mark.postgresql


def now():
    return datetime.now(timezone.utc)


def reject(db, operation):
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            operation()
            db.flush()


def test_users_and_sessions(db, graph):
    student = graph["student"]
    assert student.canonical_username == "syntheticstudent"
    reject(
        db,
        lambda: db.execute(text("INSERT INTO users(username, role) VALUES ('SYNTHETICSTUDENT', 'personal_student')")),
    )
    reject(db, lambda: db.execute(text("INSERT INTO users(username) VALUES ('MissingRole')")))
    session = graph["add"](
        UserSession(
            user_id=student.id,
            credential_digest="a" * 64,
            expires_at=now() + timedelta(days=1),
            absolute_expires_at=now() + timedelta(days=2),
        )
    )
    assert session.user.id == student.id
    reject(
        db,
        lambda: graph["add"](
            UserSession(
                user_id=uuid4(),
                credential_digest="b" * 64,
                expires_at=now() + timedelta(days=1),
                absolute_expires_at=now() + timedelta(days=2),
            )
        ),
    )


def test_classes_codes_memberships(db, graph):
    classroom, student = graph["classroom"], graph["student"]
    code = graph["add"](ClassJoinCode(class_id=classroom.id, code="001234"))
    assert code.code == "001234"
    reject(db, lambda: graph["add"](ClassJoinCode(class_id=classroom.id, code="12345")))
    reject(db, lambda: graph["add"](ClassJoinCode(class_id=classroom.id, code="001234")))
    membership = graph["add"](ClassMembership(class_id=classroom.id, student_id=student.id))
    assert membership.classroom.instructor_id == graph["instructor"].id
    reject(db, lambda: graph["add"](ClassMembership(class_id=classroom.id, student_id=student.id)))
    membership.status = "left"
    db.flush()
    graph["add"](ClassMembership(class_id=classroom.id, student_id=student.id))


def test_curriculum_hierarchy_and_uniqueness(db, graph):
    from app.models.curriculum import GradeLevel, Lesson

    assert graph["lesson"].topic_id == graph["topic"].id
    assert graph["classroom"].language == "tagalog" and graph["subject"].name == "Filipino"
    assert graph["version"].verification_status == "unverified"
    reject(db, lambda: graph["add"](GradeLevel(number=13, name="Invalid")))
    reject(db, lambda: graph["add"](Lesson(topic_id=graph["topic"].id, name="Duplicate order", position=1)))


def make_question(graph):
    question = graph["add"](Question(author_id=graph["instructor"].id))
    revision = graph["add"](
        QuestionRevision(
            question_id=question.id,
            lesson_id=graph["lesson"].id,
            version=1,
            method="true_false",
            language="tagalog",
            prompt="Synthetic prompt",
            content={},
        )
    )
    graph["add"](QuestionAnswerKey(question_revision_id=revision.id, configuration={"value": True}))
    return revision


def test_question_types_and_configuration(db, graph):
    revision = make_question(graph)
    assert db.get(
        QuestionAnswerKey,
        db.execute(
            text("SELECT id FROM question_answer_keys WHERE question_revision_id=:id"), {"id": revision.id}
        ).scalar_one(),
    ).configuration == {"value": True}
    reject(
        db,
        lambda: db.execute(
            text("UPDATE question_revisions SET method='unsupported' WHERE id=:id"), {"id": revision.id}
        ),
    )


@pytest.mark.parametrize("method,content,key", EXAMPLES)
def test_all_ten_methods_roundtrip_jsonb(db, graph, method, content, key):
    question = graph["add"](Question(author_id=graph["instructor"].id))
    revision = graph["add"](
        QuestionRevision(
            question_id=question.id,
            lesson_id=graph["lesson"].id,
            version=1,
            method=method,
            language="english",
            prompt="Synthetic test",
            content=content,
        )
    )
    answer_key = graph["add"](QuestionAnswerKey(question_revision_id=revision.id, configuration=key))
    db.expire_all()
    assert db.get(QuestionRevision, revision.id).content == content
    assert db.get(QuestionAnswerKey, answer_key.id).configuration == key
    revision.locked_at = now()
    db.flush()
    reject(
        db,
        lambda: db.execute(
            text("UPDATE question_answer_keys SET configuration='{}'::jsonb WHERE question_revision_id=:id"),
            {"id": revision.id},
        ),
    )
    reject(
        db, lambda: db.execute(text("UPDATE question_revisions SET prompt='Changed' WHERE id=:id"), {"id": revision.id})
    )


def test_assignment_attempt_and_response_history(db, graph):
    revision = make_question(graph)
    revision.locked_at = now()
    db.flush()
    assignment = graph["add"](Assignment(class_id=graph["classroom"].id, instructor_id=graph["instructor"].id))
    version = graph["add"](
        AssignmentVersion(
            assignment_id=assignment.id,
            lesson_id=graph["lesson"].id,
            version=1,
            title="Synthetic assignment",
            curriculum_snapshot={"source": "synthetic"},
        )
    )
    item = graph["add"](
        AssignmentQuestion(assignment_version_id=version.id, question_revision_id=revision.id, position=1, points=1)
    )
    version.locked_at = now()
    db.flush()
    attempt = graph["add"](
        AssignmentAttempt(
            assignment_version_id=version.id, student_id=graph["student"].id, attempt_number=1, started_at=now()
        )
    )
    graph["add"](
        StudentResponse(
            attempt_id=attempt.id,
            assignment_question_id=item.id,
            assignment_version_id=version.id,
            answer={"value": True},
        )
    )
    reject(
        db,
        lambda: graph["add"](
            StudentResponse(
                attempt_id=attempt.id,
                assignment_question_id=item.id,
                assignment_version_id=version.id,
                answer={"value": False},
            )
        ),
    )
    reject(
        db,
        lambda: graph["add"](
            AssignmentAttempt(
                assignment_version_id=version.id, student_id=graph["student"].id, attempt_number=1, started_at=now()
            )
        ),
    )
    reject(db, lambda: db.execute(text("UPDATE assignment_questions SET points=100 WHERE id=:id"), {"id": item.id}))


def test_vocabulary_state_and_append_only_events(db, graph):
    context = graph["add"](LearningContext(student_id=graph["student"].id, kind="personal"))
    item = graph["add"](
        VocabularyItem(lesson_id=graph["lesson"].id, language="tagalog", term="synthetic", meaning="Test only")
    )
    scheduler = graph["add"](
        SchedulerConfiguration(algorithm="sm2", implementation_version="synthetic-v1", configuration_version=1)
    )
    state = graph["add"](
        VocabularyReviewState(
            context_id=context.id,
            vocabulary_item_id=item.id,
            scheduler_configuration_id=scheduler.id,
            due_at=now(),
            state={"interval": 0},
        )
    )
    event = graph["add"](
        VocabularyReviewEvent(
            review_state_id=state.id,
            scheduler_configuration_id=scheduler.id,
            event_key=uuid4(),
            reviewed_at=now(),
            recall_rating="good",
            response_duration_ms=1200,
            previous_interval_seconds=0,
            resulting_interval_seconds=86400,
            state_revision=1,
            previous_state={"interval": 0},
            resulting_state={"interval": 1},
            simulated=True,
        )
    )
    assert db.get(LearningContext, state.context_id).student_id == graph["student"].id
    assert event.resulting_interval_seconds == Decimal("86400")
    reject(db, lambda: db.execute(text("DELETE FROM vocabulary_review_events WHERE id=:id"), {"id": event.id}))


def test_research_relationships_and_private_identity(db, graph):
    study = graph["add"](
        ResearchStudy(
            code="synthetic-study",
            title="Synthetic study",
            target_language="english",
            protocol_version="test-v1",
            target_participants=40,
        )
    )
    participant = graph["add"](ResearchParticipant(study_id=study.id, participant_code="SYN-001"))
    graph["add"](ResearchIdentityLink(participant_id=participant.id, study_id=study.id, user_id=graph["student"].id))
    scheduler = graph["add"](
        SchedulerConfiguration(algorithm="sm2", implementation_version="research-test", configuration_version=1)
    )
    group = graph["add"](
        ResearchGroup(
            study_id=study.id, condition="sm2_control", target_size=20, scheduler_configuration_id=scheduler.id
        )
    )
    allocation = graph["add"](
        ResearchGroupAssignment(
            participant_id=participant.id,
            group_id=group.id,
            study_id=study.id,
            assignment_number=1,
            assigned_at=now(),
            allocation_metadata={"simulated": True},
        )
    )
    assessment = graph["add"](ResearchAssessment(study_id=study.id, kind="pre_test", instrument_version="synthetic-v1"))
    result = graph["add"](
        ResearchAssessmentResult(
            assessment_id=assessment.id,
            participant_id=participant.id,
            study_id=study.id,
            attempt_number=1,
            started_at=now(),
            status="in_progress",
        )
    )
    assert result.participant_id == participant.id and "user_id" not in ResearchParticipant.__table__.c
    graph["add"](LearningContext(kind="research", participant_id=participant.id))
    reject(
        db,
        lambda: graph["add"](
            LearningContext(kind="research", student_id=graph["student"].id, participant_id=participant.id)
        ),
    )
    other_study = graph["add"](
        ResearchStudy(
            code="other-synthetic", title="Other synthetic study", target_language="english", protocol_version="test-v1"
        )
    )
    other_participant = graph["add"](ResearchParticipant(study_id=other_study.id, participant_code="OTHER-001"))
    reject(
        db,
        lambda: graph["add"](
            ResearchAssessmentResult(
                assessment_id=assessment.id,
                participant_id=other_participant.id,
                study_id=study.id,
                attempt_number=1,
                started_at=now(),
                status="in_progress",
            )
        ),
    )
    reject(db, lambda: db.execute(text("DELETE FROM research_group_assignments WHERE id=:id"), {"id": allocation.id}))
    study.locked_at = now()
    db.flush()
    reject(
        db,
        lambda: db.execute(
            text("UPDATE research_studies SET target_language='tagalog' WHERE id=:id"), {"id": study.id}
        ),
    )


def test_migration_upgrade_downgrade_round_trip(pg_engine):
    # Runs only on the fresh UUID database created by pg_engine, never a developer DB.
    with pg_engine.begin() as connection:
        inspector = inspect(connection)
        for table in Base.metadata.sorted_tables:
            assert inspector.has_table(table.name, schema=table.schema)
        context = MigrationContext.configure(
            connection,
            opts={
                "include_schemas": True,
                "include_object": lambda obj, name, type_, reflected, compare_to: not (
                    type_ == "table" and name == "alembic_version"
                ),
            },
        )
        assert compare_metadata(context, Base.metadata) == []
        config = Config(str(ROOT / "alembic.ini"))
        config.attributes["connection"] = connection
        command.downgrade(config, "base")
        assert not inspect(connection).has_table("users")
        config.attributes["repair_initial_names"] = True
        command.upgrade(config, "head")
        assert inspect(connection).has_table("users")
