from alembic import context
from sqlalchemy import pool
from contextlib import nullcontext

import app.models  # noqa: F401
from app.core.config import Settings
from app.db.base import Base

target_metadata = Base.metadata


def run_configured_migrations(connection):
    requested = context.get_x_argument(as_dictionary=True).get("repair_initial_names")
    repair = context.config.attributes.get("repair_initial_names", False) or requested == "true"
    if requested is not None and requested != "true":
        raise RuntimeError("repair_initial_names accepts only the explicit value true")
    if repair:
        from scripts.bootstrap_names import repaired_bootstrap

    with repaired_bootstrap(connection) if repair else nullcontext():
        context.run_migrations()


def include_name(name, type_, parent_names):
    if type_ == "schema":
        return name in (None, "research_private")
    if type_ == "table":
        return parent_names["schema_qualified_table_name"] in target_metadata.tables
    return True


def run_migrations():
    provided_connection = context.config.attributes.get("connection")
    if provided_connection is not None:
        context.configure(
            connection=provided_connection,
            target_metadata=target_metadata,
            compare_type=True,
            include_schemas=True,
            include_name=include_name,
        )
        with context.begin_transaction():
            run_configured_migrations(provided_connection)
        return

    settings = Settings()
    if context.is_offline_mode():
        if context.get_x_argument(as_dictionary=True).get("repair_initial_names") is not None:
            raise RuntimeError("Bootstrap repair requires a verified empty online PostgreSQL database")
        # PostgreSQL dialect compilation only; this URL is never connected.
        context.configure(
            url="postgresql+psycopg://",
            target_metadata=target_metadata,
            literal_binds=True,
            dialect_opts={"paramstyle": "named"},
            include_schemas=True,
        )
        with context.begin_transaction():
            context.run_migrations()
        return

    if settings.database_url is None:
        raise RuntimeError("Set FLUENTT_DATABASE_URL before running online migrations")
    # No startup migrations. CLI migrations use a single unpooled connection.
    from sqlalchemy import create_engine

    engine = create_engine(
        settings.database_url.get_secret_value(),
        poolclass=pool.NullPool,
        hide_parameters=True,
        connect_args={
            "connect_timeout": settings.database_connect_timeout,
            "options": "-c timezone=UTC -c search_path=public",
        },
    )
    try:
        with engine.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
                include_schemas=True,
                include_name=include_name,
            )
            with context.begin_transaction():
                run_configured_migrations(connection)
    finally:
        engine.dispose()


run_migrations()
