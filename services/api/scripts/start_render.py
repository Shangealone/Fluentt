"""Render-only startup adapter. Never migrates, seeds, or prints credentials."""

import os
from collections.abc import MutableMapping

from sqlalchemy.engine import make_url


def prepare_environment(environ: MutableMapping[str, str]) -> int:
    if environ.get("RENDER") != "true" or environ.get("FLUENTT_ENVIRONMENT") != "production":
        raise ValueError("Use this adapter only on Render with production mode enabled.")
    raw = environ.get("FLUENTT_DATABASE_URL") or environ.get("DATABASE_URL")
    try:
        url = make_url(raw or "")
        if url.drivername not in {"postgres", "postgresql", "postgresql+psycopg"} or not url.host or not url.database:
            raise ValueError
        port = int(environ.get("PORT", "10000"))
        if not 1 <= port <= 65535:
            raise ValueError
    except Exception:
        raise ValueError("Configure a valid PostgreSQL connection and numeric Render port.") from None
    environ["FLUENTT_DATABASE_URL"] = url.set(drivername="postgresql+psycopg").render_as_string(hide_password=False)
    return port


def main() -> None:
    import uvicorn

    from app.core.config import Settings

    try:
        port = prepare_environment(os.environ)
        Settings()  # Validate existing contracts before binding; secret inputs stay hidden.
    except ValueError:
        raise SystemExit("Render configuration is invalid. Check environment settings; credentials are not logged.") from None
    # Trust forwarded HTTPS only inside Render's managed edge, never generic local hosting.
    # One worker retains the existing process-local limiter boundary for this demo.
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, workers=1,
                proxy_headers=True, forwarded_allow_ips="*", access_log=False)


if __name__ == "__main__":
    main()
