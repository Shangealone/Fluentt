from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from app.core.config import Settings


def build_engine(settings: Settings) -> Engine | None:
    """Prepare a lazy engine only. Never connect or create tables at startup."""
    if settings.database_url is None:
        return None
    return create_engine(
        settings.database_url.get_secret_value(),
        pool_pre_ping=True,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        pool_timeout=settings.database_pool_timeout,
        hide_parameters=True,
        connect_args={
            "connect_timeout": settings.database_connect_timeout,
            "options": "-c timezone=UTC -c search_path=public",
        },
    )
