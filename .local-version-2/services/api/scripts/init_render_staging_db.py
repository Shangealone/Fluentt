"""Bootstrap only the named disposable Render database; never upgrade existing data."""

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool

from app.core.config import Settings
from scripts.bootstrap_names import require_empty


STAGING_DATABASE = "fluentt_synthetic_staging"


def initialize() -> str:
    settings = Settings()
    if settings.environment != "production" or settings.database_url is None:
        raise RuntimeError("Synthetic staging requires production transport and a database")
    url = make_url(settings.database_url.get_secret_value())
    if url.database != STAGING_DATABASE:
        raise RuntimeError("Refusing to initialize a database outside synthetic staging")

    config = Config("alembic.ini")
    head = ScriptDirectory.from_config(config).get_current_head()
    engine = create_engine(url, poolclass=NullPool, hide_parameters=True,
                           connect_args={"connect_timeout": settings.database_connect_timeout})
    try:
        with engine.begin() as connection:
            version_table = connection.execute(text("SELECT to_regclass('public.alembic_version')")).scalar_one()
            if version_table:
                versions = connection.execute(text("SELECT version_num FROM public.alembic_version")).scalars().all()
                if versions:
                    if versions != [head]:
                        raise RuntimeError("Staging database revision differs from this build; manual review required")
                    return head
            require_empty(connection)
            config.attributes["connection"] = connection
            config.attributes["repair_initial_names"] = True
            command.upgrade(config, "head")
            return head
    finally:
        engine.dispose()


if __name__ == "__main__":
    print(f"Synthetic staging database ready at revision {initialize()}")
