"""Read-only local startup preflight; never initialize or migrate a database."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from alembic.config import Config  # noqa: E402
from alembic.migration import MigrationContext  # noqa: E402
from alembic.script import ScriptDirectory  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.db.engine import build_engine  # noqa: E402
from sqlalchemy import text  # noqa: E402


def main():
    engine = None
    try:
        settings = Settings()
        if settings.mobile_web_origins and not settings.mobile_web_csrf_secret:
            print("Browser session secret missing. Run scripts/setup-env.ps1 from .local-version-2.")
            return 2
        if any(origin not in settings.cors_origins for origin in settings.mobile_web_origins):
            print("Every FLUENTT_MOBILE_WEB_ORIGINS entry must also be in FLUENTT_CORS_ORIGINS.")
            return 2
        engine = build_engine(settings)
        if engine is None:
            print("Set FLUENTT_DATABASE_URL in the ignored services/api/.env and start PostgreSQL first.")
            return 2
        config = Config(str(ROOT / "alembic.ini"))
        config.set_main_option("script_location", str(ROOT / "migrations"))
        expected = set(ScriptDirectory.from_config(config).get_heads())
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            current = set(MigrationContext.configure(connection).get_current_heads())
        if current != expected:
            print("Database migrations are not at the source head. Follow docs/TEAM_SETUP.md for fresh or existing databases.")
            return 2
        print("Database reachable; schema matches source head; browser session configuration is ready.")
        if not settings.admin_oidc_enabled:
            print("Real administrator sign-in requires optional OIDC/MFA configuration and operator provisioning.")
        return 0
    except Exception as exc:
        print(f"Startup preflight failed ({type(exc).__name__}). Check local configuration/database; credentials are omitted.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
