"""Privileged maintenance ONLY for explicitly isolated, rollbackable test fixtures."""

from sqlalchemy import text


def require_isolated_database(connection) -> None:
    name = connection.scalar(text("SELECT current_database()"))
    if not name.endswith("_test"):
        raise RuntimeError(
            "Destructive research fixture maintenance requires an isolated *_test database"
        )


def allow_historical_fixture_edits(connection, *tables: str) -> None:
    require_isolated_database(connection)
    if connection.get_nested_transaction() is None:
        raise RuntimeError("Historical fixture edits require a rollbackable savepoint")
    for table in tables:
        if table not in (
            "research_events",
            "review_attempts",
            "review_schedules",
            "accepted_client_events",
        ):
            raise ValueError("Unsupported fixture table")
        connection.execute(
            text(f"ALTER TABLE {table} DISABLE TRIGGER d9_immutable_row")
        )


def reset_isolated_research_database(connection) -> None:
    require_isolated_database(connection)
    authority_tables = (
        "research_protocols",
        "research_sets",
        "research_set_memberships",
        "participant_allocations",
        "participant_set_conditions",
    )
    for table in authority_tables:
        connection.execute(text(f"ALTER TABLE {table} DISABLE TRIGGER d11_no_truncate"))
    tables = (
        "research_events",
        "review_attempts",
        "review_schedules",
        "accepted_client_events",
        "review_sessions",
    )
    for table in tables:
        connection.execute(text(f"ALTER TABLE {table} DISABLE TRIGGER d9_no_truncate"))
    connection.execute(
        text(
            "TRUNCATE TABLE research_protocols, accepted_client_events, research_events, review_schedules, "
            "review_attempts, review_sessions, vocabulary_items, lessons, languages, "
            "learner_profiles, refresh_sessions, users CASCADE"
        )
    )
    for table in tables:
        connection.execute(text(f"ALTER TABLE {table} ENABLE TRIGGER d9_no_truncate"))
    for table in authority_tables:
        connection.execute(text(f"ALTER TABLE {table} ENABLE TRIGGER d11_no_truncate"))
