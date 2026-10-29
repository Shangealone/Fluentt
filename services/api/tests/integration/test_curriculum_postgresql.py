"""Synthetic fixtures in the shared generated UUID database, never in an existing developer DB."""

import pytest
from sqlalchemy import select, text, update
from sqlalchemy.exc import IntegrityError

from app.models.curriculum import (
    CurriculumVersion,
    CurriculumGrade,
    CurriculumSubject,
    Quarter,
    CurriculumTopic,
    Lesson,
    LearningCompetency,
    GradeLevel,
    Subject,
)
from app.models.users import ClassMembership, User
from app.models.assessments import Assignment, AssignmentVersion
from app.modules.curriculum.repository import CurriculumRepository
from app.modules.curriculum.schemas import BrowseQuery
from app.modules.administration.repository import AdminRepository
from app.modules.administration.cli import provision, curriculum_permission
from app.modules.administration.service import issue_session, resolve_session
from app.modules.identity.errors import IdentityError

pytestmark = pytest.mark.postgresql


def publish(db, graph, *, topic="published", lesson="published"):
    graph["topic"].status = topic
    graph["lesson"].status = lesson
    db.flush()  # Prepare children BEFORE publishing/freezing their root.
    graph["version"].status = "published"
    db.flush()


def test_actual_hierarchy_reads_order_and_projections(db, graph):
    add = graph["add"]
    second = add(Lesson(topic_id=graph["topic"].id, name="Synthetic second lesson", position=2, status="published"))
    competency = add(
        LearningCompetency(
            lesson_id=graph["lesson"].id, code="synthetic-c1", description="Synthetic fixture competency", position=1
        )
    )
    publish(db, graph)
    repo = CurriculumRepository(db)
    repo.structure_read_lock()
    query = BrowseQuery(limit=1)
    lessons, more = repo.rows("lessons", graph["topic"].id, query, None, False)
    assert more and [row.id for row in lessons] == [graph["lesson"].id]
    lessons, more = repo.rows("lessons", graph["topic"].id, BrowseQuery(limit=1, offset=1), None, False)
    assert not more and [row.id for row in lessons] == [second.id]
    assert repo.detail("competencies", competency.id, query, None, False).code == "synthetic-c1"
    subject = repo.rows("subjects", db.scalar(select(CurriculumSubject.curriculum_grade_id)), query, None, False)[0][0]
    assert subject.subject_id == graph["subject"].id and subject.name == "Filipino"
    assert "source_metadata" not in repo.detail("versions", graph["version"].id, query, None, False).model_dump()


@pytest.mark.parametrize("ancestor", ["version", "topic", "lesson"])
def test_mobile_cannot_read_draft_ancestor_or_descendant(db, graph, ancestor):
    if ancestor != "version":
        publish(
            db,
            graph,
            topic="draft" if ancestor == "topic" else "published",
            lesson="draft" if ancestor == "lesson" else "published",
        )
    repo = CurriculumRepository(db)
    with pytest.raises(IdentityError):
        repo.detail("lessons", graph["lesson"].id, BrowseQuery(), None, False)
    assert repo.detail("lessons", graph["lesson"].id, BrowseQuery(), None, True).id == graph["lesson"].id


def test_retirement_hides_version_but_preserves_identifiers(db, graph):
    publish(db, graph)
    original = graph["lesson"].id
    graph["version"].status = "archived"
    db.flush()
    repo = CurriculumRepository(db)
    assert repo.rows("versions", None, BrowseQuery(), None, False)[0] == []
    assert repo.detail("lessons", original, BrowseQuery(), None, True).id == original
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.execute(
                update(CurriculumVersion).where(CurriculumVersion.id == graph["version"].id).values(status="draft")
            )


@pytest.mark.parametrize("target", ["version", "grade", "subject", "quarter", "topic", "lesson"])
def test_database_freezes_published_hierarchy_and_shared_labels(db, graph, target):
    publish(db, graph)
    model = {
        "version": CurriculumVersion,
        "grade": GradeLevel,
        "subject": Subject,
        "quarter": Quarter,
        "topic": CurriculumTopic,
        "lesson": Lesson,
    }[target]
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.execute(update(model).where(model.id == graph[target].id).values(name="Attempted fixture rewrite"))


