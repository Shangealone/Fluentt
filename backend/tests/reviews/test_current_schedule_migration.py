"""D7 real PostgreSQL upgrade preserves history and refuses ambiguous reconstruction."""

import pytest
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text

from tests.reviews.test_due_review import accept, history, make_review_context


@pytest.fixture
def review_context(db_session, client):
    return make_review_context(db_session, client)


def migration():
    return (
        ScriptDirectory.from_config(Config("alembic.ini"))
        .get_revision("d7c0de000001")
        .module
    )


def pre_d7(connection):
    connection.execute(
        text("DELETE FROM current_review_schedules")
    )  # Isolated test maintenance.
    with Operations.context(MigrationContext.configure(connection)):
        migration().downgrade()


def test_upgrade_selects_latest_server_acceptance_and_retains_every_historical_fact(
    db_session, client, review_context
):
    _, headers, detail = review_context
    accept(client, headers, detail["vocabulary_items"][0])
    _, latest = accept(
        client,
        headers,
        detail["vocabulary_items"][0],
        client_interaction_at="2020-01-01T00:00:00Z",
    )
    original = history(db_session)
    connection = db_session.connection()
    savepoint = connection.begin_nested()
    try:
        pre_d7(connection)
        with Operations.context(MigrationContext.configure(connection)):
            migration().upgrade()
        assert history(db_session) == original
        row = connection.execute(
            text(
                "SELECT s.attempt_id FROM current_review_schedules c JOIN review_schedules s ON s.id=c.schedule_id"
            )
        ).one()
        assert str(row.attempt_id) == latest["id"]
        assert (
            connection.scalar(text("SELECT count(*) FROM current_review_schedules"))
            == 1
        )
    finally:
        savepoint.rollback()
        db_session.rollback()


def test_equal_latest_acceptance_times_refuse_without_guessing_order(
    db_session, client, review_context
):
    _, headers, detail = review_context
    accept(client, headers, detail["vocabulary_items"][0])
    accept(client, headers, detail["vocabulary_items"][0])
    connection = db_session.connection()
    savepoint = connection.begin_nested()
    try:
        pre_d7(connection)
        connection.execute(
            text(
                "UPDATE review_attempts SET server_acceptance_at='2025-01-01T00:00:00Z'"
            )
        )
        original = history(db_session)
        with (
            Operations.context(MigrationContext.configure(connection)),
            pytest.raises(RuntimeError, match="Ambiguous historical acceptance order"),
        ):
            migration().upgrade()
        assert history(db_session) == original
        assert not inspect(connection).has_table("current_review_schedules")
    finally:
        savepoint.rollback()
        db_session.rollback()


def test_inconsistent_historical_item_link_refuses_migration(
    db_session, client, review_context
):
    _, headers, detail = review_context
    accept(client, headers, detail["vocabulary_items"][0])
    connection = db_session.connection()
    savepoint = connection.begin_nested()
    try:
        pre_d7(connection)
        connection.execute(
            text("UPDATE review_schedules SET vocabulary_item_id=:item"),
            {"item": detail["vocabulary_items"][1]["id"]},
        )
        original = history(db_session)
        with (
            Operations.context(MigrationContext.configure(connection)),
            pytest.raises(
                RuntimeError, match="Inconsistent historical schedule ownership"
            ),
        ):
            migration().upgrade()
        assert history(db_session) == original
        assert not inspect(connection).has_table("current_review_schedules")
    finally:
        savepoint.rollback()
        db_session.rollback()


def test_downgrade_refuses_to_drop_current_acceptance_order(
    db_session, client, review_context
):
    _, headers, detail = review_context
    accept(client, headers, detail["vocabulary_items"][0])
    original = history(db_session)
    with (
        Operations.context(MigrationContext.configure(db_session.connection())),
        pytest.raises(RuntimeError, match="downgrade refused"),
    ):
        migration().downgrade()
    assert history(db_session) == original
    assert (
        db_session.execute(
            text("SELECT count(*) FROM current_review_schedules")
        ).scalar_one()
        == 1
    )
