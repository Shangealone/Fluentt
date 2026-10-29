"""Repairs never run on an occupied database; renames preserve stored rows."""

import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import inspect, text

from scripts.bootstrap_names import require_empty

pytestmark = pytest.mark.postgresql


def test_bootstrap_option_refuses_existing_schema_and_keeps_rows(db, graph):
    student = graph["student"]
    with pytest.raises(RuntimeError, match="empty database"):
        require_empty(db.connection())
    assert (
        db.execute(text("SELECT username FROM users WHERE id=:id"), {"id": student.id}).scalar_one() == student.username
    )


def test_forward_revision_renames_only_constraint_and_keeps_rows(db, graph):
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location(
        "name_revision", root / "migrations/versions/0005_constraint_names.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    db.execute(
        text("""ALTER TABLE learning_competencies
        RENAME CONSTRAINT uq_learning_competencies_lesson_code TO legacy_operator_competency_code""")
    )
    db.execute(
        text("""INSERT INTO learning_competencies(lesson_id,code,description,position)
        VALUES (:lesson,'synthetic-preserved','Synthetic fixture',1)"""),
        {"lesson": graph["lesson"].id},
    )
    with Operations.context(MigrationContext.configure(db.connection())):
        module.upgrade()
        module.upgrade()  # Safe when names already match.
    names = {item["name"] for item in inspect(db.connection()).get_unique_constraints("learning_competencies")}
    assert "uq_learning_competencies_lesson_code" in names
    assert (
        db.execute(text("SELECT count(*) FROM learning_competencies WHERE code='synthetic-preserved'")).scalar_one()
        == 1
    )