def test_cannot_append_or_move_into_or_out_of_frozen_snapshot(db, graph):
    other = graph["add"](CurriculumTopic(quarter_id=graph["quarter"].id, name="Synthetic draft topic", position=2))
    publish(db, graph)
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            graph["add"](Lesson(topic_id=graph["topic"].id, name="Late fixture lesson", position=2))
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.execute(update(Lesson).where(Lesson.id == graph["lesson"].id).values(topic_id=other.id))


def test_draft_order_parent_and_delete_constraints_remain_authoritative(db, graph):
    from uuid import uuid4

    with pytest.raises(IntegrityError):
        with db.begin_nested():
            graph["add"](Lesson(topic_id=graph["topic"].id, name="Duplicate fixture", position=1))
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            graph["add"](Lesson(topic_id=uuid4(), name="Missing fixture parent", position=1))
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.execute(text("DELETE FROM curriculum_topics WHERE id=:id"), {"id": graph["topic"].id})


def test_legacy_assigned_draft_also_cannot_be_rewritten(db, graph):
    assignment = graph["add"](Assignment(class_id=graph["classroom"].id, instructor_id=graph["instructor"].id))
    graph["add"](
        AssignmentVersion(
            assignment_id=assignment.id, lesson_id=graph["lesson"].id, version=1, title="Synthetic legacy assignment"
        )
    )
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.execute(update(Lesson).where(Lesson.id == graph["lesson"].id).values(name="Historical rewrite"))


@pytest.mark.parametrize("status", ["active", "left", "removed"])
def test_class_owner_membership_and_context_filters(db, graph, status):
    from datetime import datetime, timezone

    graph["add"](
        ClassMembership(
            class_id=graph["classroom"].id,
            student_id=graph["student"].id,
            status=status,
            ended_at=None if status == "active" else datetime.now(timezone.utc),
        )
    )
    publish(db, graph)
    repo = CurriculumRepository(db)
    if status != "active":
        with pytest.raises(IdentityError):
            repo.class_context(graph["student"], graph["classroom"].id)
    else:
        context = repo.class_context(graph["student"], graph["classroom"].id)
        assert context.language == "tagalog" and context.subject_id == graph["subject"].id
        assert len(repo.rows("versions", None, BrowseQuery(), context, False)[0]) == 1
        assert repo.rows("versions", None, BrowseQuery(grade=4), context, False)[0] == []
    other = graph["add"](User(username="OtherFixtureTeacher", role="instructor"))
    with pytest.raises(IdentityError):
        repo.class_context(other, graph["classroom"].id)


def test_unconfigured_class_subject_returns_empty_without_language_inference(db, graph):
    publish(db, graph)
    graph["classroom"].subject_id = None
    db.flush()
    repo = CurriculumRepository(db)
    context = repo.class_context(graph["instructor"], graph["classroom"].id)
    assert context.requires_subject and context.language == "tagalog"
    assert repo.rows("versions", None, BrowseQuery(), context, False)[0] == []


def test_explicit_operator_permission_grant_and_revoke(db):
    repo = AdminRepository(db)
    provision(repo, "CurriculumFixtureAdmin", "https://id.example", "fixture-subject")
    token = issue_session(repo, "https://id.example", "fixture-subject")
    with pytest.raises(IdentityError) as error:
        resolve_session(repo, token, required_permission="curriculum.read", read_operation=lambda user: user.id)
    assert error.value.status == 403
    curriculum_permission(repo, "CurriculumFixtureAdmin", grant=True)
    curriculum_permission(repo, "CurriculumFixtureAdmin", grant=True)  # Idempotent; no privilege duplication.
    assert resolve_session(repo, token, required_permission="curriculum.read", read_operation=lambda user: user.id)
    curriculum_permission(repo, "CurriculumFixtureAdmin", grant=False)
    with pytest.raises(IdentityError):
        resolve_session(repo, token, required_permission="curriculum.read", read_operation=lambda user: user.id)


