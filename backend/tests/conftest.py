import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

# 1. Force testing environment variables before importing settings or app
TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://fluentt:fluentt_dev_only@localhost:5432/fluentt_test",
)
os.environ["APP_ENV"] = "testing"
os.environ["DATABASE_URL"] = TEST_DB_URL

from app.core.config import get_settings

get_settings.cache_clear()

import app.database.session as app_db_session
from app.database.base import Base
from app.database.session import get_db
from app.main import app

test_engine = create_engine(TEST_DB_URL, pool_pre_ping=True)
TestSessionLocal = sessionmaker(
    bind=test_engine, autoflush=False, expire_on_commit=False
)

# Redirect application SessionLocal and engine to test database
app_db_session.SessionLocal = TestSessionLocal
app_db_session.engine = test_engine


def override_get_db() -> Generator[Session]:
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment() -> None:
    # Ensure all tables exist in test database
    import app.auth.models
    import app.content.models
    import app.users.models  # noqa: F401

    Base.metadata.create_all(bind=test_engine)


@pytest.fixture(autouse=True)
def isolate_test_database() -> Generator[None]:
    # Ensure FastAPI routes use the isolated test database
    app.dependency_overrides[get_db] = override_get_db

    # Truncate test database tables before each test
    with test_engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE vocabulary_items, lessons, languages, "
                "learner_profiles, refresh_sessions, users CASCADE;"
            )
        )
    yield
    with test_engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE vocabulary_items, lessons, languages, "
                "learner_profiles, refresh_sessions, users CASCADE;"
            )
        )


@pytest.fixture
def db_session() -> Generator[Session]:
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
