from types import SimpleNamespace
from uuid import uuid4
import pytest
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql
from app.modules.assignments.schemas import Query
from app.modules.teacher_lessons.source import lesson_catalog


def catalog_sql(source=None):
    captured = []
    class Database:
        def execute(self, statement):
            captured.append(statement)
            return SimpleNamespace(all=lambda: [])
    classroom = SimpleNamespace(id=uuid4(), instructor_id=uuid4(), subject_id=uuid4(), language="english")
    lesson_catalog(Database(), classroom, Query(source=source, offset=20, limit=20))
    return str(captured[0].compile(dialect=postgresql.dialect()))


def test_administrator_filter_is_applied_before_pagination():
    sql = catalog_sql("curriculum")
    assert "teacher_lesson_versions" not in sql
    assert "curriculum_subjects.subject_id" in sql
    assert "LIMIT" in sql and "OFFSET" in sql


def test_existing_builder_catalog_still_includes_both_sources():
    assert "UNION ALL" in catalog_sql()
    with pytest.raises(ValidationError):
        Query(source="unrestricted")
