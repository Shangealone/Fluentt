import email_validator
import pytest
from pydantic import ValidationError

from app.auth.schemas import LoginRequest
from app.core.config import Settings, apply_environment_configurations


def test_production_environment_rejects_reserved_test_domains() -> None:
    prod_settings = Settings(
        app_env="production",
        database_url="postgresql+psycopg://u:p@localhost:5432/db",
        jwt_secret="x" * 32,
    )
    try:
        apply_environment_configurations(prod_settings)
        assert email_validator.TEST_ENVIRONMENT is False

        # Reserved .test domain must be rejected in production
        with pytest.raises(ValidationError):
            LoginRequest(email="learner@example.test", password="Password!123")

        # Standard valid email must be accepted
        req = LoginRequest(email="learner@example.com", password="Password!123")
        assert req.email == "learner@example.com"
    finally:
        from app.core.config import get_settings

        apply_environment_configurations(get_settings())


def test_development_and_testing_accepts_test_domains() -> None:
    test_settings = Settings(
        app_env="testing",
        database_url="postgresql+psycopg://u:p@localhost:5432/db",
        jwt_secret="x" * 32,
    )
    apply_environment_configurations(test_settings)
    assert email_validator.TEST_ENVIRONMENT is True

    # Reserved .test domain accepted in testing
    req = LoginRequest(email="learner@example.test", password="Password!123")
    assert req.email == "learner@example.test"
