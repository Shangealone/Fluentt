"""Synthetic contracts only; no database connection or live classroom writes."""
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.dialects.postgresql import dialect

from app.modules.classrooms.schemas import ClassCreate, ClassUpdate
from app.modules.curriculum.repository import filters, path_statement, visible
from app.modules.curriculum.schemas import BrowseQuery, ClassContext
from app.modules.enrollment.repository import EnrollmentRepository, preview_version
from app.modules.teacher_lessons.source import teacher_context, lesson_catalog
from tests.classroom_support import MemoryClassroomRepository
from app.core.config import Settings
from app.modules.classrooms.service import create_class, update_class
from app.modules.identity.errors import IdentityError
from app.modules.identity.schemas import RegistrationRequest
from app.modules.identity.user_service import create_user


@pytest.mark.parametrize("level", [None, "beginner", "intermediate", "advanced"])
def test_optional_grade_and_assessment_label(level):
    row = ClassCreate(class_name="Synthetic", language="english", proficiency_level=level)
    assert row.grade_level is None and row.proficiency_level == level
    assert ClassUpdate(proficiency_level=None).model_fields_set == {"proficiency_level"}


@pytest.mark.parametrize("level", ["easy", "A1", "Beginner", 1, True])
def test_no_inferred_or_unknown_assessment_labels(level):
    with pytest.raises(ValidationError):
        ClassCreate(class_name="Synthetic", language="english", proficiency_level=level)


def test_create_retry_and_context_bound_correction():
    repo = MemoryClassroomRepository()
    settings = Settings(_env_file=None, environment="test", database_url=None)
    def instructor():
        return create_user(repo, RegistrationRequest(username="Teacher_" + uuid4().hex[:10],
                           role="instructor", password="SyntheticPass123!"), settings).session.credential
    token = instructor()
    key = uuid4()
    body = ClassCreate(class_name="Synthetic", language="english", proficiency_level="beginner")
    first = create_class(repo, token, settings, body, key)
    assert first.grade_level is None and first.proficiency_level == "beginner"
    assert create_class(repo, token, settings, body, key) == first
    with pytest.raises(IdentityError) as conflict:
        create_class(repo, token, settings, body.model_copy(update={"proficiency_level": "advanced"}), key)
    assert conflict.value.status == 409
    repo.contexts.add(first.id)
    corrected = update_class(repo, token, settings, first.id, ClassUpdate(proficiency_level="intermediate"))
    assert corrected.proficiency_level == "intermediate"
    for payload in [ClassUpdate(language="tagalog"), ClassUpdate(grade_level=4)]:
        with pytest.raises(IdentityError) as conflict:
            update_class(repo, token, settings, first.id, payload)
        assert conflict.value.status == 409
    with pytest.raises(IdentityError) as denied:
        update_class(repo, instructor(), settings, first.id, ClassUpdate(proficiency_level="advanced"))
    assert denied.value.status == 404
    assert update_class(repo, token, settings, first.id, ClassUpdate(proficiency_level=None)).proficiency_level is None


def test_null_grade_enrollment_projection_and_registration_freshness():
    now = datetime.now(timezone.utc)
    classroom = SimpleNamespace(id=uuid4(), class_name="Synthetic", grade_level_id=None,
                                proficiency_level="beginner", language="english", instructor_id=uuid4(), updated_at=now)
    class Session:
        def get(self, *_):
            pytest.fail("Nullable classroom grade must not be dereferenced")
        def scalar(self, *_):
            return "Synthetic instructor"
    repo = EnrollmentRepository(Session())
    description = repo.describe_class(classroom)
    assert description.grade_level is None and description.proficiency_level == "beginner"
    code = SimpleNamespace(id=uuid4(), updated_at=now)
    before = preview_version(classroom, code, description, [])
    classroom.proficiency_level = "advanced"
    assert preview_version(classroom, code, repo.describe_class(classroom), []) != before


@pytest.mark.parametrize("depth", range(7))
def test_class_browsing_preserves_subject_and_ancestry_without_grade_filter(depth):
    context = ClassContext(class_id=uuid4(), grade_level_id=None, subject_id=uuid4(),
                           language="english", requires_subject=False)
    sql = str(path_statement(depth).where(*visible(depth), *filters(depth, BrowseQuery(), context))
              .compile(dialect=dialect(), compile_kwargs={"literal_binds": True}))
    assert str(context.subject_id) in sql
    assert "grade_level_id IS NULL" not in sql
    assert "curriculum_versions.status = 'published'" in sql
    if depth >= 5:
        assert "lessons.archived_at IS NULL" in sql


