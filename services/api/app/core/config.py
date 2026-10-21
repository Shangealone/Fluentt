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
    pronunciation_azure_enabled: bool = False
    pronunciation_azure_resource: str | None = None
    pronunciation_azure_key: SecretStr | None = None
    pronunciation_cloud_authorization_reference: str | None = None
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
    enrollment_peer_limit: int = 60
    enrollment_session_limit: int = 10
    admin_web_origin: str = "http://localhost:3000"
    admin_auth_limit: int = 10
    admin_oidc_issuer: str | None = None
    admin_oidc_client_id: str | None = None
    admin_oidc_client_secret: SecretStr | None = None
    admin_oidc_mfa_claim: Literal["acr", "amr"] = "acr"
    admin_oidc_mfa_values: list[str] = []

    @property
    def admin_oidc_enabled(self) -> bool:
        return bool(
            self.admin_oidc_issuer
            and self.admin_oidc_client_id
            and self.admin_oidc_client_id.strip()
            and self.admin_oidc_client_secret
            and self.admin_oidc_client_secret.get_secret_value()
            and self.admin_oidc_mfa_values
        )

    @field_validator("pronunciation_azure_resource")
    @classmethod
    def azure_resource_name(cls, value: str | None) -> str | None:
        import re

        if value is not None and not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", value):
            raise ValueError("Use an Azure resource name, not a URL")
        return value

    @field_validator("pronunciation_cloud_authorization_reference")
    @classmethod
    def audio_authorization_reference(cls, value: str | None) -> str | None:
        if value is not None and (not value.strip() or len(value) > 255):
            raise ValueError("Use a nonempty approved audio-processing reference up to 255 characters")
        return value

    @field_validator("admin_web_origin")
    @classmethod
    def validate_admin_origin(cls, value: str) -> str:
        cls.validate_origins([value])
        return value

    @field_validator("admin_oidc_issuer")
    @classmethod
    def validate_issuer(cls, value: str | None) -> str | None:
        if value is not None:
            parsed = urlparse(value)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username
                or parsed.query
                or parsed.fragment
                or len(value) > 255
            ):
                raise ValueError("OIDC issuer must be an explicit HTTPS issuer URL")
        return value

    @model_validator(mode="after")
    def admin_configuration(self):
        if (
            self.environment == "production"
            and self.admin_oidc_enabled
            and not self.admin_web_origin.startswith("https://")
        ):
            raise ValueError("Production admin origin must use HTTPS")
        if any(not value.strip() or len(value) > 255 for value in self.admin_oidc_mfa_values):
            raise ValueError("Accepted MFA values must be explicit nonempty values")
        return self

    @field_validator(
        "mobile_session_idle_days",
        "mobile_session_absolute_days",
        "identity_rate_window_seconds",
        "username_check_limit",
        "user_creation_limit",
        "class_creation_limit",
        "mobile_session_request_limit",
        "enrollment_peer_limit",
        "enrollment_session_limit",
        "admin_auth_limit",
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
