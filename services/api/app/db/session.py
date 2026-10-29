"""Synchronous request-scoped sessions. Services own explicit transaction commits."""

from collections.abc import Iterator

from fastapi import HTTPException, Request
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker


def session_factory(engine):
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session(request: Request) -> Iterator[Session]:
    factory = getattr(request.app.state, "session_factory", None)
    if factory is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    with factory() as session:
        try:
            yield session
        except OperationalError:
            session.rollback()
            raise HTTPException(status_code=503, detail="Database is unavailable") from None
        except Exception:
            session.rollback()
            raise
        # A route must commit deliberately. Uncommitted work is rolled back on close.
