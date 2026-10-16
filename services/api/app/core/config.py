from typing import Literal
from urllib.parse import urlparse

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="FLUENTT_", extra="forbid", hide_input_in_errors=True)
    environment: Literal["development", "test", "production"] = "development"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8081"]
    database_url: SecretStr | None = None
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    database_pool_size: int = 5
    database_max_overflow: int = 5
    database_pool_timeout: int = 10
    database_connect_timeout: int = 5
    mobile_session_idle_days: int = 30
    mobile_session_absolute_days: int = 90
    identity_rate_window_seconds: int = 60
    username_check_limit: int = 30
    user_creation_limit: int = 10
    class_creation_limit: int = 10
    mobile_session_request_limit: int = 60

    @field_validator(
        "mobile_session_idle_days",
        "mobile_session_absolute_days",
        "identity_rate_window_seconds",
        "username_check_limit",
        "user_creation_limit",
        "class_creation_limit",
        "mobile_session_request_limit",
    )
    @classmethod
    def positive_identity_values(cls, value: int) -> int:
        if value < 1:
            raise ValueError("Identity lifetimes and rate limits must be positive")
        return value

    @model_validator(mode="after")
    def valid_session_lifetimes(self):
        if self.mobile_session_idle_days > self.mobile_session_absolute_days:
            raise ValueError("Session idle lifetime cannot exceed its absolute lifetime")
        return self

    @field_validator("database_pool_size", "database_pool_timeout", "database_connect_timeout")
    @classmethod
    def positive_pool_values(cls, value: int) -> int:
        if value < 1:
            raise ValueError("Database pool and timeout settings must be positive")
        return value

    @field_validator("database_max_overflow")
    @classmethod
    def nonnegative_overflow(cls, value: int) -> int:
        if value < 0:
            raise ValueError("Database overflow must be nonnegative")
        return value

    @field_validator("cors_origins")
    @classmethod
    def validate_origins(cls, origins: list[str]) -> list[str]:
        for origin in origins:
            parsed = urlparse(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.netloc
                or "*" in origin
                or parsed.path
                or parsed.query
                or parsed.fragment
                or parsed.username
            ):
                raise ValueError("CORS origins must be explicit HTTP(S) origins without paths")
        return origins

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None:
            try:
                url = make_url(value.get_secret_value())
                valid = url.drivername == "postgresql+psycopg" and url.host and url.database
                if url.port is not None and not 1 <= url.port <= 65535:
                    valid = False
            except Exception:
                valid = False
            if not valid:
                raise ValueError("Use a complete postgresql+psycopg URL with host and database")
        return value
