"""Actual PostgreSQL migration keeps pre-D8 history and explicit unknown evidence."""

import pytest
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text

from tests.reviews.test_due_review import accept, make_review_context
from tests.reviews.test_timing import EVIDENCE


@pytest.fixture
def review_context(db_session, client):
    return make_review_context(db_session, client)


def migration():
    return ScriptDirectory.from_config(Config("alembic.ini")).get_revision("d8c0de000001").module


def test_upgrade_preserves_history_and_leaves_legacy_evidence_sql_null(db_session, client, review_context):
    _, headers, detail = review_context
    accept(client, headers, detail["vocabulary_items"][0])
    connection = db_session.connection()
    savepoint = connection.begin_nested()
    try:
        original = dict(connection.execute(text("SELECT * FROM review_attempts")).mappings().one())
        with Operations.context(MigrationContext.configure(connection)):
            migration().downgrade()
            assert "timing_evidence" not in {c["name"] for c in inspect(connection).get_columns("review_attempts")}
            migration().upgrade()
        assert dict(connection.execute(text("SELECT * FROM review_attempts")).mappings().one()) == original
        assert connection.scalar(text("SELECT count(*) FROM review_attempts WHERE timing_evidence IS NULL")) == 1
        assert connection.scalar(text("SELECT count(*) FROM current_review_schedules")) == 1
        assert connection.scalar(text("SELECT count(*) FROM research_events")) == 2
    finally:
        savepoint.rollback()
        db_session.rollback()


def test_downgrade_refuses_loss_of_captured_evidence(db_session, client, review_context):
    _, headers, detail = review_context
    accept(client, headers, detail["vocabulary_items"][0], timing_evidence=EVIDENCE)
    connection = db_session.connection()
    savepoint = connection.begin_nested()
    try:
        with Operations.context(MigrationContext.configure(connection)), pytest.raises(RuntimeError, match="discard captured timing evidence"):
            migration().downgrade()
        assert "timing_evidence" in {c["name"] for c in inspect(connection).get_columns("review_attempts")}
    finally:
        savepoint.rollback()
        db_session.rollback()
