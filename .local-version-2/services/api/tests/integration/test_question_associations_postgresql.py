"""The additive guard refuses inconsistent history without deleting or relabeling it."""

import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.models.assessments import Question, QuestionRevision
from app.models.curriculum import Lesson, LearningCompetency

pytestmark = pytest.mark.postgresql


def test_preflight_refuses_mismatched_history_and_preserves_rows(db, graph):
    spec = importlib.util.spec_from_file_location(
        "association_revision",
        Path(__file__).resolve().parents[2] / "migrations/versions/0006_question_associations.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    add = graph["add"]
    other_lesson = add(Lesson(topic_id=graph["topic"].id, name="Synthetic other lesson", position=2))
    competency = add(LearningCompetency(lesson_id=other_lesson.id, description="Synthetic fixture", position=1))
    question = add(Question())
    revision = add(
        QuestionRevision(
            question_id=question.id,
            lesson_id=graph["lesson"].id,
            version=1,
            method="true_false",
            language="english",
            prompt="Synthetic fixture",
            content={},
        )
    )
    with Operations.context(MigrationContext.configure(db.connection())):
        # Only this generated test DB/savepoint: simulate a pre-0006 historical mismatch.
        module.downgrade()
        link = db.execute(
            text("INSERT INTO question_competencies(question_revision_id,competency_id) VALUES (:r,:c) RETURNING id"),
            {"r": revision.id, "c": competency.id},
        ).scalar_one()
        with pytest.raises(DBAPIError), db.connection().begin_nested():
            module.upgrade()
        assert db.execute(text("SELECT id FROM question_competencies WHERE id=:id"), {"id": link}).scalar_one() == link
        # Fixture repair is explicit, never part of the production migration.
        db.execute(text("DELETE FROM question_competencies WHERE id=:id"), {"id": link})
        module.upgrade()
        assert db.get(QuestionRevision, revision.id).question_id == question.id