def test_teacher_selection_keeps_owner_share_language_and_subject_without_class_grade():
    classroom = SimpleNamespace(id=uuid4(), instructor_id=uuid4(), grade_level_id=None,
                                language="english", subject_id=uuid4())
    class Session:
        def scalar(self, statement):
            self.statement = statement
            return None
        def execute(self, statement):
            self.statement = statement
            return SimpleNamespace(all=lambda: [])
    db = Session()
    assert teacher_context(db, classroom, uuid4()) is None
    sql = str(db.statement.compile(dialect=dialect(), compile_kwargs={"literal_binds": True}))
    for expected in [str(classroom.id), str(classroom.instructor_id), str(classroom.subject_id),
                     "teacher_lesson_versions.language = 'english'", "published_at IS NOT NULL", "archived_at IS NULL"]:
        assert expected in sql
    assert "grade_level_id IS NULL" not in sql
    lesson_catalog(db, classroom, SimpleNamespace(q=None, offset=0, limit=20))
    sql = str(db.statement.compile(dialect=dialect(), compile_kwargs={"literal_binds": True}))
    assert "grade_level_id IS NULL" not in sql
    assert "curriculum_versions.status = 'published'" in sql
    assert str(classroom.id) in sql and str(classroom.subject_id) in sql


def deployed_teacher_guard():
    """Reconstruct only the frozen function source and the reviewed 0020 patch."""
    import ast
    import importlib.util
    from pathlib import Path

    versions = Path(__file__).parents[1] / "migrations/versions"
    tree = ast.parse((versions / "0019_teacher_lessons.py").read_text())
    definitions = [node.value for node in ast.walk(tree) if isinstance(node, ast.Constant)
                   and isinstance(node.value, str)
                   and node.value.startswith("CREATE FUNCTION fluentt_guard_teacher_content()")]
    assert len(definitions) == 1
    spec = importlib.util.spec_from_file_location("teacher_dispatch", versions / "0020_teacher_trigger_dispatch.py")
    dispatch = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(dispatch)
    assert definitions[0].count(dispatch.OLD) == 1
    return definitions[0].replace(dispatch.OLD, dispatch.NEW, 1).replace(
        "CREATE FUNCTION ", "CREATE OR REPLACE FUNCTION ", 1)


def test_additive_migration_sql_preserves_grades_and_has_one_checked_optional_label(monkeypatch):
    import importlib.util
    from io import StringIO
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from app.db.base import Base
    from app.models.users import Classroom

    migration_path = Path(__file__).parents[1] / "migrations/versions/0022_class_proficiency.py"
    spec = importlib.util.spec_from_file_location("class_proficiency_migration", migration_path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.down_revision == "0021_esr_vocabulary_review"
    definition = deployed_teacher_guard()
    monkeypatch.setattr(migration.op, "get_bind", lambda: SimpleNamespace(
        exec_driver_sql=lambda _: SimpleNamespace(scalar_one=lambda: definition)))
    output = StringIO()
    context = MigrationContext.configure(dialect_name="postgresql", opts={
        "as_sql": True, "output_buffer": output, "target_metadata": Base.metadata,
    })
    with Operations.context(context):
        migration.upgrade()
    sql = output.getvalue()
    assert "ALTER COLUMN grade_level_id DROP NOT NULL" in sql
    assert "ADD COLUMN proficiency_level VARCHAR(20)" in sql
    assert "ADD CONSTRAINT ck_classes_proficiency_level CHECK" in sql
    assert "UPDATE classes" not in sql and "DELETE FROM classes" not in sql
    assert "ALTER TABLE grade_levels" not in sql
    assert migration.OLD_SHARE_CONTEXT not in sql
    assert migration.NEW_SHARE_CONTEXT in sql
    assert "instructor_id=owner" in sql and "v.published_at IS NULL" in sql
    assert Classroom.__table__.c.grade_level_id.nullable
    assert Classroom.__table__.c.proficiency_level.nullable


@pytest.mark.parametrize("occurrences", [0, 1, 2])
def test_migration_replaces_exactly_one_guard_clause_and_preserves_every_other_byte(monkeypatch, occurrences):
    import importlib.util
    from pathlib import Path

    path = Path(__file__).parents[1] / "migrations/versions/0022_class_proficiency.py"
    spec = importlib.util.spec_from_file_location("class_proficiency_guard", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    definition = deployed_teacher_guard()
    assert definition.count(migration.OLD_SHARE_CONTEXT) == 1
    if occurrences == 0:
        definition = definition.replace(migration.OLD_SHARE_CONTEXT, migration.NEW_SHARE_CONTEXT)
    elif occurrences == 2:
        definition += migration.OLD_SHARE_CONTEXT
    statements = []
    monkeypatch.setattr(migration.op, "get_bind", lambda: SimpleNamespace(
        exec_driver_sql=lambda _: SimpleNamespace(scalar_one=lambda: definition)))
    monkeypatch.setattr(migration.op, "execute", statements.append)
    if occurrences != 1:
        with pytest.raises(RuntimeError, match="review before changing"):
            migration.replace_teacher_share_context(migration.OLD_SHARE_CONTEXT, migration.NEW_SHARE_CONTEXT)
        assert statements == []
    else:
        migration.replace_teacher_share_context(migration.OLD_SHARE_CONTEXT, migration.NEW_SHARE_CONTEXT)
        assert statements == [definition.replace(migration.OLD_SHARE_CONTEXT, migration.NEW_SHARE_CONTEXT, 1)]
        upgraded = statements[0]
        assert upgraded.replace(migration.NEW_SHARE_CONTEXT, migration.OLD_SHARE_CONTEXT, 1) == definition
