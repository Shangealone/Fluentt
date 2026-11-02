"""Read-only startup guard for the owner's existing Supabase team-test database."""

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool

from app.core.config import Settings


def check() -> str:
    settings = Settings()
    project = settings.team_demo_supabase_project or ""
    if settings.environment != "production" or settings.database_url is None:
        raise RuntimeError("Team demo requires production transport and a database")
    if not project or not project.isalnum():
        raise RuntimeError("Team demo requires an explicit Supabase project reference")

    url = make_url(settings.database_url.get_secret_value())
    if (
        url.database != "postgres"
        or url.host not in {"aws-0-eu-central-2.pooler.supabase.com"}
        or url.username != f"postgres.{project}"
        or url.query.get("sslmode") != "require"
    ):
        raise RuntimeError("Team demo database target does not match the approved Supabase project")

    expected = ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
    engine = create_engine(
        url, poolclass=NullPool, hide_parameters=True,
        connect_args={"connect_timeout": settings.database_connect_timeout},
    )
    try:
        with engine.connect() as connection:
            connection.execute(text("SET TRANSACTION READ ONLY"))
            actual = connection.execute(text("SELECT version_num FROM public.alembic_version")).scalars().all()
            if actual != [expected]:
                raise RuntimeError("Team demo database revision differs from this build; no migration was run")
            connection.rollback()
    finally:
        engine.dispose()
    return expected


if __name__ == "__main__":
    print(f"Team demo database revision verified: {check()}")
