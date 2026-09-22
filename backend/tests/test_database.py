from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.config import Settings
from app.database.session import get_db
from app.main import app

client = TestClient(app)


def test_settings_accept_database_url() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://u:p@localhost:5432/db",
        jwt_secret="x" * 32,
    )
    assert settings.database_url.endswith("/db")


def test_health_db_returns_ok() -> None:
    response = client.get("/health/db")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_db_with_dependency_override() -> None:
    executed = False

    class DummySession:
        def execute(self, statement: text) -> None:
            nonlocal executed
            executed = True

    def override_get_db():
        yield DummySession()

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.get("/health/db")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        assert executed is True
    finally:
        app.dependency_overrides.clear()
