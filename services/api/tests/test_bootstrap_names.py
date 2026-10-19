"""Naming repair is a narrow, explicit adapter, never a frozen-file rewrite."""

from sqlalchemy.dialects.postgresql import dialect
from sqlalchemy.schema import CreateTable

from app.db.base import Base
from scripts.bootstrap_names import REPAIRS, repair_statement
from tests.test_schema import migration_module


def test_adapter_changes_exactly_three_declarations_and_is_idempotent():
    original = migration_module().SCHEMA_SQL
    changed = [statement for statement in original if repair_statement(statement) != statement]
    assert len(changed) == 3
    for before, after in REPAIRS:
        assert sum(statement.count(before) for statement in original) == 1
        assert sum(repair_statement(statement).count(after) for statement in original) == 1
    assert all(repair_statement(repair_statement(sql)) == repair_statement(sql) for sql in original)
    assert repair_statement("SELECT 'CONSTRAINT uq_learning_competencies_lesson_id'") == (
        "SELECT 'CONSTRAINT uq_learning_competencies_lesson_id'"
    )


def test_postgresql_constraint_names_are_unique_per_table():
    compiler = dialect().ddl_compiler(dialect(), None)
    for table in Base.metadata.sorted_tables:
        names = [compiler.preparer.format_constraint(constraint) for constraint in table.constraints]
        assert len(names) == len(set(names)), table.name
        assert str(CreateTable(table).compile(dialect=dialect()))
