import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app


def test_health_and_lifecycle():
    with TestClient(create_app(Settings(_env_file=None, environment="test"))) as client:
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "service": "fluentt-api"}
        assert response.headers["X-Request-ID"]


def test_cors_allowlist_and_error_contract():
    with TestClient(create_app(Settings(_env_file=None))) as client:
        allowed = client.options(
            "/api/v1/health", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"}
        )
        assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
        denied = client.options(
            "/api/v1/health", headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "GET"}
        )
        assert "access-control-allow-origin" not in denied.headers
        missing = client.get("/does-not-exist")
        assert missing.status_code == 404
        assert missing.json()["error"]["request_id"]


@pytest.mark.parametrize(
    "values", [{"cors_origins": ["*"]}, {"database_url": "sqlite:///test.db"}, {"environment": "invalid"}]
)
def test_invalid_configuration(values):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **values)


def test_validation_and_unhandled_errors_are_redacted():
    from pydantic import BaseModel

    app = create_app(Settings(_env_file=None, environment="test"))

    class Payload(BaseModel):
        count: int

    @app.app.post("/test-validation")
    def validate(payload: Payload):
        return payload

    @app.app.get("/test-failure")
    def fail():
        raise RuntimeError("private-secret-should-not-leak")

    with TestClient(app, raise_server_exceptions=False) as client:
        invalid = client.post("/test-validation", json={"count": "private-value"})
        assert invalid.status_code == 422
        assert invalid.json()["error"]["code"] == "validation_error"
        assert "private-value" not in invalid.text
        failed = client.get("/test-failure", headers={"Origin": "http://localhost:3000"})
        assert failed.status_code == 500
        assert failed.json()["error"]["code"] == "internal_error"
        assert "private-secret" not in failed.text
        assert failed.headers["access-control-allow-origin"] == "http://localhost:3000"
