"""Exercise the real D9 migration on rollbackable, isolated PostgreSQL schemas."""

import json
import uuid

import pytest
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text

from tests.research_helpers import require_isolated_database
from tests.research_logging.test_integrity import accepted
from tests.reviews.test_due_review import make_review_context


def migration():
    return (
        ScriptDirectory.from_config(Config("alembic.ini"))
        .get_revision("d9c0de000001")
        .module
    )


def test_upgrade_preserves_duplicate_legacy_json_without_guessing_links_or_versions(
    db_session, client
):
    user_id, _, _ = make_review_context(db_session, client)
    connection = db_session.connection()
    require_isolated_database(connection)
    savepoint = connection.begin_nested()
    try:
        with Operations.context(MigrationContext.configure(connection)):
            migration().downgrade()  # Empty research history only.
        payload = {
            "attempt_id": str(uuid.uuid4()),
            "participant_code": "OLD_CODE",
            "email": "legacy@example.test",
        }
        for _ in range(2):
            connection.execute(
                text(
                    "INSERT INTO research_events(id,event_type,user_id,payload,created_at) "
                    "VALUES (:id,'REVIEW_COMPLETED',:user,CAST(:payload AS json),now())"
                ),
                {"id": uuid.uuid4(), "user": user_id, "payload": json.dumps(payload)},
            )
        original = [
            dict(r)
            for r in connection.execute(
                text("SELECT * FROM research_events ORDER BY id")
            ).mappings()
        ]
        with Operations.context(MigrationContext.configure(connection)):
            migration().upgrade()
        after = [
            dict(r)
            for r in connection.execute(
                text("SELECT * FROM research_events ORDER BY id")
            ).mappings()
        ]
        for before, current in zip(original, after, strict=True):
            assert current.pop("schema_version") is None
            assert current.pop("review_attempt_id") is None
            assert current == before
        assert len(after) == 2
        for table, column, _, name in migration().RETAINED_FKS:
            fk = next(
                f
                for f in inspect(connection).get_foreign_keys(table)
                if f["name"] == name
            )
            assert fk["constrained_columns"] == [column]
            assert fk["options"]["ondelete"] == "RESTRICT"
        with (
            pytest.raises(RuntimeError, match="approved policy required"),
            Operations.context(MigrationContext.configure(connection)),
        ):
            migration().downgrade()
    finally:
        savepoint.rollback()
        db_session.rollback()


def test_downgrade_refuses_current_evidence_without_changing_any_records(
    db_session, client
):
    context = make_review_context(db_session, client)
    accepted(client, context)
    connection = db_session.connection()
    original = [
        dict(r)
        for r in connection.execute(
            text("SELECT * FROM research_events ORDER BY id")
        ).mappings()
    ]
    with (
        pytest.raises(RuntimeError, match="approved policy required"),
        Operations.context(MigrationContext.configure(connection)),
    ):
        migration().downgrade()
    assert [
        dict(r)
        for r in connection.execute(
            text("SELECT * FROM research_events ORDER BY id")
        ).mappings()
    ] == original


def test_empty_history_round_trip_reinstalls_guards_and_nullable_columns(db_session):
    connection = db_session.connection()
    require_isolated_database(connection)
    savepoint = connection.begin_nested()
    try:
        with Operations.context(MigrationContext.configure(connection)):
            migration().downgrade()
            assert "schema_version" not in {
                c["name"] for c in inspect(connection).get_columns("research_events")
            }
            migration().upgrade()
        columns = {
            c["name"]: c for c in inspect(connection).get_columns("research_events")
        }
        assert columns["schema_version"]["nullable"]
        assert columns["review_attempt_id"]["nullable"]
        assert (
            connection.scalar(
                text("SELECT count(*) FROM pg_trigger WHERE tgname='d9_immutable_row'")
            )
            == 4
        )
    finally:
        savepoint.rollback()
        db_session.rollback()