def test_reader_lock_blocks_concurrent_curriculum_writer(db, pg_engine):
    CurriculumRepository(db).structure_read_lock()
    with pg_engine.begin() as other:
        assert other.scalar(text("SELECT pg_try_advisory_xact_lock(78090001)")) is False


def test_new_edition_uses_new_child_ids_and_old_history_stays_addressable(db, graph):
    publish(db, graph)
    add = graph["add"]
    version = add(CurriculumVersion(code="synthetic-v2", name="Synthetic new edition"))
    grade = add(CurriculumGrade(curriculum_version_id=version.id, grade_level_id=graph["grade"].id))
    subject = add(CurriculumSubject(curriculum_grade_id=grade.id, subject_id=graph["subject"].id))
    quarter = add(Quarter(curriculum_subject_id=subject.id, number=1, name="Synthetic quarter"))
    topic = add(CurriculumTopic(quarter_id=quarter.id, position=1, name="Synthetic new topic", status="published"))
    lesson = add(Lesson(topic_id=topic.id, position=1, name="Synthetic new lesson", status="published"))
    version.status = "published"
    db.flush()
    repo = CurriculumRepository(db)
    assert repo.detail("lessons", graph["lesson"].id, BrowseQuery(), None, False).name == graph["lesson"].name
    assert repo.detail("lessons", lesson.id, BrowseQuery(), None, False).id != graph["lesson"].id


def test_class_context_applies_to_direct_descendant_ids_too(db, graph):
    add = graph["add"]
    other_grade = db.scalar(select(GradeLevel).where(GradeLevel.number == 4))
    if other_grade is None:
        other_grade = add(GradeLevel(number=4, name="Synthetic grade four"))
    grade = add(CurriculumGrade(curriculum_version_id=graph["version"].id, grade_level_id=other_grade.id))
    subject = add(CurriculumSubject(curriculum_grade_id=grade.id, subject_id=graph["subject"].id))
    quarter = add(Quarter(curriculum_subject_id=subject.id, number=1, name="Synthetic other quarter"))
    topic = add(CurriculumTopic(quarter_id=quarter.id, position=1, name="Synthetic other topic", status="published"))
    lesson = add(Lesson(topic_id=topic.id, position=1, name="Synthetic other lesson", status="published"))
    publish(db, graph)
    repo = CurriculumRepository(db)
    context = repo.class_context(graph["instructor"], graph["classroom"].id)
    with pytest.raises(IdentityError):
        repo.detail("lessons", lesson.id, BrowseQuery(), context, False)
    assert repo.detail("lessons", lesson.id, BrowseQuery(), None, False).id == lesson.id


def test_permission_revoke_does_not_affect_other_reader(db):
    repo = AdminRepository(db)
    provision(repo, "FixtureReaderA", "https://id.example", "fixture-reader-a")
    provision(repo, "FixtureReaderB", "https://id.example", "fixture-reader-b")
    curriculum_permission(repo, "FixtureReaderA", grant=True)
    curriculum_permission(repo, "FixtureReaderB", grant=True)
    token = issue_session(repo, "https://id.example", "fixture-reader-b")
    curriculum_permission(repo, "FixtureReaderA", grant=False)
    assert resolve_session(repo, token, required_permission="curriculum.read", read_operation=lambda user: user.id)


def test_permission_grant_refuses_a_role_with_unapproved_privileges(db):
    from app.models.users import AdminPermission, AdminRole, AdminRolePermission

    repo = AdminRepository(db)
    provision(repo, "FixtureReaderA", "https://id.example", "fixture-reader-a")
    provision(repo, "FixtureReaderB", "https://id.example", "fixture-reader-b")
    curriculum_permission(repo, "FixtureReaderA", grant=True)
    role = db.scalar(select(AdminRole).where(AdminRole.name == "curriculum_reader"))
    permission = AdminPermission(code="synthetic.unapproved")
    db.add(permission)
    db.flush()
    db.add(AdminRolePermission(role_id=role.id, permission_id=permission.id))
    db.commit()
    with pytest.raises(ValueError, match="unexpected permissions"):
        curriculum_permission(repo, "FixtureReaderB", grant=True)
