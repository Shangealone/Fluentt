"""Teacher metadata must describe the frozen migrated PostgreSQL schema."""
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import CheckConstraint, inspect

import app.models  # noqa: F401 -- register all mapped tables
from app.db.base import Base


def test_teacher_metadata_matches_migrated_schema(pg_engine):
    teacher_tables = {
        "teacher_lessons", "teacher_lesson_versions", "teacher_lesson_questions",
        "teacher_lesson_shares", "teacher_lesson_mutations",
    }
    with pg_engine.connect() as connection:
        def include_object(obj, name, type_, reflected, compare_to):
            if type_ == "table":
                return name in teacher_tables or name == "questions"
            if type_ == "foreign_key_constraint" and obj.table.name == "questions":
                return any(column.name == "teacher_lesson_id" for column in obj.columns)
            return obj.table.name in teacher_tables if hasattr(obj, "table") else True

        context = MigrationContext.configure(connection, opts={"include_object": include_object})
        assert compare_metadata(context, Base.metadata) == []
        checks = {table: {item["sqltext"] for item in inspect(connection).get_check_constraints(table)}
                  for table in teacher_tables}
        metadata_checks = {table: {str(c.sqltext) for c in Base.metadata.tables[table].constraints
                                   if isinstance(c, CheckConstraint)} for table in teacher_tables}
        assert "revision > 0" in metadata_checks["teacher_lessons"]
        assert "jsonb_typeof(sections) = 'array'" in metadata_checks["teacher_lesson_versions"]
        assert "ordinal > 0" in metadata_checks["teacher_lesson_shares"]
        assert any("revision > 0" in check for check in checks["teacher_lessons"])
        assert any("jsonb_typeof(sections)" in check for check in checks["teacher_lesson_versions"])
        assert any("ordinal > 0" in check for check in checks["teacher_lesson_shares"])
