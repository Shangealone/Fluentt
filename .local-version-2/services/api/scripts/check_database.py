"""Explicit connectivity diagnostic; application health remains independent."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.db.engine import build_engine  # noqa: E402


def main() -> int:
    engine = None
    try:
        engine = build_engine(Settings())
        if engine is None:
            print("Database not configured: set FLUENTT_DATABASE_URL.")
            return 2
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("PostgreSQL connection succeeded. Schema migration state is checked separately with Alembic.")
        return 0
    except Exception as exc:
        # Never print a DSN, password, SQL parameters, or raw driver error.
        print(f"Database check failed ({type(exc).__name__}). Check host, port, credentials and service availability.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
